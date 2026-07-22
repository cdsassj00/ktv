"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 좌하단 저작권 배지 — "ⓒ Made by CDSA".
 * 클릭하면 저작권·제작 정보 팝오버가 열리고, 첫 방문 시 한 번만
 * 자동으로 펼쳐졌다가 4초 뒤 접힌다(localStorage). 바깥 클릭·Esc로 닫힘.
 * 모바일에선 하단 플로팅 내비와 겹치지 않게 위로 올려 배치.
 */
export default function CreditBadge() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /* 첫 방문 자동 소개 */
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      if (!localStorage.getItem("cdsa-credit-seen")) {
        setOpen(true);
        timer = setTimeout(() => {
          setOpen(false);
          localStorage.setItem("cdsa-credit-seen", "1");
        }, 4500);
      }
    } catch {}

    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={rootRef} className="fixed bottom-[76px] left-3 z-40 lg:bottom-5 lg:left-5">
      {/* 팝오버 */}
      <div
        role="dialog"
        aria-label="저작권 정보"
        aria-hidden={!open}
        className={`absolute bottom-full left-0 mb-2 w-[248px] origin-bottom-left rounded-2xl border border-[#ffd257]/25 bg-black/85 p-4 shadow-lift backdrop-blur-xl transition-all duration-300 ${
          open ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"
        }`}
      >
        <p className="text-[13.5px] font-semibold text-ink">열린국무회의</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-mut">
          Made by <span className="font-semibold text-[#ffd257]">CDSA</span>
          <br />
          한국데이터사이언티스트협회
        </p>
        <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
          ⓒ 2026 CDSA. All rights reserved.
          <br />
          영상·발언 원저작권은 KTV 국민방송에 있습니다.
        </p>
        <a
          href="https://cdsa.kr"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-[12.5px] font-medium text-accent-400 hover:underline"
        >
          cdsa.kr — AX 전환·AI 교육 &rsaquo;
        </a>
      </div>

      {/* 배지 */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border border-[#ffd257]/30 bg-black/70 py-1.5 pl-2.5 pr-3 shadow-card backdrop-blur-xl transition hover:border-[#ffd257]/60 hover:bg-black/85"
      >
        <span className="text-[11px] font-bold text-[#ffd257]">ⓒ</span>
        <span className="text-[11.5px] font-medium tracking-tight text-mut">
          Made by <span className="font-semibold text-ink">CDSA</span>
        </span>
      </button>
    </div>
  );
}
