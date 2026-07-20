import fs from "fs";
import path from "path";
import type {
  AiDataPolicyItem,
  Directive,
  Meeting,
  NetworkEdge,
  NetworkNode,
  Speaker,
  SpeakerMap,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const MEETINGS_DIR = path.join(DATA_DIR, "meetings");

let meetingsCache: Meeting[] | null = null;
let speakersCache: SpeakerMap | null = null;

/** 모든 회의를 날짜 내림차순으로 로드 (빌드 시 1회 캐시) */
export function getMeetings(): Meeting[] {
  if (meetingsCache) return meetingsCache;
  if (!fs.existsSync(MEETINGS_DIR)) return [];
  const files = fs.readdirSync(MEETINGS_DIR).filter((f) => f.endsWith(".json"));
  const meetings = files.map(
    (f) => JSON.parse(fs.readFileSync(path.join(MEETINGS_DIR, f), "utf-8")) as Meeting
  );
  meetings.sort((a, b) => (a.date < b.date ? 1 : -1));
  meetingsCache = meetings;
  return meetings;
}

export function getMeeting(id: string): Meeting | undefined {
  return getMeetings().find((m) => m.id === id);
}

export function getSpeakers(): SpeakerMap {
  if (speakersCache) return speakersCache;
  const file = path.join(DATA_DIR, "speakers.json");
  speakersCache = fs.existsSync(file)
    ? (JSON.parse(fs.readFileSync(file, "utf-8")) as SpeakerMap)
    : {};
  return speakersCache;
}

export function getSpeaker(id: string): Speaker | undefined {
  return getSpeakers()[id];
}

export { UNKNOWN_SPEAKER } from "./client-data";

/** 모든 회의의 지시를 최신순으로 */
export function getAllDirectives(): { meeting: Meeting; directive: Directive }[] {
  const out: { meeting: Meeting; directive: Directive }[] = [];
  for (const meeting of getMeetings()) {
    for (const directive of meeting.directives) out.push({ meeting, directive });
  }
  return out;
}

/** 모든 회의의 AI·데이터 정책 발언을 최신순으로 */
export function getAllAiDataPolicy(): { meeting: Meeting; item: AiDataPolicyItem }[] {
  const out: { meeting: Meeting; item: AiDataPolicyItem }[] = [];
  for (const meeting of getMeetings()) {
    for (const item of meeting.aiDataPolicy) out.push({ meeting, item });
  }
  return out;
}

/** AI·데이터 정책 태그 전체 (빈도순) */
export function getAiDataPolicyTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const { item } of getAllAiDataPolicy()) {
    for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/** 월별 AI·데이터 발언 수 (추이 차트용) */
export function getMonthlyAiDataCounts(): { month: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const { meeting, item } of getAllAiDataPolicy()) {
    void item;
    const month = meeting.date.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => (a.month < b.month ? -1 : 1));
}

/** 특정 발언자의 회의별 발언 이력 */
export function getSpeakerHistory(speakerId: string) {
  const history: {
    meeting: Meeting;
    turns: { exchangeId: string; topic: string; kind: string; summary: string; timestamp: number }[];
  }[] = [];
  for (const meeting of getMeetings()) {
    const turns: (typeof history)[number]["turns"] = [];
    for (const ex of meeting.exchanges) {
      for (const t of ex.turns) {
        if (t.speakerId === speakerId)
          turns.push({
            exchangeId: ex.id,
            topic: ex.topic,
            kind: t.kind,
            summary: t.summary,
            timestamp: t.timestamp,
          });
      }
    }
    if (turns.length > 0) history.push({ meeting, turns });
  }
  return history;
}

/** 회의(들)에서 네트워크 노드·엣지 집계. meetingId 없으면 전체 누적 */
export function buildNetwork(meetingId?: string): { nodes: NetworkNode[]; edges: NetworkEdge[] } {
  const meetings = meetingId
    ? getMeetings().filter((m) => m.id === meetingId)
    : getMeetings();

  const nodeCounts = new Map<string, number>();
  const edgeMap = new Map<string, NetworkEdge>();

  const addEdge = (source: string, target: string, kind: NetworkEdge["kind"], mid: string) => {
    if (source === target) return;
    const key = `${source}→${target}:${kind}`;
    const existing = edgeMap.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.meetingIds.includes(mid)) existing.meetingIds.push(mid);
    } else {
      edgeMap.set(key, { source, target, kind, count: 1, meetingIds: [mid] });
    }
  };

  for (const meeting of meetings) {
    for (const ex of meeting.exchanges) {
      for (const t of ex.turns) {
        nodeCounts.set(t.speakerId, (nodeCounts.get(t.speakerId) ?? 0) + 1);
        if (t.inReplyTo !== null && ex.turns[t.inReplyTo]) {
          const parent = ex.turns[t.inReplyTo];
          addEdge(t.speakerId, parent.speakerId, "reply", meeting.id);
        }
      }
    }
    for (const d of meeting.directives) {
      nodeCounts.set(d.from, nodeCounts.get(d.from) ?? 0);
      for (const to of d.to) {
        nodeCounts.set(to, nodeCounts.get(to) ?? 0);
        addEdge(d.from, to, "directive", meeting.id);
      }
    }
  }

  return {
    nodes: [...nodeCounts.entries()].map(([speakerId, turnCount]) => ({ speakerId, turnCount })),
    edges: [...edgeMap.values()],
  };
}
