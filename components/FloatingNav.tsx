"use client";

import { useEffect, useRef, useState } from "react";

const RING_R = 8;
const RING_C = 2 * Math.PI * RING_R;

/**
 * 하단 중앙 "다이내믹 아일랜드" 내비 — 스크롤을 따라다니는 살아있는 메뉴.
 *
 * 평소(접힘): 진행률 링 + 현재 섹션 칩만 남는다. 스크롤로 섹션이 바뀌면
 * 이전 칩이 접히고 새 칩이 자라나며 아일랜드가 메뉴 위를 "걸어가는" 모핑이 일어난다.
 * 마우스를 올리거나(데스크톱) 탭하면(터치) 전체 섹션 칩이 스태거로 펼쳐진다.
 * 진행률 링은 페이지 스크롤 정도를 채워서 표시하고, 클릭하면 맨 위로.
 */
export default function FloatingNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState(false);
  const ringRef = useRef<SVGCircleElement>(null);
  const navRef = useRef<HTMLElement>(null);
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
        /* 진행률 링은 리렌더 없이 직접 갱신 */
        const max = document.documentElement.scrollHeight - innerHeight;
        const p = max > 0 ? Math.min(1, scrollY / max) : 0;
        ringRef.current?.style.setProperty("stroke-dashoffset", `${RING_C * (1 - p)}`);
      });
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    /* 바깥 탭 시 접기 (터치) */
    const onDocDown = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDocDown);
    return () => {
      io.disconnect();
      removeEventListener("scroll", onScroll);
      document.removeEventListener("pointerdown", onDocDown);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [sections]);

  /* 스크롤로 섹션이 바뀌면 펼침 상태는 잠시 후 자동으로 접힘 */
  useEffect(() => {
    if (!open) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 4000);
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [open, active]);

  return (
    <nav
      ref={navRef}
      aria-label="섹션 이동"
      className={`fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 transition-all duration-500 ${
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-16 opacity-0"
      }`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        className={`flex max-w-[94vw] items-center gap-0.5 overflow-x-auto rounded-full border border-white/10 bg-black/70 px-1.5 py-1.5 shadow-lift backdrop-blur-xl backdrop-saturate-150 transition-all duration-500 ${
          open ? "scroll-thin" : "overflow-hidden"
        }`}
        onClick={() => !open && setOpen(true)}
        role="presentation"
      >
        {/* 진행률 링 — 클릭 시 맨 위로 */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            scrollTo({ top: 0, behavior: "smooth" });
          }}
          aria-label="맨 위로 (페이지 진행률)"
          title="맨 위로"
          className="group relative mr-0.5 flex size-8 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10"
        >
          <svg viewBox="0 0 22 22" className="size-[22px] -rotate-90">
            <circle cx="11" cy="11" r={RING_R} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="2.5" />
            <circle
              ref={ringRef}
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

        {/* 섹션 칩 — 접힘: 현재 섹션만, 펼침: 전체 스태거 등장 */}
        {sections.map((s, i) => {
          const isActive = active === s.id;
          const visible = open || isActive;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={() => setOpen(false)}
              tabIndex={visible ? 0 : -1}
              aria-current={isActive ? "true" : undefined}
              style={{ transitionDelay: open ? `${i * 28}ms` : "0ms" }}
              className={`overflow-hidden whitespace-nowrap rounded-full text-[13.5px] font-medium transition-all duration-500 ${
                visible ? "max-w-[140px] px-3.5 py-1.5 opacity-100" : "max-w-0 px-0 py-1.5 opacity-0"
              } ${isActive ? "bg-accent-500 text-white" : "text-mut hover:bg-white/10 hover:text-ink"}`}
            >
              {s.label}
            </a>
          );
        })}

        {/* 펼침 힌트 그립 */}
        <button
          type="button"
          aria-label={open ? "메뉴 접기" : "메뉴 펼치기"}
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
          className="ml-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-mut transition hover:bg-white/10 hover:text-ink"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`size-4 transition-transform duration-500 ${open ? "rotate-90" : ""}`}
            aria-hidden
          >
            <circle cx="5" cy="12" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
