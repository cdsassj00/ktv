/**
 * 자막을 Claude로 map-reduce 요약해 data/meetings/*.json 을 생성한다.
 *
 * 1) map    — 15분 단위 청크별로 발언 단위 분리 + 화자 추론 (speakers.json 명부 주입)
 * 2) reduce — 청크 결과를 통합해 구조화 요약(안건/발언 스레드/지시/AI·데이터 정책) 생성
 * 3) link   — 기존 회의의 미결 지시와 새 회의 내용을 대조해 후속 보고를 "추정 연결"
 *
 * 필요 환경변수: ANTHROPIC_API_KEY
 * 선택 환경변수: ANTHROPIC_MODEL(기본 claude-sonnet-5), MAX_MEETINGS(1회 실행당 처리 수, 기본 3)
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import Anthropic from "@anthropic-ai/sdk";
import {
  DATA_DIR,
  extractJson,
  log,
  MEETINGS_DIR,
  QUEUE_FILE,
  QueueItem,
  readJson,
  TRANSCRIPTS_DIR,
  TranscriptSegment,
  writeJson,
} from "./lib";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
const CHUNK_SECONDS = 900; // 15분
const client = new Anthropic();

interface MappedSegment {
  speakerId: string | null;
  kind: "지시" | "보고" | "답변" | "질문" | "추가질문" | "발언";
  summary: string;
  quote?: string;
  timestamp: number;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function chunkTranscript(segments: TranscriptSegment[]): { start: number; text: string }[] {
  const chunks: { start: number; text: string }[] = [];
  let cur: string[] = [];
  let curStart = 0;
  for (const seg of segments) {
    if (cur.length === 0) curStart = seg.start;
    cur.push(`[${fmtTime(seg.start)}] ${seg.text}`);
    if (seg.start - curStart >= CHUNK_SECONDS) {
      chunks.push({ start: curStart, text: cur.join("\n") });
      cur = [];
    }
  }
  if (cur.length > 0) chunks.push({ start: curStart, text: cur.join("\n") });
  return chunks;
}

async function ask(prompt: string, maxTokens: number): Promise<string> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function speakerRoster(): string {
  const speakers = readJson<Record<string, { name: string; role: string; org: string }>>(
    path.join(DATA_DIR, "speakers.json"),
    {}
  );
  return Object.entries(speakers)
    .map(([id, s]) => `- ${id}: ${s.name} (${s.role}, ${s.org})`)
    .join("\n");
}

async function mapChunk(item: QueueItem, chunk: { start: number; text: string }, roster: string) {
  const prompt = `당신은 한국 정부 회의 영상의 자동자막을 분석하는 전문가입니다.
아래는 "${item.title}" 영상의 자막 일부입니다. 자동자막이라 오탈자·인명 오인식이 있을 수 있으니 문맥으로 보정하세요.

## 국무위원 명부 (화자 추론에 사용, speakerId는 반드시 이 목록의 키만 사용)
${roster}

## 자막 ([분:초] 표시 포함)
${chunk.text}

## 지시
자막을 의미 있는 발언 단위로 분리하고 각 발언에 대해 다음을 판단하세요:
- speakerId: 명부에서 추론. 문맥상 확신할 수 없으면 null (추측 금지)
- kind: "지시" | "보고" | "답변" | "질문" | "추가질문" | "발언"
- summary: 발언 요지 1~2문장
- quote: 핵심 직접 인용 (자막 오탈자를 보정한 문장, 중요 발언에만)
- timestamp: 발언 시작 시점(초 단위 정수)

또한 AI·데이터 정책(AI 기본법, 인공지능 산업, 데이터 개방·거버넌스, 디지털 정책 등)과 관련된 발언이 있으면 표시하세요.

JSON만 출력:
{"segments":[{"speakerId":"...","kind":"...","summary":"...","quote":"...","timestamp":0}],"aiDataRelated":[0,2]}
(aiDataRelated는 AI·데이터 정책 관련 segments의 인덱스 배열)`;
  const text = await ask(prompt, 4000);
  return extractJson<{ segments: MappedSegment[]; aiDataRelated: number[] }>(text);
}

async function reduceMeeting(
  item: QueueItem,
  mapped: { segments: MappedSegment[]; aiDataRelated: number[] }[],
  roster: string
) {
  const allSegments = mapped.flatMap((m) => m.segments);
  const aiFlagged = mapped.flatMap((m) => m.aiDataRelated.map((i) => m.segments[i]).filter(Boolean));
  const date = item.publishedAt.slice(0, 10);
  const id = `${date}-${item.type}-${item.videoId.slice(0, 6)}`;

  const prompt = `당신은 한국 정부 회의 요약 전문가입니다. "${item.title}" (${date}) 회의의 발언 분석 결과를 통합해 최종 구조화 요약을 만드세요.

## 국무위원 명부
${roster}

## 발언 분석 결과 (시간순)
${JSON.stringify(allSegments, null, 1)}

## AI·데이터 정책 관련으로 표시된 발언
${JSON.stringify(aiFlagged, null, 1)}

## 출력 규칙
- 모든 항목에 timestamp(초, 위 분석 결과의 값 사용) 필수 — 임의로 지어내지 말 것
- exchanges: 발언들을 "지시→답변→추가질문"처럼 실제로 주고받은 대화 단위로 묶기. 연결이 불확실하면 묶지 말 것. turns[].inReplyTo 는 같은 exchange 안에서 응답 대상 turn의 인덱스(시작 발언은 null)
- directives: 대통령·총리의 명시적 지시만 추출. from/to는 명부의 speakerId
- aiDataPolicy: AI·데이터 정책 발언 정리. tags는 다음 중에서 선택하되 필요시 추가: AI기본법, 규제, 데이터거버넌스, 공공데이터, AI예산, 인재양성, AI인프라, 데이터산업
- speakerId를 확신할 수 없는 발언은 "unknown" 사용
- 요약은 중립적·사실적으로. 자막에 없는 내용을 지어내지 말 것

JSON만 출력 (스키마):
{
  "id": "${id}",
  "type": "${item.type}",
  "title": "회의 공식 명칭 (제목에서 추출, 예: 제56회 국무회의)",
  "date": "${date}",
  "summary": {
    "oneLine": "한 줄 요약",
    "overview": "3~5문단 전체 요약 (문단은 \\n\\n 구분)",
    "agenda": [{"title":"안건명","summary":"...","timestamp":0}],
    "remarks": [{"speakerId":"...","quote":"...","context":"...","timestamp":0}]
  },
  "exchanges": [{"id":"ex-01","topic":"...","turns":[{"speakerId":"...","kind":"지시","summary":"...","quote":"...","timestamp":0,"inReplyTo":null}]}],
  "directives": [{"id":"dir-${date}-01","from":"...","to":["..."],"content":"...","timestamp":0,"tags":["..."],"status":"issued","followUps":[]}],
  "aiDataPolicy": [{"topic":"...","speakerId":"...","summary":"...","quote":"...","timestamp":0,"tags":["..."]}],
  "tags": ["..."]
}`;
  const text = await ask(prompt, 8000);
  const meeting = extractJson<Record<string, unknown>>(text);
  return {
    ...meeting,
    id,
    type: item.type,
    date,
    videoId: item.videoId,
    videoUrl: `https://youtu.be/${item.videoId}`,
    duration: item.duration,
    thumbnail: item.thumbnail,
  };
}

/** 기존 회의의 미결 지시 ↔ 새 회의의 후속 보고 자동 연결 */
async function linkFollowUps(newMeeting: Record<string, unknown>) {
  if (!fs.existsSync(MEETINGS_DIR)) return;
  type MeetingFile = {
    file: string;
    data: {
      id: string;
      date: string;
      directives?: {
        id: string;
        to: string[];
        content: string;
        status: string;
        followUps: unknown[];
      }[];
    };
  };
  const open: { meeting: MeetingFile; dirIndex: number }[] = [];
  const files: MeetingFile[] = fs
    .readdirSync(MEETINGS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({
      file: path.join(MEETINGS_DIR, f),
      data: readJson<MeetingFile["data"]>(path.join(MEETINGS_DIR, f), { id: "", date: "" }),
    }));
  for (const mf of files) {
    if (mf.data.id === newMeeting.id || (mf.data.date as string) >= (newMeeting.date as string)) continue;
    (mf.data.directives ?? []).forEach((d, i) => {
      if (d.status !== "reported") open.push({ meeting: mf, dirIndex: i });
    });
  }
  if (open.length === 0) return;

  const prompt = `이전 회의들의 미결 지시 목록과 새 회의의 내용입니다. 새 회의에서 각 지시에 대한 후속 보고가 있었는지 판단하세요. 확신이 없으면 매칭하지 마세요.

## 미결 지시
${JSON.stringify(open.map((o, i) => ({ index: i, content: o.meeting.data.directives![o.dirIndex].content, to: o.meeting.data.directives![o.dirIndex].to })), null, 1)}

## 새 회의 (${newMeeting.date})
${JSON.stringify({ exchanges: newMeeting.exchanges, summary: newMeeting.summary }, null, 1)}

JSON만 출력: {"matches":[{"index":0,"exchangeId":"ex-01","summary":"후속 보고 내용 한 줄"}]}
(매칭 없으면 {"matches":[]})`;
  const text = await ask(prompt, 2000);
  const { matches } = extractJson<{ matches: { index: number; exchangeId?: string; summary: string }[] }>(text);

  const touched = new Set<string>();
  for (const m of matches) {
    const target = open[m.index];
    if (!target) continue;
    const d = target.meeting.data.directives![target.dirIndex];
    d.status = "reported";
    d.followUps.push({
      meetingId: newMeeting.id,
      exchangeId: m.exchangeId,
      summary: m.summary,
      inferred: true,
    });
    touched.add(target.meeting.file);
    log(`지시-후속보고 연결(추정): "${d.content.slice(0, 40)}…" → ${newMeeting.id}`);
  }
  for (const mf of files) {
    if (touched.has(mf.file)) writeJson(mf.file, mf.data);
  }
}

