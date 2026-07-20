/**
 * 전체 파이프라인: 영상 수집 → 자막 수집 → 요약.
 * 필요 환경변수: YOUTUBE_API_KEY, ANTHROPIC_API_KEY
 */
import { fetchVideos } from "./fetch-videos";
import { fetchTranscripts } from "./fetch-transcripts";
import { summarize } from "./summarize";
import { log } from "./lib";

async function main() {
  log("=== 1/3 영상 수집 ===");
  const queue = await fetchVideos();
  if (queue.length === 0) {
    log("신규 회의 영상 없음 — 종료");
    return;
  }
  log("=== 2/3 자막 수집 ===");
  await fetchTranscripts();
  log("=== 3/3 요약 ===");
  await summarize();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
