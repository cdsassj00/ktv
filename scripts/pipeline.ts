/**
 * 전체 파이프라인: 영상 수집 → 자막 수집 → 요약.
 * 필요 환경변수: YOUTUBE_API_KEY, ANTHROPIC_API_KEY
 */
import { fetchVideos } from "./fetch-videos";
import { fetchTranscripts } from "./fetch-transcripts";
import { summarize } from "./summarize";
import { r2Configured, uploadToR2 } from "./upload-r2";
import { log } from "./lib";

async function main() {
  log("=== 1/4 영상 수집 ===");
  const queue = await fetchVideos();
  if (queue.length === 0) {
    log("신규 회의 영상 없음 — 종료");
    return;
  }
  log("=== 2/4 자막 수집 ===");
  await fetchTranscripts();
  log("=== 3/4 요약 ===");
  await summarize();
  if (r2Configured()) {
    log("=== 4/4 Cloudflare R2 아카이브 ===");
    await uploadToR2();
  } else {
    log("=== 4/4 R2 미설정 — 건너뜀 (CLOUDFLARE_ACCOUNT_ID/API_TOKEN 등록 시 자동 업로드) ===");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
