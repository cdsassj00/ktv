import fs from "fs";
import path from "path";

export const ROOT = process.cwd();
export const DATA_DIR = path.join(ROOT, "data");
export const MEETINGS_DIR = path.join(DATA_DIR, "meetings");
export const TRANSCRIPTS_DIR = path.join(DATA_DIR, "transcripts");
export const QUEUE_FILE = path.join(DATA_DIR, "videos-queue.json");

export interface QueueItem {
  videoId: string;
  title: string;
  publishedAt: string; // ISO
  type: "cabinet" | "briefing" | "other";
  duration: number; // 초
  thumbnail: string;
}

export interface TranscriptSegment {
  text: string;
  start: number; // 초
  duration: number;
}

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
}

export function writeJson(file: string, value: unknown) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf-8");
}

/** data/meetings에 이미 저장된 videoId 집합 */
export function existingVideoIds(): Set<string> {
  if (!fs.existsSync(MEETINGS_DIR)) return new Set();
  const ids = new Set<string>();
  for (const f of fs.readdirSync(MEETINGS_DIR)) {
    if (!f.endsWith(".json")) continue;
    const m = readJson<{ videoId?: string }>(path.join(MEETINGS_DIR, f), {});
    if (m.videoId) ids.add(m.videoId);
  }
  return ids;
}

/**
 * 회의의 "내용상 고유 키". videoId가 달라도 같은 회의면 같은 키가 나온다.
 * KTV가 같은 회의를 "수정본"(자막 보정)으로 새 videoId로 재업로드해도
 * 중복 수집되지 않도록, 국무회의는 "제NN회" 번호로, 업무보고는 날짜+부처
 * 나열로 식별한다. (괄호 안 날짜·"수정본" 표기는 제거해 원본과 동일 키로 맞춤)
 */
export function meetingKey(type: string, title: string, date: string): string {
  const clean = title.replace(/\([^)]*\)/g, " ").trim(); // 괄호 안(날짜·수정본 등) 제거
  // 제목에 회의 날짜(YY.M.D)가 있으면 그걸 우선 사용 — 수정본이 다른 날 재업로드돼도
  // 원본과 같은 날짜 키가 되도록. 없으면 넘겨받은 date 사용.
  let mdate = date;
  const dm = title.match(/(\d{2})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
  if (dm) mdate = `20${dm[1]}-${dm[2].padStart(2, "0")}-${dm[3].padStart(2, "0")}`;

  if (type === "cabinet") {
    const m = clean.match(/제\s*(\d+)\s*회/);
    return m ? `cabinet:${m[1]}` : `cabinet:${mdate}`;
  }
  if (type === "briefing") {
    // 부처 나열은 축약형/전체형이 섞이므로, 안정적인 "첫 부처명 + 날짜"로 식별
    const first = clean.split("업무보고")[0].split(/[·,\s]+/).filter(Boolean)[0] ?? "";
    return `briefing:${mdate}:${first}`;
  }
  return `${type}:${mdate}`;
}

/** data/meetings에 이미 저장된 회의 내용키 집합 (수정본 중복 방지용) */
export function existingMeetingKeys(): Set<string> {
  if (!fs.existsSync(MEETINGS_DIR)) return new Set();
  const keys = new Set<string>();
  for (const f of fs.readdirSync(MEETINGS_DIR)) {
    if (!f.endsWith(".json")) continue;
    const m = readJson<{ type?: string; title?: string; date?: string }>(path.join(MEETINGS_DIR, f), {});
    if (m.type && m.title && m.date) keys.add(meetingKey(m.type, m.title, m.date));
  }
  return keys;
}

/**
 * KTV 예능·클립·쇼츠·브이로그처럼 회의 본편이 아닌 영상인가?
 * 이런 제목은 이모지·다중 해시태그·특유의 코너명이 들어가고, 회의 본편
 * 제목("(26.8.4.) 이재명 대통령 제34회 국무회의", "…업무보고｜삶으로 체감하는
 * 대체불가 대한민국")은 이모지·해시태그가 전혀 없다. 그 차이로 걸러낸다.
 */
export function looksLikeClip(title: string): boolean {
  if (/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u.test(title)) return true; // 이모지
  if ((title.match(/#/g) ?? []).length >= 2) return true; // 해시태그 2개 이상
  if (/퀵-?클립|잼플릭스|브이로그|명벤져스|하이라이트|홍보영상|예고편|모아보기|풀영상\s*모음|시즌\s*\d|\[클립\]/.test(title))
    return true;
  return false;
}

/** 제목 기반 회의 분류. 해당 없으면 null (수집 제외) */
export function classifyTitle(title: string): QueueItem["type"] | null {
  if (looksLikeClip(title)) return null; // 예능·클립·쇼츠 제외
  // 국무회의 본편은 "제NN회"가 반드시 붙는다(클립엔 없음)
  if (/국무회의/.test(title) && /제\s*\d+\s*회/.test(title)) return "cabinet";
  if (/업무보고/.test(title)) return "briefing";
  if (/수석.?보좌관|비상경제/.test(title)) return "other";
  return null;
}

/** ISO 8601 duration (PT1H30M5S) → 초 */
export function parseIsoDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** Claude 응답에서 JSON 추출 (코드펜스·전후 설명 제거) */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  if (start === -1) throw new Error(`JSON을 찾을 수 없음: ${text.slice(0, 200)}`);
  return JSON.parse(raw.slice(start)) as T;
}

export function log(msg: string) {
  console.log(`[pipeline] ${msg}`);
}
