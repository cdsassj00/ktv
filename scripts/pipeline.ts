/**
 * 전체 파이프라인: 영상 수집 → 자막 수집 → 요약.
 * 필요 환경변수: YOUTUBE_API_KEY, ANTHROPIC_API_KEY
 */
import { fetchVideos } from "./fetch-videos";
import { fetchTranscripts } from "./fetch-transcripts";
import { summarize } from "./summarize";
import { findPhotos } from "./find-photos";
import { r2Configured, uploadToR2 } from "./upload-r2";
import { log } from "./lib";

async function main() {
  log("=== 1/5 영상 수집 ===");
  const queue = await fetchVideos();
  if (queue.length === 0) {
    log("신규 회의 영상 없음 — 자막·요약 건너뜀");
  } else {
    log("=== 2/5 자막 수집 ===");
    await fetchTranscripts();
    log("=== 3/5 요약 ===");
    await summarize();
  }
  log("=== 4/5 발언자 사진 수색 ===");
  try {
    await findPhotos();
  } catch (e) {
    // 사진 수색은 부가 기능 — 실패해도 파이프라인은 계속
    console.warn("[pipeline] 사진 수색 실패(계속 진행):", e);
  }
  if (r2Configured()) {
    log("=== 5/5 Cloudflare R2 아카이브 ===");
    try {
      await uploadToR2();
    } catch (e) {
      // R2는 보조 아카이브 — 실패해도 수집·요약 결과 커밋은 막지 않는다
      console.warn("[pipeline] R2 업로드 실패(계속 진행):", e);
    }
  } else {
    log("=== 5/5 R2 미설정 — 건너뜀 (CLOUDFLARE_ACCOUNT_ID/API_TOKEN 등록 시 자동 업로드) ===");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
