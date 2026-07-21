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

const UA = "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip";

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

/** InnerTube로 한국어 자막 트랙을 찾아 XML을 파싱. 자막 없으면 null */
export async function fetchTranscriptInnerTube(
  videoId: string
): Promise<TranscriptSegment[] | null> {
  const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": UA },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: "20.10.38",
          androidSdkVersion: 30,
          hl: "ko",
          gl: "KR",
        },
      },
      videoId,
    }),
  });
  if (!res.ok) throw new Error(`player API ${res.status}`);
  const data = (await res.json()) as {
    playabilityStatus?: { status?: string };
    captions?: {
      playerCaptionsTracklistRenderer?: {
        captionTracks?: { languageCode: string; kind?: string; baseUrl: string }[];
      };
    };
  };
  const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks?.length) return null;
  const ko = tracks.find((t) => t.languageCode === "ko" && t.kind !== "asr")
    ?? tracks.find((t) => t.languageCode === "ko");
  if (!ko) return null;

  const xml = await (await fetch(ko.baseUrl, { headers: { "user-agent": UA } })).text();
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
