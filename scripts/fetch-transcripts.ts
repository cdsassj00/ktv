/**
 * videos-queue.json 의 각 영상에 대해 한국어 자막(자동자막 포함)을 수집해
 * data/transcripts/{videoId}.json 으로 저장한다.
 *
 * youtube-transcript 패키지는 데이터센터 IP에서 "Transcript is disabled"로 전부 실패하므로,
 * InnerTube player API(ANDROID 클라이언트) + timedtext XML 직접 파싱으로 수집한다.
 * 실패한 영상은 큐에 남겨두고 다음 실행에서 재시도한다.
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import {
  ensureDir,
  log,
  QUEUE_FILE,
  QueueItem,
  readJson,
  TRANSCRIPTS_DIR,
  TranscriptSegment,
} from "./lib";

/* 클라이언트 폴백 체인 — 데이터센터 IP는 클라이언트별로 차단 여부가 달라
   ANDROID가 LOGIN_REQUIRED를 받아도 다른 클라이언트는 통과할 수 있다 */
const CLIENTS = [
  {
    label: "ANDROID",
    ua: "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip",
    client: { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 30, hl: "ko", gl: "KR" },
  },
  {
    label: "IOS",
    ua: "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X;)",
    client: { clientName: "IOS", clientVersion: "20.10.4", deviceModel: "iPhone16,2", hl: "ko", gl: "KR" },
  },
  {
    label: "WEB",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    client: { clientName: "WEB", clientVersion: "2.20260715.00.00", hl: "ko", gl: "KR" },
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
 * InnerTube로 한국어 자막 트랙을 찾아 XML을 파싱.
 * 클라이언트 폴백 체인을 순회하며, 차단(LOGIN_REQUIRED 등)과
 * 진짜 자막 없음을 구분해 로그로 남긴다. 자막 없으면 null.
 */
export async function fetchTranscriptInnerTube(
  videoId: string
): Promise<TranscriptSegment[] | null> {
  let lastStatus = "";
  for (const c of CLIENTS) {
    const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": c.ua },
      body: JSON.stringify({ context: { client: c.client }, videoId }),
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
      log(`  [${c.label}] ${videoId}: playability=${status} — 다음 클라이언트 시도`);
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!tracks?.length) return null; // 재생 가능 + 트랙 없음 = 진짜 자막 없음
    const ko = tracks.find((t) => t.languageCode === "ko" && t.kind !== "asr")
      ?? tracks.find((t) => t.languageCode === "ko");
    if (!ko) return null;

    const xml = await (await fetch(ko.baseUrl, { headers: { "user-agent": c.ua } })).text();
    const segments: TranscriptSegment[] = [];
    const re = /<p t="(\d+)"(?: d="(\d+)")?[^>]*>(.*?)<\/p>/gs;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
      const text = decodeEntities(m[3]);
      if (text)
        segments.push({
          text,
          start: Math.round(Number(m[1]) / 1000),
          duration: Math.round(Number(m[2] ?? 0) / 1000),
        });
    }
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

  for (const item of queue) {
    const outFile = path.join(TRANSCRIPTS_DIR, `${item.videoId}.json`);
    if (fs.existsSync(outFile)) {
      log(`자막 있음(캐시) — 건너뜀: ${item.title}`);
      continue;
    }
    let done = false;
    // InnerTube는 간헐적으로 트랙을 누락 반환하므로 null도 재시도 대상
    for (let attempt = 0; attempt < 4 && !done; attempt++) {
      try {
        const segments = await fetchTranscriptInnerTube(item.videoId);
        if (segments === null) {
          if (attempt === 3) log(`자막 없음 — 다음 실행에서 재시도: ${item.title}`);
          else await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
          continue;
        }
        fs.writeFileSync(outFile, JSON.stringify(segments) + "\n", "utf-8");
        log(`자막 저장 (${segments.length} 세그먼트): ${item.title}`);
        done = true;
      } catch (e) {
        log(`자막 수집 오류(${attempt + 1}/4): ${item.title} — ${(e as Error).message}`);
        await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
      }
    }
    await new Promise((r) => setTimeout(r, 1500)); // 요청 간격
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  fetchTranscripts().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
