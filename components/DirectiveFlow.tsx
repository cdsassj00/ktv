"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Directive, Meeting, SpeakerMap } from "@/lib/types";
import { DIRECTIVE_STATUS_LABEL, formatDate } from "@/lib/utils";
import { UNKNOWN_SPEAKER } from "@/lib/client-data";
import SpeakerAvatar from "./SpeakerAvatar";

/**
 * 지시-이행 플로우 — 셀프 드로잉 SVG(line draw on scroll).
 * 세로 연결선이 스크롤 진행률에 따라 그려지고, 지시 카드가 따라 나타난다.
 */
export default function DirectiveFlow({
  items,
  speakers,
  meetingIndex = {},
}: {
  items: { meeting: Meeting; directive: Directive }[];
  speakers: SpeakerMap;
  /** 후속보고의 회의 id → 제목·날짜 (펼침 목록 표기용) */
  meetingIndex?: Record<string, { title: string; date: string }>;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const N = items.length;

  useEffect(() => {
    const section = sectionRef.current;
    const path = pathRef.current;
    if (!section || !path) return;
    const L = path.getTotalLength();
    path.style.strokeDasharray = String(L);

    const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (REDUCE) {
      path.style.strokeDashoffset = "0";
      cardRefs.current.forEach((el) => {
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
      const rect = section.getBoundingClientRect();
      // 섹션이 화면에 들어와 지나가는 동안 0→1
      target = Math.min(1, Math.max(0, (innerHeight * 0.75 - rect.top) / rect.height));
    };
    addEventListener("scroll", measure, { passive: true });
    measure();
    const loop = () => {
      cur += (target - cur) * 0.12;
      path.style.strokeDashoffset = String(L * (1 - cur));
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const l = Math.min(1, Math.max(0, (cur - i / N) / 0.3));
        el.style.opacity = String(l);
        el.style.transform = `translateY(${(1 - l) * 24}px)`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      removeEventListener("scroll", measure);
      cancelAnimationFrame(raf);
    };
  }, [N]);

  return (
    <div ref={sectionRef} className="relative mx-auto max-w-2xl">
      {/* 세로 드로잉 라인 */}
      <svg
        className="absolute left-[19px] top-0 h-full w-[2px]"
        viewBox="0 0 2 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path ref={pathRef} d="M1 0 L1 100" stroke="#0a84ff" strokeWidth="2" fill="none" />
      </svg>

      <div className="space-y-8">
        {items.map(({ meeting, directive }, i) => {
          const from = speakers[directive.from] ?? UNKNOWN_SPEAKER;
          const status = DIRECTIVE_STATUS_LABEL[directive.status];
          return (
            <div
              key={directive.id}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="relative flex gap-5 pl-12"
              style={{ opacity: 0 }}
            >
              <span className="absolute left-[12px] top-2 size-4 rounded-full border-2 border-accent-500 bg-paper" />
              <div className="panel flex-1 p-5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <SpeakerAvatar speaker={from} size="sm" />
                  <span className="text-[15px] font-semibold text-ink">{from.name}</span>
                  <span className="text-[13px] text-mut">→</span>
                  <span className="text-[13px] text-body">
                    {directive.to
                      .map((id) => (speakers[id] ?? UNKNOWN_SPEAKER).org || (speakers[id] ?? UNKNOWN_SPEAKER).name)
                      .join(", ")}
                  </span>
                  <span className={`chip ml-auto ${status.className}`}>{status.label}</span>
                </div>
                <p className="mt-2.5 text-[16px] leading-relaxed text-body">{directive.content}</p>
                <div className="mt-2 text-[13px] text-mut">
                  <Link href={`/meetings/${meeting.id}`} className="text-accent-400 hover:underline">
                    {formatDate(meeting.date)} · {meeting.title}
                  </Link>
                </div>
                {directive.followUps.length > 0 && (
                  <details className="group/fu mt-3 border-t border-dashed border-hair pt-2.5">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13.5px] font-semibold text-[#30d158] [&::-webkit-details-marker]:hidden">
                      ↳ 후속보고 {directive.followUps.length}건 보기
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="size-3.5 transition-transform group-open/fu:rotate-180"
                        aria-hidden
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </summary>
                    <ol className="mt-2.5 space-y-2">
                      {directive.followUps.map((fu, fi) => {
                        const fuMeeting = meetingIndex[fu.meetingId];
                        return (
                          <li key={fi} className="flex items-start gap-2 text-[14px]">
                            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#30d158]" />
                            <div className="min-w-0">
                              <Link
                                href={
                                  fu.exchangeId
                                    ? `/meetings/${fu.meetingId}#${fu.exchangeId}`
                                    : `/meetings/${fu.meetingId}`
                                }
                                className="font-medium text-accent-400 hover:underline"
                              >
                                {fuMeeting ? `${formatDate(fuMeeting.date)} · ${fuMeeting.title}` : fu.meetingId}
                              </Link>
                              <p className="mt-0.5 leading-relaxed text-body">{fu.summary}</p>
                              {fu.inferred && (
                                <span className="mt-1 inline-block rounded border border-hair bg-tint px-1.5 py-0.5 text-[10.5px] text-mut">
                                  추정 연결
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
