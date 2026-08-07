/**
 * 저장된 회의의 "출처 영상"을 실제 유튜브와 대조해, 잘못된 출처(클립·재편집본
 * 등)나 사라진 영상을 감지하고, 같은 회의의 "정상 공식 본편"으로 출처만 교체한다.
 *
 * 원칙(사용자 요구):
 *  - 이미 정상인 회의는 건드리지 않는다(출처가 멀쩡하면 skip).
 *  - 새 회의를 만들지 않는다(같은 회차 중복 생성 없음). 기존 레코드의
 *    videoId/videoUrl/thumbnail/duration 만 정상본으로 교체하고, 요약·발언·
 *    지시 등 분석 결과는 그대로 유지한다(재요약 비용·변형 없음).
 *  - 안전을 위해 opt-in: RECONCILE=1 일 때만 실제 파일을 수정한다.
 *    (미설정 시 "무엇을 어떻게 바꿀지"만 보여주는 dry-run 리포트)
 *
 * 판정:
 *  - 현재 출처 videoId를 oembed로 조회 → 제목이 클립(looksLikeClip)이거나,
 *    조회 불가(삭제/비공개)면 "출처 불량"으로 본다. 정상 본편이면 skip.
 *  - 불량 회의에 대해 채널에서 정상 본편을 찾는다:
 *      국무회의: "제N회 국무회의"를 번호로 지목(videoDuration=long), 같은 연도·
 *                클립 아님만. 공식형("(날짜) …") + 장시간 우선.
 *      업무보고: "업무보고"(videoDuration=long) 중 같은 날짜·클립 아님만.
 *
 * 필요 환경변수: YOUTUBE_API_KEY. 실제 반영은 RECONCILE=1.
 * 선택: CHANNEL_HANDLE(기본 KTV_korea).
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { log, looksLikeClip, MEETINGS_DIR, parseIsoDuration, readJson } from "./lib";

const API = "https://www.googleapis.com/youtube/v3";

async function yt<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY 환경변수가 필요합니다.");
  const qs = new URLSearchParams({ ...params, key });
  const res = await fetch(`${API}/${endpoint}?${qs}`);
  if (!res.ok) throw new Error(`YouTube API ${endpoint} 실패 (${res.status}): ${await res.text()}`);
  return (await res.json()) as T;
}

interface Meeting {
  id: string;
  type: "cabinet" | "briefing" | "other";
  title: string;
  date: string; // YYYY-MM-DD
  videoId: string;
  videoUrl?: string;
  thumbnail?: string;
  duration?: number;
}

/** 현재 출처 영상의 실제 유튜브 제목(없으면 null = 삭제/비공개/임베드불가) */
async function realTitle(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { title?: string };
    return j.title ?? null;
  } catch {
    return null;
  }
}

type Found = { videoId: string; title: string; duration: number; thumbnail: string };

/** videos.list로 길이·썸네일을 채우고 5분 미만(예고·클립)은 버린다 */
async function detail(videoId: string): Promise<Found | null> {
  const res = await yt<{
    items: {
      id: string;
      snippet: { title: string; thumbnails?: { high?: { url: string }; medium?: { url: string } } };
      contentDetails: { duration: string };
    }[];
  }>("videos", { part: "snippet,contentDetails", id: videoId });
  const v = res.items[0];
  if (!v) return null;
  const duration = parseIsoDuration(v.contentDetails.duration);
  if (duration < 300) return null;
  return {
    videoId,
    title: v.snippet.title,
    duration,
    thumbnail: v.snippet.thumbnails?.high?.url ?? v.snippet.thumbnails?.medium?.url ?? "",
  };
}

