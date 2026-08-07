/**
 * videos-queue.json 의 각 영상에 대해 한국어 자막(자동자막 포함)을 수집해
 * data/transcripts/{videoId}.json 으로 저장한다.
 *
 * youtube-transcript 패키지는 데이터센터 IP에서 "Transcript is disabled"로 전부 실패하므로,
 * InnerTube player API + timedtext XML 직접 파싱으로 수집한다.
 *
 * 봇 차단(LOGIN_REQUIRED) 대응:
 *   데이터센터 IP(로컬·GitHub Actions)는 유튜브가 "로그인해 봇 아님을 확인하라"며
 *   모든 클라이언트를 막는다. YT_COOKIE(로그인된 유튜브 쿠키)가 주어지면 인증된
 *   WEB 클라이언트로 SAPISIDHASH 서명을 붙여 요청해 이 차단을 우회한다.
 *   쿠키가 없으면 기존 익명 폴백 체인(ANDROID→IOS→WEB)만 시도한다.
 *
 * 필요 환경변수: (없음 — 쿠키는 선택)
 * 선택 환경변수:
 *   YT_COOKIE  (youtube.com 로그인 쿠키의 Cookie 헤더 문자열)
 *   PROXY_URL  (주거용 프록시. 예: http://user:pass@host:port) — 설정 시 유튜브
 *              요청만 이 프록시를 거쳐 나가 데이터센터 IP 차단을 회피한다.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { fetch as undiciFetch, ProxyAgent } from "undici";
import {
  ensureDir,
  log,
  QUEUE_FILE,
  QueueItem,
  readJson,
  TRANSCRIPTS_DIR,
  TranscriptSegment,
} from "./lib";

const ORIGIN = "https://www.youtube.com";

/* 주거용 프록시 우회: PROXY_URL이 있으면 유튜브 요청만 이 프록시(가정용 IP)를
   거쳐 나가게 한다. 요약 LLM·R2 업로드 등 다른 트래픽은 프록시를 타지 않는다.
   fetch의 표준 타입에 dispatcher가 없어 옵션 타입을 확장해 전달한다. */
const PROXY_URL = process.env.PROXY_URL?.trim();
/* undici ProxyAgent는 URL 안의 user:pass@ 를 Proxy-Authorization으로 자동
   전송하지 않는 경우가 있어(→ 프록시 407 → "fetch failed"), 인증을 Basic
   토큰으로 명시적으로 붙인다. */
function makeProxyDispatcher(raw: string): ProxyAgent {
  const u = new URL(raw);
  const uri = `${u.protocol}//${u.host}`; // userinfo 제거한 순수 엔드포인트
  if (u.username) {
    const user = decodeURIComponent(u.username);
    const pass = decodeURIComponent(u.password);
    const token = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
    return new ProxyAgent({ uri, token });
  }
  return new ProxyAgent({ uri });
}
const ytDispatcher = PROXY_URL ? makeProxyDispatcher(PROXY_URL) : undefined;
type FetchOpts = RequestInit & { dispatcher?: unknown };
function ytFetch(url: string, opts: FetchOpts): Promise<Response> {
  // 프록시(dispatcher)를 쓸 땐 반드시 undici 자체 fetch를 사용한다. Node 내장
  // fetch에 설치본 undici의 dispatcher를 넘기면 버전 불일치로 "invalid
  // onRequestStart method"(UND_ERR_INVALID_ARG)가 난다. 프록시가 없으면
  // 기존처럼 Node 내장 fetch를 그대로 쓴다.
  if (ytDispatcher) {
    return undiciFetch(url, { ...opts, dispatcher: ytDispatcher } as never) as unknown as Promise<Response>;
  }
  return fetch(url, opts as RequestInit);
}

/* 클라이언트 폴백 체인 — 데이터센터 IP는 클라이언트별로 차단 여부가 달라
   ANDROID가 LOGIN_REQUIRED를 받아도 다른 클라이언트는 통과할 수 있다.
   auth:true 인 클라이언트는 YT_COOKIE가 있을 때 SAPISIDHASH 인증을 붙인다. */
const CLIENTS = [
  {
    label: "WEB(auth)",
    auth: true,
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
    client: { clientName: "WEB", clientVersion: "2.20260715.00.00", hl: "ko", gl: "KR" },
  },
  {
    label: "ANDROID",
    auth: false,
    ua: "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip",
    client: { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 30, hl: "ko", gl: "KR" },
  },
  {
    label: "IOS",
    auth: false,
    ua: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)",
    client: { clientName: "IOS", clientVersion: "20.10.4", deviceModel: "iPhone16,2", hl: "ko", gl: "KR" },
  },
] as const;

function decodeEntities(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * YT_COOKIE를 Cookie 헤더 형식("name=value; name2=value2")으로 정규화한다.
 * 두 입력 형식을 모두 허용한다:
 *   1) Cookie 헤더 문자열 (브라우저 DevTools의 Request Headers > cookie)
 *   2) Netscape 쿠키 파일 (확장프로그램 내보내기 — 탭 구분 7필드)
 * 없으면 null.
 */
