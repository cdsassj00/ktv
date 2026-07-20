"use client";

import { useEffect, useState } from "react";

/**
 * 하단 중앙 플로팅 메뉴 — 긴 스크롤을 따라다니며 현재 섹션을 표시하고 앵커 이동.
 * 모바일 포함 전 화면에서 표시. 히어로에 있을 땐 살짝 내려가 있다가 스크롤하면 올라옴.
 */
export default function FloatingNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const [shown, setShown] = useState(false);

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
    const onScroll = () => setShown(scrollY > innerHeight * 0.5);
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      io.disconnect();
      removeEventListener("scroll", onScroll);
    };
  }, [sections]);

  return (
    <nav
      aria-label="섹션 이동"
      className={`fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 transition-all duration-500 ${
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-16 opacity-0"
      }`}
    >
      <div className="scroll-thin flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-white/10 bg-black/70 px-1.5 py-1.5 shadow-lift backdrop-blur-xl backdrop-saturate-150">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition ${
              active === s.id ? "bg-accent-500 text-white" : "text-mut hover:bg-white/10 hover:text-ink"
            }`}
          >
            {s.label}
          </a>
        ))}
        <button
          type="button"
          onClick={() => scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="맨 위로"
          className="ml-0.5 rounded-full p-1.5 text-mut transition hover:bg-white/10 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4">
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
