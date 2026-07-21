"use client";

import { useEffect, useRef } from "react";
import type { Exchange, SpeakerMap } from "@/lib/types";
import { formatTime, TURN_KIND_STYLE } from "@/lib/utils";
import { UNKNOWN_SPEAKER } from "@/lib/client-data";
import SpeakerAvatar from "./SpeakerAvatar";

/**
 * 스크롤 스크럽 발언 스레드 — 긴 트랙 + 스티키 무대.
 * 스크롤 진행률 p(0~1)에 따라 말풍선이 순서대로 나타난다 (scroll text stagger 응용).
 */
export default function ThreadScrub({
  exchange,
  speakers,
  meetingHref,
}: {
  exchange: Exchange;
  speakers: SpeakerMap;
  meetingHref: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const N = exchange.turns.length;

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (REDUCE) {
      itemRefs.current.forEach((el) => {
        if (el) {
          el.style.opacity = "1";
          el.style.transform = "none";
        }
      });
      return;
    }
    let raf = 0;
    let target = 0;
    let cur = 0;
    const measure = () => {
      const rect = track.getBoundingClientRect();
      const total = rect.height - innerHeight;
      target = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
    };
    const onScroll = () => measure();
    addEventListener("scroll", onScroll, { passive: true });
    measure();
    const loop = () => {
      cur += (target - cur) * 0.14;
      itemRefs.current.forEach((el, i) => {
        if (!el) return;
        const l = Math.min(1, Math.max(0, (cur - i / N) / 0.22));
        el.style.opacity = String(l);
        el.style.transform = `translateY(${(1 - l) * 28}px)`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [N]);

  return (
    <div ref={trackRef} style={{ height: `${90 + N * 34}vh` }}>
      <div className="sticky top-0 flex min-h-screen flex-col justify-center px-5 py-16">
        <div className="mx-auto w-full max-w-2xl">
          <p className="overline-label">발언 스레드</p>
          <h2 className="h-judge mt-1.5">
            누가 지시했고,
            <br />
            누가 어떻게 답했는지.
          </h2>
          <p className="mt-3 text-[15px] text-mut">
            주제 「{exchange.topic}」 — 스크롤하면 대화가 이어집니다.
          </p>

          <div className="mt-8 space-y-3">
            {exchange.turns.map((turn, i) => {
              const sp = speakers[turn.speakerId] ?? UNKNOWN_SPEAKER;
              const kind = TURN_KIND_STYLE[turn.kind] ?? TURN_KIND_STYLE["발언"];
              const depth = turn.inReplyTo !== null ? 1 : 0;
              return (
                <div
                  key={i}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  className="flex gap-3"
                  style={{ marginLeft: depth * 26, opacity: 0 }}
                >
                  <SpeakerAvatar speaker={sp} size="md" />
                  <div className="bubble flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{sp.name}</span>
                      <span className="text-xs text-mut">{sp.role}</span>
                      <span className={`chip ${kind.className}`}>{kind.label}</span>
                      <span className="ml-auto font-mono text-[11px] text-faint">
                        {formatTime(turn.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-body">{turn.summary}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <a href={meetingHref} className="btn-link mt-6 inline-block">
            이 회의 전체 스레드 보기 &rsaquo;
          </a>
        </div>
      </div>
    </div>
  );
}
