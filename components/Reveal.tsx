"use client";

import { useEffect, useRef } from "react";

/* 페이지 전체가 공유하는 IntersectionObserver 1개 (recipes.md 규칙) */
let sharedIO: IntersectionObserver | null = null;
function getObserver(): IntersectionObserver {
  sharedIO ??= new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("show");
        sharedIO?.unobserve(e.target);
      }),
    { threshold: 0.15 }
  );
  return sharedIO;
}

/**
 * 페이드 업(fade up on scroll) 래퍼.
 * stagger=true면 스태거 그리드(stagger children) — 자식에 80ms 간격 지연을 부여.
 */
export default function Reveal({
  children,
  stagger = false,
  className,
}: {
  children: React.ReactNode;
  stagger?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("show");
      return;
    }
    if (stagger) {
      [...el.children].forEach(
        (c, i) => ((c as HTMLElement).style.transitionDelay = `${i * 80}ms`)
      );
    }
    const io = getObserver();
    io.observe(el);
    return () => io.unobserve(el);
  }, [stagger]);

  return (
    <div ref={ref} {...(stagger ? { "data-stagger": "" } : { "data-reveal": "" })} className={className}>
      {children}
    </div>
  );
}
