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
}: {
  items: { meeting: Meeting; directive: Directive }[];
  speakers: SpeakerMap;
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
                  <span className="text-sm font-semibold text-ink">{from.name}</span>
                  <span className="text-xs text-mut">→</span>
                  <span className="text-xs text-body">
                    {directive.to
                      .map((id) => (speakers[id] ?? UNKNOWN_SPEAKER).org || (speakers[id] ?? UNKNOWN_SPEAKER).name)
                      .join(", ")}
                  </span>
                  <span className={`chip ml-auto ${status.className}`}>{status.label}</span>
                </div>
                <p className="mt-2.5 text-[15px] leading-relaxed text-body">{directive.content}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mut">
                  <Link href={`/meetings/${meeting.id}`} className="text-accent-400 hover:underline">
                    {formatDate(meeting.date)} · {meeting.title}
                  </Link>
                  {directive.followUps.length > 0 && (
                    <span className="text-[#30d158]">
                      ↳ 후속보고 {directive.followUps.length}건 연결됨
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
