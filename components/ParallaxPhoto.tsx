"use client";

import { useEffect, useRef } from "react";

/**
 * 패럴랙스 배경 사진 — 섹션 뒤에 실제 국무회의 장면(영상 썸네일)을 깔고,
 * 스크롤 진행률에 따라 위치(패럴랙스)와 투명도를 스크럽한다.
 * 부모 섹션에 relative + overflow-hidden 필요.
 */
export default function ParallaxPhoto({
  src,
  fallbackSrc,
  maxOpacity = 0.14,
  rate = 0.18,
}: {
  src: string;
  fallbackSrc?: string;
  maxOpacity?: number;
  rate?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!wrap || !img) return;
    const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (REDUCE) {
      img.style.opacity = String(maxOpacity);
      return;
    }
    let raf = 0;
    let target = { y: 0, o: 0 };
    let cur = { y: 0, o: 0 };
    const measure = () => {
      const rect = wrap.getBoundingClientRect();
      const vh = innerHeight;
      // 섹션이 화면을 통과하는 진행률 (-1: 아래, 0: 중앙, 1: 위)
      const p = (rect.top + rect.height / 2 - vh / 2) / (vh / 2 + rect.height / 2);
      target.y = p * rect.height * rate;
      // 중앙에 가까울수록 선명, 가장자리에서 사라짐
      target.o = Math.max(0, 1 - Math.abs(p) * 1.4) * maxOpacity;
    };
    addEventListener("scroll", measure, { passive: true });
    addEventListener("resize", measure, { passive: true });
    measure();
    const loop = () => {
      cur.y += (target.y - cur.y) * 0.12;
      cur.o += (target.o - cur.o) * 0.12;
      img.style.transform = `translateY(${cur.y}px) scale(1.12)`;
      img.style.opacity = String(cur.o);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      removeEventListener("scroll", measure);
      removeEventListener("resize", measure);
      cancelAnimationFrame(raf);
    };
  }, [maxOpacity, rate]);

  return (
    <div ref={wrapRef} aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt=""
        loading="lazy"
        onError={(e) => {
          if (fallbackSrc && e.currentTarget.src !== fallbackSrc) e.currentTarget.src = fallbackSrc;
        }}
        className="size-full object-cover grayscale-[0.35]"
        style={{ opacity: 0 }}
      />
      {/* 위·아래 가장자리를 배경색으로 페이드 */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
    </div>
  );
}