function getCookie(): string | null {
  const raw = process.env.YT_COOKIE?.trim();
  if (!raw) return null;
  // Netscape 쿠키 파일이면(탭 포함 또는 헤더 주석) name=value 쌍으로 변환
  if (/^#\s*Netscape/i.test(raw) || /\t/.test(raw)) {
    const pairs: string[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const f = line.split("\t");
      if (f.length < 7) continue;
      const name = f[5].trim();
      const value = f[6].trim();
      if (name) pairs.push(`${name}=${value}`);
    }
    if (pairs.length) return pairs.join("; ");
  }
  return raw.replace(/^["']|["']$/g, "").replace(/\s*\n\s*/g, " ").trim();
}

/**
 * 로그인 쿠키로 인증 헤더(SAPISIDHASH)를 만든다.
 * 유튜브 WEB InnerTube는 쿠키만으론 부족하고, SAPISID 기반 시간서명 해시를
 * Authorization 헤더로 요구한다. *1P/*3P 변형이 있으면 함께 서명한다.
 */
function authHeaders(cookie: string): Record<string, string> {
  const pick = (name: string) => cookie.match(new RegExp(`(?:^|[;\\s])${name}=([^;]+)`))?.[1];
  const ts = Math.floor(Date.now() / 1000);
  const sign = (sid: string) =>
    crypto.createHash("sha1").update(`${ts} ${sid} ${ORIGIN}`).digest("hex");

  const parts: string[] = [];
  const sapisid = pick("SAPISID") ?? pick("__Secure-3PAPISID") ?? pick("__Secure-1PAPISID");
  if (sapisid) parts.push(`SAPISIDHASH ${ts}_${sign(sapisid)}`);
  const p1 = pick("__Secure-1PAPISID");
  if (p1) parts.push(`SAPISID1PHASH ${ts}_${sign(p1)}`);
  const p3 = pick("__Secure-3PAPISID");
  if (p3) parts.push(`SAPISID3PHASH ${ts}_${sign(p3)}`);

  const headers: Record<string, string> = { cookie, origin: ORIGIN, "x-origin": ORIGIN };
  if (parts.length) headers["authorization"] = parts.join(" ");
  return headers;
}

/**
 * timedtext XML을 세그먼트로 파싱. 유튜브가 반환하는 두 형식을 모두 지원한다:
 *   A) 기본:  <text start="0.56" dur="6.92">...</text>   (초 단위 실수)
 *   B) srv3:  <p t="560" d="6920">...</p>                (밀리초)
 * 예전 파서는 B만 처리해, 기본 형식(A)으로 오는 자막을 0줄로 오인했다.
 */
function parseTimedText(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let m: RegExpExecArray | null;
  const reText = /<text start="([\d.]+)"(?: dur="([\d.]+)")?[^>]*>(.*?)<\/text>/gs;
  while ((m = reText.exec(xml))) {
    const text = decodeEntities(m[3]);
    if (text) segments.push({ text, start: Math.round(Number(m[1])), duration: Math.round(Number(m[2] ?? 0)) });
  }
  if (segments.length > 0) return segments;
  const reP = /<p t="(\d+)"(?: d="(\d+)")?[^>]*>(.*?)<\/p>/gs;
  while ((m = reP.exec(xml))) {
    const text = decodeEntities(m[3]);
    if (text)
      segments.push({
        text,
        start: Math.round(Number(m[1]) / 1000),
        duration: Math.round(Number(m[2] ?? 0) / 1000),
      });
  }
  return segments;
}

/**
 * InnerTube로 한국어 자막 트랙을 찾아 XML을 파싱.
 * 클라이언트 폴백 체인을 순회하며, 차단(LOGIN_REQUIRED 등)과
 * 진짜 자막 없음을 구분해 로그로 남긴다. 자막 없으면 null.
 */
export async function fetchTranscriptInnerTube(
  videoId: string
): Promise<TranscriptSegment[] | null> {
  const cookie = getCookie();
  let lastStatus = "";
  for (const c of CLIENTS) {
    const useAuth = c.auth && cookie;
    // 익명 WEB(auth 클라이언트인데 쿠키 없음)은 어차피 ANDROID/IOS와 중복 → 건너뜀
    if (c.auth && !cookie) continue;

    const headers: Record<string, string> = {
      "content-type": "application/json",
      "user-agent": c.ua,
      ...(useAuth ? authHeaders(cookie!) : cookie ? { cookie } : {}),
    };
    const res = await ytFetch(`${ORIGIN}/youtubei/v1/player?prettyPrint=false`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        context: { client: c.client },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      }),
    });
    if (!res.ok) {
      lastStatus = `HTTP ${res.status}`;
      continue;
    }
    const data = (await res.json()) as {
      playabilityStatus?: { status?: string; reason?: string };
      captions?: {
        playerCaptionsTracklistRenderer?: {
          captionTracks?: { languageCode: string; kind?: string; baseUrl: string }[];
        };
      };
    };
    const status = data.playabilityStatus?.status ?? "?";
    if (status !== "OK") {
      // LOGIN_REQUIRED = 봇 차단(자막 없음과 다름) → 다음 클라이언트 시도
      lastStatus = status;
      log(`  [${c.label}] ${videoId}: playability=${status}${useAuth ? " (쿠키인증)" : ""} — 다음 클라이언트 시도`);
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks?.length) return null; // 재생 가능 + 트랙 없음 = 진짜 자막 없음
    const ko = tracks.find((t) => t.languageCode === "ko" && t.kind !== "asr")
      ?? tracks.find((t) => t.languageCode === "ko");
    if (!ko) return null;

    const capHeaders: Record<string, string> = { "user-agent": c.ua };
    if (cookie) capHeaders["cookie"] = cookie;
    const xml = await (await ytFetch(ko.baseUrl, { headers: capHeaders })).text();
    const segments = parseTimedText(xml);
    return segments.length > 0 ? segments : null;
  }
  throw new Error(`모든 클라이언트 차단/실패 (마지막: ${lastStatus})`);
}

