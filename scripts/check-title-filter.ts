/**
 * 제목 필터 자기점검 — `npm run check:titles`
 *
 * 수집 누락은 대부분 "KTV가 제목 규칙을 바꿨는데 필터가 본편을 클립으로 판정"해서
 * 조용히 0건으로 끝나는 식으로 발생한다(2026-09 제39·40회 누락). 실제로 관측된
 * 제목을 표본으로 박아두고, 필터를 손댈 때 이 점검을 돌려 회귀를 잡는다.
 */
import { classifyTitle, log, looksLikeClip, verifyCabinetVideo } from "./lib";

/** 국무회의 본편으로 채택되어야 하는 실제 제목 */
const ACCEPT = [
  // 예능형 제목으로 바뀐 뒤의 본편 (2026-09, 한성숙 총리 주재)
  "#대통령 너무 바쁜 중에도 맘 편한 이유?! #한성숙 총리와 명벤져스들이 작정하고 일한 제40회 #국무회의 풀영상! #명벤져스",
  "신속! 혁신! #대통령 빈자리 채우며 총리가 강하게 당부한 내용은?! 제39회 #국무회의 풀버전 #명벤져스",
  // 종전 형식의 본편
  "(2026년 9월 1일 자막 생중계) 이재명 대통령 제38회 국무회의",
  "(26.8.11.) 이재명 대통령 제35회 국무회의",
];

/** 국무회의 본편이 아니므로 제외되어야 하는 실제/유사 제목 */
const REJECT = [
  "문 대통령, 추석특별방역에 만전을 기하겠습니다! 제40회 국무회의 풀버전 모아보기",
  "제39회 국무회의 하이라이트 풀영상",
  "규제 풀린 태릉CC 부지, 한성숙 총리 찾아가 주택공급 총력! #명벤져스",
  "[퀵클립] 국무회의에서 대통령이 강조한 세 가지",
];

let failed = 0;

for (const title of ACCEPT) {
  if (looksLikeClip(title) || classifyTitle(title) !== "cabinet") {
    log(`FAIL 본편인데 제외됨: ${title}`);
    failed++;
  }
}
for (const title of REJECT) {
  if (!looksLikeClip(title) && classifyTitle(title) === "cabinet") {
    log(`FAIL 클립인데 채택됨: ${title}`);
    failed++;
  }
}

// 회차·연도 교차검증 — 번호가 매년 리셋되므로 작년 같은 번호는 반드시 배제된다
const full40 = ACCEPT[0];
if (!verifyCabinetVideo(full40, 40, 2026, "2026-09-15T10:00:00Z")) {
  log("FAIL 제40회/2026 본편이 회차검증을 통과하지 못함");
  failed++;
}
if (verifyCabinetVideo(full40, 40, 2026, "2025-09-02T10:00:00Z")) {
  log("FAIL 작년(2025) 업로드가 2026 제40회로 채택됨");
  failed++;
}

if (failed) {
  log(`제목 필터 점검 실패 ${failed}건`);
  process.exit(1);
}
log(`제목 필터 점검 통과 (채택 ${ACCEPT.length}건 / 제외 ${REJECT.length}건 + 회차·연도 검증)`);
