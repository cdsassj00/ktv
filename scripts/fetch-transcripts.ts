/**
 * videos-queue.json 의 각 영상에 대해 한국어 자막(자동자막 포함)을 수집해
 * data/transcripts/{videoId}.json 으로 저장한다.
 *
 * 1차: youtube-transcript 패키지. 실패한 영상은 큐에 남겨두고 로그만 남긴다.
 * (자막이 아예 없는 영상은 Phase 4에서 yt-dlp + Whisper 폴백 예정)
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { YoutubeTranscript } from "youtube-transcript";
import {
  ensureDir,
  log,
  QUEUE_FILE,
  QueueItem,
  readJson,
  TRANSCRIPTS_DIR,
  TranscriptSegment,
} from "./lib";

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
    try {
      const raw = await YoutubeTranscript.fetchTranscript(item.videoId, { lang: "ko" });
      const segments: TranscriptSegment[] = raw.map((s) => ({
        text: s.text,
        // youtube-transcript는 ms 단위 offset/duration을 반환
        start: Math.round(s.offset / 1000),
        duration: Math.round(s.duration / 1000),
      }));
      fs.writeFileSync(outFile, JSON.stringify(segments) + "\n", "utf-8");
      log(`자막 저장 (${segments.length} 세그먼트): ${item.title}`);
    } catch (e) {
      log(`⚠️ 자막 수집 실패: ${item.title} — ${(e as Error).message}`);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  fetchTranscripts().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
