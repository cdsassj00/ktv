"use client";

import { useEffect, useRef } from "react";

/** 상단 리딩 프로그레스 바 — 페이지 스크롤 진행률 */
export default function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - innerHeight;
      const p = max > 0 ? scrollY / max : 0;
      if (ref.current) ref.current.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-[2px] bg-transparent">
      <div ref={ref} className="h-full origin-left bg-accent-500" style={{ transform: "scaleX(0)" }} />
    </div>
  );
}