/** 같은 회의의 "정상 공식 본편"을 채널에서 찾는다. 없으면 null */
async function findProper(channelId: string, m: Meeting): Promise<Found | null> {
  const year = Number(m.date.slice(0, 4));
  let q: string;
  let accept: (title: string, publishedAt: string) => boolean;

  if (m.type === "cabinet") {
    const num = m.title.match(/제\s*(\d+)\s*회/);
    if (!num) return null;
    const n = Number(num[1]);
    const numRe = new RegExp(`제\\s*${n}\\s*회`);
    q = `제${n}회 국무회의`;
    accept = (t, p) =>
      !looksLikeClip(t) &&
      /국무회의/.test(t) &&
      numRe.test(t) &&
      Number(p.slice(0, 4)) === year;
  } else if (m.type === "briefing") {
    q = "업무보고";
    // 업무보고는 회차가 없으므로 "같은 날짜 + 클립 아님"으로만 안전 매칭
    accept = (t, p) => !looksLikeClip(t) && /업무보고/.test(t) && p.slice(0, 10) === m.date;
  } else {
    return null;
  }

  const res = await yt<{
    items?: { id: { videoId?: string }; snippet: { title: string; publishedAt: string } }[];
  }>("search", {
    part: "snippet",
    channelId,
    q,
    type: "video",
    order: "date",
    videoDuration: "long",
    maxResults: "25",
  });

  const cands: { videoId: string; title: string; official: boolean }[] = [];
  for (const it of res.items ?? []) {
    const vid = it.id.videoId;
    if (!vid || vid === m.videoId) continue;
    if (!accept(it.snippet.title, it.snippet.publishedAt)) continue;
    // 공식형(날짜 괄호로 시작하거나 "대통령"이 든 정식 제목) 우선
    const official = /^\s*\(/.test(it.snippet.title) || /대통령/.test(it.snippet.title);
    cands.push({ videoId: vid, title: it.snippet.title, official });
  }
  if (!cands.length) return null;
  cands.sort((a, b) => Number(b.official) - Number(a.official)); // 공식형 먼저
  // 길이 확인해 가장 긴 본편 선택
  let best: Found | null = null;
  for (const c of cands.slice(0, 6)) {
    const d = await detail(c.videoId);
    if (d && (!best || d.duration > best.duration)) best = d;
  }
  return best;
}

async function reconcile() {
  const apply = process.env.RECONCILE === "1";
  const handle = process.env.CHANNEL_HANDLE ?? "KTV_korea";
  if (!fs.existsSync(MEETINGS_DIR)) {
    log("meetings 디렉터리 없음 — 종료");
    return;
  }

  const channels = await yt<{ items?: { id: string }[] }>("channels", {
    part: "id",
    forHandle: handle,
  });
  const channelId = channels.items?.[0]?.id;
  if (!channelId) throw new Error(`채널을 찾을 수 없음: @${handle}`);

  const files = fs.readdirSync(MEETINGS_DIR).filter((f) => f.endsWith(".json"));
  let ok = 0;
  let bad = 0;
  let fixed = 0;
  let unfixable = 0;

  for (const f of files) {
    const file = path.join(MEETINGS_DIR, f);
    const m = readJson<Meeting>(file, {} as Meeting);
    if (!m.videoId || !m.type) continue;

    const rt = await realTitle(m.videoId);
    const isBad = rt === null ? true : looksLikeClip(rt);
    if (!isBad) {
      ok += 1;
      continue;
    }
    bad += 1;
    const reason = rt === null ? "출처 조회불가(삭제/비공개)" : `클립 출처("${rt.slice(0, 40)}")`;

    const proper = await findProper(channelId, m);
    if (!proper) {
      unfixable += 1;
      log(`⚠️  ${m.title} (${m.date}) — ${reason} → 정상 본편 못 찾음(교체 보류)`);
      continue;
    }
    log(
      `🔧 ${m.title} (${m.date}) — ${reason}\n` +
        `    → 정상본: "${proper.title.slice(0, 50)}" [${proper.videoId}] ${Math.round(proper.duration / 60)}분`
    );
    if (apply) {
      m.videoId = proper.videoId;
      m.videoUrl = `https://www.youtube.com/watch?v=${proper.videoId}`;
      m.thumbnail = proper.thumbnail;
      m.duration = proper.duration;
      fs.writeFileSync(file, JSON.stringify(m, null, 2) + "\n", "utf-8");
      fixed += 1;
    }
  }

  log(
    `대조 완료: 정상 ${ok} / 불량 ${bad} (교체 ${apply ? fixed : 0}` +
      `${apply ? "" : " — dry-run, RECONCILE=1로 반영"}, 정상본 못찾음 ${unfixable})`
  );
  if (!apply && bad > 0) log("실제 반영하려면: RECONCILE=1 npm run reconcile");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  reconcile().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
