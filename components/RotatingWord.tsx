"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 헤드라인 단어 로테이션 — 단어가 아래에서 밀려 올라오며 교체된다.
 * 모든 단어를 같은 그리드 셀에 겹쳐 두어 가장 긴 단어 기준으로
 * 폭이 고정되므로 레이아웃이 흔들리지 않는다.
 * 활성 단어에는 오로라 그라데이션(.aurora-text)이 흐른다.
 */
export default function RotatingWord({
  words,
  interval = 2300,
}: {
  words: string[];
  interval?: number;
}) {
  const [idx, setIdx] = useState(0);
  const prevRef = useRef(-1);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setIdx((i) => {
        prevRef.current = i;
        return (i + 1) % words.length;
      });
    }, interval);
    return () => clearInterval(t);
  }, [words.length, interval]);

  return (
    <span className="inline-grid overflow-hidden text-center align-bottom">
      {words.map((w, i) => {
        const state = i === idx ? "in" : i === prevRef.current ? "out" : "idle";
        return (
          <span
            key={w}
            aria-hidden={i !== idx}
            style={{ gridArea: "1 / 1" }}
            className={`aurora-text whitespace-nowrap transition-all duration-500 ease-[cubic-bezier(0.2,0.7,0.2,1)] ${
              state === "in"
                ? "translate-y-0 opacity-100"
                : state === "out"
                  ? "-translate-y-[105%] opacity-0"
                  : "translate-y-[105%] opacity-0"
            }`}
          >
            {w}
          </span>
        );
      })}
    </span>
  );
}
