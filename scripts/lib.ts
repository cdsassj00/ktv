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

/** 제목 기반 회의 분류. 해당 없으면 null (수집 제외) */
export function classifyTitle(title: string): QueueItem["type"] | null {
  if (/국무회의/.test(title)) return "cabinet";
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
