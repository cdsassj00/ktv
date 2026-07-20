/** 초 → "1:23:45" 또는 "23:45" */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "2026-07-15" → "2026년 7월 15일 (화)" — 서버 타임존과 무관하게 문자열 기준으로 계산 */
export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${y}년 ${m}월 ${d}일 (${days[dow]})`;
}

export const MEETING_TYPE_LABEL: Record<string, string> = {
  cabinet: "국무회의",
  briefing: "국민업무보고",
  other: "기타 회의",
};

/* 색은 관계·상태 표현 전용 — 지시=코랄, 보고=블루, 답변=그린, 질문=골드 (ssjhtml3 시맨틱) */
export const TURN_KIND_STYLE: Record<string, { label: string; className: string }> = {
  지시: { label: "지시", className: "border-accent-500/40 bg-[#f7ecec] text-accent-600" },
  보고: { label: "보고", className: "border-navy-500/40 bg-[#ecf0f7] text-navy-500" },
  답변: { label: "답변", className: "border-green-600/40 bg-[#eaf3ee] text-green-600" },
  질문: { label: "질문", className: "border-gold-500/50 bg-[#faf3e4] text-gold-500" },
  추가질문: { label: "추가질문", className: "border-gold-500/50 bg-[#faf3e4] text-gold-500" },
  발언: { label: "발언", className: "border-hair bg-tint text-body" },
};

export const DIRECTIVE_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  issued: { label: "지시됨", className: "border-accent-500/40 bg-[#f7ecec] text-accent-600" },
  in_progress: { label: "진행 중", className: "border-gold-500/50 bg-[#faf3e4] text-gold-500" },
  reported: { label: "후속보고 확인", className: "border-green-600/40 bg-[#eaf3ee] text-green-600" },
};

/** YouTube 타임스탬프 딥링크 */
export function youtubeUrlAt(videoId: string, seconds: number): string {
  return `https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(seconds)}s`;
}
