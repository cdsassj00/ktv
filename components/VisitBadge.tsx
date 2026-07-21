"use client";

import { useEffect, useState } from "react";

/**
 * 방문자 수 배지 — "오늘까지 N명이 열람했습니다".
 * 같은 브라우저는 하루 1회만 집계(localStorage 플래그), 이후엔 조회만.
 * API(/api/visit, Cloudflare Pages Function)가 없는 로컬 환경에선 조용히 숨는다.
 */
export default function VisitBadge({ className = "" }: { className?: string }) {
  const [stat, setStat] = useState<{ total: number; today: number } | null>(null);

  useEffect(() => {
    const key = `oc-visited-${new Date().toISOString().slice(0, 10)}`;
    let counted = "1";
    try {
      counted = localStorage.getItem(key) ? "0" : "1";
    } catch {
      counted = "0";
    }
    fetch(`/api/visit?count=${counted}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && typeof j.total === "number") {
          setStat(j);
          if (counted === "1") {
            try {
              localStorage.setItem(key, "1");
            } catch {}
          }
        }
      })
      .catch(() => {});
  }, []);

  if (!stat) return null;
  return (
    <p className={`text-[12.5px] text-faint ${className}`}>
      오늘까지{" "}
      <span className="tabular font-semibold text-mut">{stat.total.toLocaleString("ko-KR")}</span>
      명이 열람했습니다
      {stat.today > 0 && <span className="ml-1.5">· 오늘 {stat.today.toLocaleString("ko-KR")}명</span>}
    </p>
  );
}