export async function fetchTranscripts(): Promise<void> {
  const queue = readJson<QueueItem[]>(QUEUE_FILE, []);
  if (queue.length === 0) {
    log("큐가 비어 있습니다. 먼저 fetch:videos 를 실행하세요.");
    return;
  }
  ensureDir(TRANSCRIPTS_DIR);
  log(getCookie() ? "YT_COOKIE 감지 — 쿠키 인증(WEB) 우선 시도" : "YT_COOKIE 없음 — 익명 폴백만 시도(차단 시 실패)");
  if (PROXY_URL) log("PROXY_URL 감지 — 유튜브 요청을 주거용 프록시로 우회(데이터센터 IP 차단 회피)");

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // 쿠키 보호: 영상 사이 간격을 넉넉히 두어 "버스트"로 보이지 않게 한다.
  const gapMs = Number(process.env.TRANSCRIPT_DELAY_MS) || 4000;
  // 연속으로 로그인 차단(LOGIN_REQUIRED)이 이만큼 나오면 세션이 막힌 것이므로
  // 남은 영상까지 두들기지 말고 즉시 중단한다(계속 두들기면 쿠키·IP가 더 태워짐).
  const blockLimit = Number(process.env.TRANSCRIPT_BLOCK_LIMIT) || 3;
  let consecutiveBlocks = 0;

  for (const item of queue) {
    const outFile = path.join(TRANSCRIPTS_DIR, `${item.videoId}.json`);
    if (fs.existsSync(outFile)) {
      log(`자막 있음(캐시) — 건너뜀: ${item.title}`);
      continue;
    }
    let done = false;
    let authBlocked = false;
    // InnerTube는 간헐적으로 트랙을 누락 반환하므로 null도 재시도 대상.
    // 단, 로그인 차단(LOGIN_REQUIRED)은 재시도해도 안 되고 봇 탐지만 악화되므로 즉시 포기.
    for (let attempt = 0; attempt < 4 && !done; attempt++) {
      try {
        const segments = await fetchTranscriptInnerTube(item.videoId);
        if (segments === null) {
          if (attempt === 3) log(`자막 없음 — 다음 실행에서 재시도: ${item.title}`);
          else await sleep(5000 * (attempt + 1));
          continue;
        }
        fs.writeFileSync(outFile, JSON.stringify(segments) + "\n", "utf-8");
        log(`자막 저장 (${segments.length} 세그먼트): ${item.title}`);
        done = true;
      } catch (e) {
        const msg = (e as Error).message;
        if (/LOGIN_REQUIRED/.test(msg)) {
          authBlocked = true;
          log(`자막 차단(로그인 필요) — 재시도 생략: ${item.title}`);
          break;
        }
        // "fetch failed" 같은 상위 메시지는 원인이 cause에 있으므로 함께 찍는다
        const cause = (e as { cause?: { code?: string; message?: string } }).cause;
        const detail = cause ? ` [${cause.code ?? cause.message ?? ""}]` : "";
        log(`자막 수집 오류(${attempt + 1}/4): ${item.title} — ${msg}${detail}`);
        await sleep(4000 * (attempt + 1));
      }
    }

    if (done) {
      consecutiveBlocks = 0;
    } else if (authBlocked) {
      consecutiveBlocks += 1;
      if (consecutiveBlocks >= blockLimit) {
        log(
          `유튜브가 세션을 차단했습니다(연속 ${consecutiveBlocks}건 로그인 요구). ` +
            `남은 회의는 다음 실행에서 재시도합니다. 반복되면 YT_COOKIE 갱신 또는 프록시/자체 러너를 권장합니다.`
        );
        break; // 버스트로 쿠키를 더 태우지 않도록 전체 중단
      }
    }
    await sleep(gapMs); // 요청 간격(쿠키 보호)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  fetchTranscripts().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
