"use client";

import { useEffect, useRef, useState } from "react";

const RING_R = 8;
const RING_C = 2 * Math.PI * RING_R;

function Ring({
  innerRef,
  onClick,
}: {
  innerRef: React.RefObject<SVGCircleElement | null>;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="맨 위로 (페이지 진행률)"
      title="맨 위로"
      className="group relative flex size-8 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10"
    >
      <svg viewBox="0 0 22 22" className="size-[22px] -rotate-90">
        <circle cx="11" cy="11" r={RING_R} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2.5" />
        <circle
          ref={innerRef}
          cx="11"
          cy="11"
          r={RING_R}
          fill="none"
          stroke="var(--color-accent-400)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={RING_C}
          style={{ transition: "stroke-dashoffset 0.15s linear" }}
        />
      </svg>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="absolute size-2.5 text-ink opacity-0 transition group-hover:opacity-100"
        aria-hidden
      >
        <path d="m18 15-6-6-6 6" />
      </svg>
    </button>
  );
}

/**
 * 플로팅 "다이내믹 아일랜드" 내비.
 * - 데스크톱(lg+): 우측 중앙에 세로 아일랜드 — 평소엔 진행률 링 + 도트 레일 +
 *   현재 섹션 라벨만, 호버하면 모든 도트가 라벨 칩으로 스태거 확장(왼쪽으로 자람).
 * - 모바일: 하단 가로 캡슐 — 현재 섹션 칩만 남고, 탭하면 전체 펼침 (엄지 접근성).
 * 진행률 링은 스크롤 정도를 채우고 클릭 시 맨 위로.
 */
export default function FloatingNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const [shown, setShown] = useState(false);
  const [openH, setOpenH] = useState(false); // 모바일 하단
  const [openV, setOpenV] = useState(false); // 데스크톱 우측
  const ringH = useRef<SVGCircleElement>(null);
  const ringV = useRef<SVGCircleElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-40% 0px -50% 0px" }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setShown(scrollY > innerHeight * 0.5);
        const max = document.documentElement.scrollHeight - innerHeight;
        const off = `${RING_C * (1 - (max > 0 ? Math.min(1, scrollY / max) : 0))}`;
        ringH.current?.style.setProperty("stroke-dashoffset", off);
        ringV.current?.style.setProperty("stroke-dashoffset", off);
      });
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const onDocDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenH(false);
        setOpenV(false);
      }
    };
    document.addEventListener("pointerdown", onDocDown);
    return () => {
      io.disconnect();
      removeEventListener("scroll", onScroll);
      document.removeEventListener("pointerdown", onDocDown);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [sections]);

  /* 펼침 상태는 잠시 후 자동으로 접힘 */
  useEffect(() => {
    if (!openH && !openV) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpenH(false);
      setOpenV(false);
    }, 4000);
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [openH, openV, active]);

  const toTop = (e: React.MouseEvent) => {
    e.stopPropagation();
    scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div ref={rootRef}>
      {/* ── 데스크톱: 우측 세로 아일랜드 ── */}
      <nav
        aria-label="섹션 이동"
        className={`fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 transition-all duration-500 lg:block ${
          shown ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-16 opacity-0"
        }`}
        onMouseEnter={() => setOpenV(true)}
        onMouseLeave={() => setOpenV(false)}
      >
        <div className="flex flex-col items-end gap-0.5 rounded-[24px] border border-white/10 bg-black/70 p-1.5 shadow-lift backdrop-blur-xl backdrop-saturate-150">
          <div className="self-center pb-0.5">
            <Ring innerRef={ringV} onClick={toTop} />
          </div>
          {sections.map((s, i) => {
            const isActive = active === s.id;
            const labeled = openV || isActive;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={() => setOpenV(false)}
                aria-current={isActive ? "true" : undefined}
                style={{ transitionDelay: openV ? `${i * 26}ms` : "0ms" }}
                className={`group flex flex-row-reverse items-center gap-2 rounded-full py-1.5 transition-all duration-500 ${
                  labeled ? "pl-3.5 pr-2.5" : "px-2.5"
                } ${
                  isActive
                    ? "bg-accent-500 text-white"
                    : "text-mut hover:bg-white/10 hover:text-ink"
                }`}
              >
                <span
                  aria-hidden
                  className={`size-1.5 shrink-0 rounded-full transition ${
                    isActive ? "bg-white" : "bg-tint2 group-hover:bg-mut"
                  }`}
                />
                <span
                  style={{ transitionDelay: openV ? `${i * 26}ms` : "0ms" }}
                  className={`overflow-hidden whitespace-nowrap text-[13px] font-medium transition-all duration-500 ${
                    labeled ? "max-w-[110px] opacity-100" : "max-w-0 opacity-0"
                  }`}
                >
                  {s.label}
                </span>
              </a>
            );
          })}
        </div>
      </nav>

      {/* ── 모바일: 하단 가로 캡슐 ── */}
      <nav
        aria-label="섹션 이동"
        className={`fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 transition-all duration-500 lg:hidden ${
          shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-16 opacity-0"
        }`}
      >
        <div
          className={`flex max-w-[94vw] items-center gap-0.5 overflow-x-auto rounded-full border border-white/10 bg-black/70 px-1.5 py-1.5 shadow-lift backdrop-blur-xl backdrop-saturate-150 transition-all duration-500 ${
            openH ? "scroll-thin" : "overflow-hidden"
          }`}
          onClick={() => !openH && setOpenH(true)}
          role="presentation"
        >
          <div className="mr-0.5">
            <Ring innerRef={ringH} onClick={toTop} />
          </div>
          {sections.map((s, i) => {
            const isActive = active === s.id;
            const visible = openH || isActive;
            return (
              <a
                key={s.id}
                href={`#${s.id}`}
                onClick={() => setOpenH(false)}
                tabIndex={visible ? 0 : -1}
                aria-current={isActive ? "true" : undefined}
                style={{ transitionDelay: openH ? `${i * 28}ms` : "0ms" }}
                className={`overflow-hidden whitespace-nowrap rounded-full text-[13.5px] font-medium transition-all duration-500 ${
                  visible ? "max-w-[140px] px-3.5 py-1.5 opacity-100" : "max-w-0 px-0 py-1.5 opacity-0"
                } ${isActive ? "bg-accent-500 text-white" : "text-mut hover:bg-white/10 hover:text-ink"}`}
              >
                {s.label}
              </a>
            );
          })}
          <button
            type="button"
            aria-label={openH ? "메뉴 접기" : "메뉴 펼치기"}
            aria-expanded={openH}
            onClick={(e) => {
              e.stopPropagation();
              setOpenH(!openH);
            }}
            className="ml-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-mut transition hover:bg-white/10 hover:text-ink"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={`size-4 transition-transform duration-500 ${openH ? "rotate-90" : ""}`}
              aria-hidden
            >
              <circle cx="5" cy="12" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
            </svg>
          </button>
        </div>
      </nav>
    </div>
  );
}
