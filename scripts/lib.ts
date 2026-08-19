import fs from "fs";
import path from "path";

export const ROOT = process.cwd();
export const DATA_DIR = path.join(ROOT, "data");
export const MEETINGS_DIR = path.join(DATA_DIR, "meetings");
export const TRANSCRIPTS_DIR = path.join(DATA_DIR, "transcripts");
export const QUEUE_FILE = path.join(DATA_DIR, "videos-queue.json");

/** 같은 회의를 다룬 다른 공식 채널 영상(참고용 provenance). */
export interface MeetingSource {
  videoId: string;
  title: string;
  channelTitle: string;
  url: string;
}

export interface QueueItem {
  videoId: string;
  title: string;
  publishedAt: string; // ISO
  type: "cabinet" | "briefing" | "other";
  duration: number; // 초
  thumbnail: string;
  /** 요약에 쓴 primary 영상 채널명(있으면 표기·판단에 사용) */
  channelTitle?: string;
  /** 같은 회의의 다른 공식 영상들(요약엔 안 쓰고 출처로만 남긴다) */
  sources?: MeetingSource[];
}

export interface SourceChannel {
  id: string;
  title: string;
  primary?: boolean;
}

/** data/source-channels.json 의 공식 채널 allowlist를 읽는다(없으면 KTV만). */
export function sourceChannels(): SourceChannel[] {
  const cfg = readJson<{ channels?: SourceChannel[] }>(
    path.join(DATA_DIR, "source-channels.json"),
    {}
  );
  const list = (cfg.channels ?? []).filter((c) => c && c.id && c.title);
  return list.length
    ? list
    : [{ id: "UCIMOytYIzaUpoAM2bpT4JZQ", title: "KTV 국민방송", primary: true }];
}

/**
 * 국무회의 영상이 "그 회차 본편"이 맞는지 엄격 검증한다.
 * (1) 클립·쇼츠 아님, (2) 제목에 '국무회의' + '제N회', (3) 업로드 연도가 기대 연도 이상.
 * 회차 번호는 매년 리셋되므로 연도 검증이 작년 것 혼입을 막는 핵심 안전장치다.
 */
export function verifyCabinetVideo(
  title: string,
  number: number,
  expectYear: number,
  publishedAt: string
): boolean {
  if (looksLikeClip(title)) return false;
  if (!/국무회의/.test(title)) return false;
  if (!new RegExp(`제\\s*${number}\\s*회`).test(title)) return false;
  const yr = Number(publishedAt.slice(0, 4));
  if (Number.isFinite(yr) && yr < expectYear) return false;
  return true;
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
    // 회차 번호는 매년 리셋되므로(2025 제32회 ≠ 2026 제32회) 연도를 함께 키에 넣어
    // 해를 넘긴 같은 번호의 회의가 서로 중복으로 오인돼 버려지지 않게 한다.
    const year = mdate.slice(0, 4);
    const m = clean.match(/제\s*(\d+)\s*회/);
    return m ? `cabinet:${year}:${m[1]}` : `cabinet:${mdate}`;
  }
  if (type === "briefing") {
    // 부처 나열은 축약형/전체형이 섞이므로, 안정적인 "첫 부처명 + 날짜"로 식별
    const first = clean.split("업무보고")[0].split(/[·,\s]+/).filter(Boolean)[0] ?? "";
    return `briefing:${mdate}:${first}`;
  }
  return `${type}:${mdate}`;
}

/**
 * "회차 번호 콕집기"의 기준점 — 현재 진행 중인 시리즈의 최신 회차 번호.
 *
 * 국무회의 번호는 매년(행정부 기준) 리셋된다: 2025년은 제32~56회, 2026년은
 * 제2~31회로 번호대가 겹친다. 따라서 전체 최고 번호(56)를 기준으로 삼으면
 * 엉뚱한 제57회를 찾게 된다. 대신 "가장 최근 연도"의 최대 회차 번호를
 * 반환해, 그 다음 번호(현재 시리즈의 다음 회의)를 정확히 겨냥한다.
 * 반환값: { year, number } (데이터 없으면 number 0).
 */
export function latestCabinetNumber(): { year: number; number: number } {
  if (!fs.existsSync(MEETINGS_DIR)) return { year: 0, number: 0 };
  const byYear = new Map<number, number>(); // year -> max number
  for (const f of fs.readdirSync(MEETINGS_DIR)) {
    if (!f.endsWith(".json")) continue;
    const m = readJson<{ type?: string; title?: string; date?: string }>(path.join(MEETINGS_DIR, f), {});
    if (m.type !== "cabinet" || !m.title || !m.date) continue;
    const num = m.title.match(/제\s*(\d+)\s*회/);
    if (!num) continue;
    const year = Number(m.date.slice(0, 4));
    byYear.set(year, Math.max(byYear.get(year) ?? 0, Number(num[1])));
  }
  if (byYear.size === 0) return { year: 0, number: 0 };
  const year = Math.max(...byYear.keys());
  return { year, number: byYear.get(year) ?? 0 };
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

/**
 * 잘린 JSON 복구: LLM 출력이 토큰 한도에서 잘려 문자열·배열이 미완성일 때,
 * 마지막으로 "완결된 요소"까지만 남기고 열린 괄호를 닫아 유효한 JSON으로 만든다.
 * 예: {"segments":[{..},{..},{..←잘림  →  {"segments":[{..},{..}]}
 * 복구 지점이 없으면 null.
 */
function closeTruncatedJson(s: string): string | null {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  let cut = -1;
  let cutStack: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") {
      stack.pop();
      cut = i + 1; // 컨테이너가 닫힌 직후 = 안전한 절단 지점
      cutStack = [...stack];
    }
  }
  if (cut === -1) return null;
  return s.slice(0, cut) + cutStack.reverse().join("");
}

/** Claude 응답에서 JSON 추출 (코드펜스·전후 설명 제거, 토큰 한도로 잘린 경우 복구) */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  if (start === -1) throw new Error(`JSON을 찾을 수 없음: ${text.slice(0, 200)}`);
  const body = raw.slice(start);
  try {
    return JSON.parse(body) as T;
  } catch {
    // 토큰 한도로 잘린 응답이면 완결된 요소까지 살려 복구
    const repaired = closeTruncatedJson(body);
    if (repaired) return JSON.parse(repaired) as T;
    throw new Error(`JSON 파싱 실패(복구 불가): …${body.slice(-120)}`);
  }
}

export function log(msg: string) {
  console.log(`[pipeline] ${msg}`);
}
