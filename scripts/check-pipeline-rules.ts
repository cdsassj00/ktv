/**
 * 파이프라인 규칙 자기점검 — `npm run check:rules`
 *
 * 이 파이프라인의 사고는 조용히 일어난다. 제목 필터가 본편을 클립으로 판정하면
 * 수집이 0건으로 끝나고(2026-09 제39·40회 누락), 명부가 전임자를 걸러내지 못하면
 * 요약에 전임 총리 실명이 현직처럼 실린다(제39회 요약). 둘 다 실패가 아니라
 * "정상 종료"로 보이므로, 규칙을 손댈 때 돌려볼 표본을 여기에 박아둔다.
 */
import fs from "node:fs";
import path from "node:path";
import { classifyTitle, DATA_DIR, log, looksLikeClip, MEETINGS_DIR, readJson, verifyCabinetVideo } from "./lib";

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

// ── 명부 날짜 필터 ────────────────────────────────────────────────
// 요약 프롬프트에 주입되는 명부는 회의 날짜 기준 재직자만 담아야 한다.
// term(재임 기간)이 비어 있으면 필터가 작동할 수 없으므로 총리 항목은 필수로 본다.
type Term = { from: string; to?: string };
const roster = readJson<Record<string, { name: string; role: string; term?: Term }>>(
  path.join(DATA_DIR, "speakers.json"),
  {}
);
const servesOn = (t: Term | undefined, date: string) =>
  !t || ((!t.from || date >= t.from) && (!t.to || date <= t.to));

const pmIds = Object.keys(roster).filter((id) => /국무총리/.test(roster[id]?.role ?? ""));
for (const id of pmIds) {
  if (!roster[id].term) {
    log(`FAIL 총리 항목 ${id}(${roster[id].name})에 term(재임 기간)이 없음 — 날짜 필터가 무력화된다`);
    failed++;
  }
}
// 회의 날짜별로 '국무총리'는 정확히 한 명이어야 한다(공백·중복 모두 사고)
for (const date of ["2026-01-27", "2026-06-30", "2026-07-14", "2026-09-08"]) {
  const serving = pmIds.filter((id) => servesOn(roster[id].term, date));
  if (serving.length !== 1) {
    log(`FAIL ${date} 기준 재직 총리가 ${serving.length}명 (${serving.join(", ") || "없음"})`);
    failed++;
  }
}

// ── 정부조직 개편(부처명) ────────────────────────────────────────
// 명부의 부처명이 낡으면 요약에 옛 이름이 그대로 실린다(2026-09 제39회 요약이
// 자막에 없는 "여성가족부"를 쓴 사례). 명부는 항상 현재 명칭이어야 하고,
// 시행일 이후 회의 요약에도 옛 명칭이 남아 있으면 안 된다.
const RENAMES: { effective: string; old: RegExp; oldName: string; now: string }[] = [
  { effective: "2025-10-01", old: /(?<!성평등)여성가족부/, oldName: "여성가족부", now: "성평등가족부" },
  { effective: "2025-10-01", old: /(?<!기후에너지)환경부/, oldName: "환경부", now: "기후에너지환경부" },
  { effective: "2025-10-01", old: /산업통상자원부/, oldName: "산업통상자원부", now: "산업통상부" },
  { effective: "2026-01-02", old: /기획재정부/, oldName: "기획재정부", now: "재정경제부" },
];

for (const [id, s] of Object.entries(roster)) {
  const text = `${s.role ?? ""} ${(s as { org?: string }).org ?? ""}`;
  for (const r of RENAMES) {
    if (r.old.test(text)) {
      log(`FAIL 명부 ${id}(${s.name})에 옛 부처명 "${r.oldName}" — 현재 명칭은 "${r.now}"`);
      failed++;
    }
  }
}

for (const file of fs.readdirSync(MEETINGS_DIR)) {
  if (!file.endsWith(".json")) continue;
  const m = readJson<{ date?: string }>(path.join(MEETINGS_DIR, file), {});
  const body = fs.readFileSync(path.join(MEETINGS_DIR, file), "utf-8");
  for (const r of RENAMES) {
    if ((m.date ?? "") >= r.effective && r.old.test(body)) {
      log(`FAIL ${file}(${m.date})에 옛 부처명 "${r.oldName}" — 시행 ${r.effective} 이후이므로 "${r.now}"`);
      failed++;
    }
  }
}

if (failed) {
  log(`파이프라인 규칙 점검 실패 ${failed}건`);
  process.exit(1);
}
log(
  `파이프라인 규칙 점검 통과 (제목: 채택 ${ACCEPT.length} / 제외 ${REJECT.length} + 회차·연도, 명부: 총리 ${pmIds.length}명 재임기간·날짜별 유일성, 부처명: 개편 ${RENAMES.length}건 시행일 기준)`
);