export async function summarize(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY 환경변수가 필요합니다.");
  const queue = readJson<QueueItem[]>(QUEUE_FILE, []);
  const maxMeetings = Number(process.env.MAX_MEETINGS ?? 3);
  const roster = speakerRoster();
  let processed = 0;
  const remaining: QueueItem[] = [];

  for (const item of queue) {
    const transcriptFile = path.join(TRANSCRIPTS_DIR, `${item.videoId}.json`);
    if (!fs.existsSync(transcriptFile) || processed >= maxMeetings) {
      remaining.push(item);
      continue;
    }
    const segments = readJson<TranscriptSegment[]>(transcriptFile, []);
    if (segments.length === 0) {
      remaining.push(item);
      continue;
    }

    log(`요약 시작: ${item.title}`);
    const chunks = chunkTranscript(segments);
    log(`  청크 ${chunks.length}개 (15분 단위)`);
    const mapped = [];
    for (const [i, chunk] of chunks.entries()) {
      log(`  map ${i + 1}/${chunks.length}…`);
      mapped.push(await mapChunk(item, chunk, roster));
    }
    log("  reduce…");
    const meeting = await reduceMeeting(item, mapped, roster);
    const date = item.publishedAt.slice(0, 10);
    const outFile = path.join(MEETINGS_DIR, `${date}_${item.type}-${item.videoId.slice(0, 6)}.json`);
    writeJson(outFile, meeting);
    log(`  저장: ${outFile}`);

    log("  지시-후속보고 연결 검사…");
    await linkFollowUps(meeting as Record<string, unknown>);
    processed += 1;
  }

  writeJson(QUEUE_FILE, remaining);
  log(`완료: ${processed}건 요약, ${remaining.length}건 큐에 남음`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  summarize().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
