/** 회의 유형 */
export type MeetingType = "cabinet" | "briefing" | "other";

/** 발언 종류 */
export type TurnKind = "지시" | "보고" | "답변" | "질문" | "추가질문" | "발언";

export interface AgendaItem {
  title: string;
  summary: string;
  timestamp: number; // 초 단위, 영상 딥링크용
}

export interface Remark {
  speakerId: string;
  quote: string;
  context?: string;
  timestamp: number;
}

export interface ExchangeTurn {
  speakerId: string;
  kind: TurnKind;
  summary: string;
  quote?: string;
  timestamp: number;
  /** 같은 exchange 내에서 몇 번째 turn에 대한 응답인지 (null = 시작 발언) */
  inReplyTo: number | null;
}

export interface Exchange {
  id: string;
  topic: string;
  turns: ExchangeTurn[];
}

export type DirectiveStatus = "issued" | "in_progress" | "reported";

export interface DirectiveFollowUp {
  meetingId: string;
  exchangeId?: string;
  summary: string;
  /** 파이프라인 자동 연결 시 "추정 연결" 표시용 */
  inferred?: boolean;
}

export interface Directive {
  id: string;
  from: string; // speakerId
  to: string[]; // 수명 부처/인물 speakerId
  content: string;
  timestamp: number;
  tags: string[];
  status: DirectiveStatus;
  followUps: DirectiveFollowUp[];
}

export interface AiDataPolicyItem {
  topic: string;
  speakerId: string;
  summary: string;
  quote?: string;
  timestamp: number;
  tags: string[];
}

export interface MeetingSummary {
  oneLine: string;
  overview: string;
  agenda: AgendaItem[];
  remarks: Remark[];
}

export interface Meeting {
  id: string;
  type: MeetingType;
  title: string;
  date: string; // YYYY-MM-DD
  videoId: string;
  videoUrl: string;
  duration: number; // 초
  thumbnail: string;
  summary: MeetingSummary;
  exchanges: Exchange[];
  directives: Directive[];
  aiDataPolicy: AiDataPolicyItem[];
  tags: string[];
  /** 데모용 샘플 데이터 여부 — UI에 배너 표시 */
  sample?: boolean;
}

export interface Speaker {
  name: string;
  role: string;
  org: string;
  photo: string | null;
  photoSource: string | null;
  term?: { from: string; to?: string };
}

export type SpeakerMap = Record<string, Speaker>;

/** 네트워크 뷰 집계 결과 */
export interface NetworkEdge {
  source: string;
  target: string;
  kind: "directive" | "reply" | "mention";
  count: number;
  meetingIds: string[];
}

export interface NetworkNode {
  speakerId: string;
  turnCount: number;
}
