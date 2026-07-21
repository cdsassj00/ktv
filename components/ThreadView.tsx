"use client";

import type { Exchange, SpeakerMap } from "@/lib/types";
import { formatTime, TURN_KIND_STYLE } from "@/lib/utils";
import SpeakerAvatar from "./SpeakerAvatar";
import { UNKNOWN_SPEAKER } from "@/lib/client-data";

/** inReplyTo 체인 깊이 계산 (들여쓰기용, 최대 3단) */
function turnDepth(ex: Exchange, index: number): number {
  let depth = 0;
  let cur = ex.turns[index];
  while (cur.inReplyTo !== null && depth < 3) {
    depth += 1;
    cur = ex.turns[cur.inReplyTo];
    if (!cur) break;
  }
  return depth;
}

/**
 * 발언 스레드 뷰 — 메신저형 말풍선.
 * 답변은 들여쓰기 + 연결선으로 표시, 말풍선 클릭 시 해당 타임스탬프 재생.
 */
export default function ThreadView({
  exchanges,
  speakers,
  onSeek,
  canSeek,
}: {
  exchanges: Exchange[];
  speakers: SpeakerMap;
  onSeek: (t: number) => void;
  canSeek: boolean;
}) {
  if (exchanges.length === 0) {
    return <p className="text-[15px] text-mut">재구성된 발언 스레드가 없습니다.</p>;
  }
  return (
    <div className="space-y-4">
      {exchanges.map((ex, exIdx) => (
        <details key={ex.id} id={ex.id} open={exIdx === 0} className="panel group/ex p-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
            <span className="rounded-full bg-tint2 px-2 py-0.5 text-[13px] font-semibold text-mut">주제</span>
            <span className="flex-1">{ex.topic}</span>
            <span className="text-[12.5px] font-medium text-faint">발언 {ex.turns.length}</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-4 shrink-0 text-mut transition-transform group-open/ex:rotate-180"
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          <div className="mt-3 space-y-3">
            {ex.turns.map((turn, i) => {
              const speaker = speakers[turn.speakerId] ?? UNKNOWN_SPEAKER;
              const kind = TURN_KIND_STYLE[turn.kind] ?? TURN_KIND_STYLE["발언"];
              const depth = turnDepth(ex, i);
              return (
                <div
                  key={i}
                  className="relative flex gap-3"
                  style={{ marginLeft: depth * 28 }}
                >
                  {depth > 0 && (
                    <span
                      aria-hidden
                      className="absolute -left-4 top-0 h-5 w-3 rounded-bl-lg border-b-2 border-l-2 border-hair"
                    />
                  )}
                  <SpeakerAvatar speaker={speaker} size="md" />
                  <button
                    type="button"
                    onClick={() => canSeek && onSeek(turn.timestamp)}
                    disabled={!canSeek}
                    className={`bubble flex-1 ${canSeek ? "bubble-clickable cursor-pointer" : "cursor-default"}`}
                    title={canSeek ? "클릭하면 영상이 해당 시점으로 이동합니다" : undefined}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-semibold text-ink">{speaker.name}</span>
                      <span className="text-[13px] text-mut">{speaker.role}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[12px] font-medium ${kind.className}`}>
                        {kind.label}
                      </span>
                      <span className="ml-auto font-mono text-[12px] text-faint">
                        ▶ {formatTime(turn.timestamp)}
                      </span>
                    </div>
                    <p className="text-[15px] text-body">{turn.summary}</p>
                    {turn.quote && (
                      <p className="mt-1.5 border-l-2 border-accent-400 pl-2 text-[15px] italic text-body">
                        “{turn.quote}”
                      </p>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}
