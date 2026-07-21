"use client";

import { useEffect, useState } from "react";

/** 우측 도트 내비 — 현재 섹션 하이라이트, 클릭 시 앵커 이동 */
export default function DotNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="섹션 이동"
      className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-3 lg:flex"
    >
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="group relative flex items-center justify-end"
          aria-label={s.label}
        >
          <span className="pointer-events-none absolute right-6 whitespace-nowrap rounded-md bg-surf px-2 py-1 text-[12px] font-medium text-body opacity-0 transition group-hover:opacity-100">
            {s.label}
          </span>
          <span
            className={`block rounded-full transition-all duration-300 ${
              active === s.id ? "h-2.5 w-2.5 bg-accent-500" : "h-1.5 w-1.5 bg-tint2 group-hover:bg-mut"
            }`}
          />
        </a>
      ))}
    </nav>
  );
}
