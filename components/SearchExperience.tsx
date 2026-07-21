"use client";

import { useCallback, useEffect, useState } from "react";
import type { NetworkEdge, NetworkNode, SearchDoc, SpeakerMap } from "@/lib/types";
import NetworkView, { type ExchangeIndex } from "./NetworkView";

const HOT_KEYWORDS = ["AI", "물가", "부동산", "촉법소년", "계곡 불법점용", "자살예방", "청년미래적금"];

/**
 * 히어로 직후 검색 섹션 + 풀스크린 모달.
 * 검색바(또는 키워드 칩)를 누르면 모달이 열리고, 그 안에서 원탁 네트워크 그래프와
 * 퍼지 검색·대화 스레드가 함께 동작한다. Esc/배경 클릭으로 닫힘, 열려 있는 동안 body 스크롤 잠금.
 */
export default function SearchExperience({
  nodes,
  edges,
  speakers,
  searchDocs,
  exchangeIndex,
}: {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  speakers: SpeakerMap;
  searchDocs: SearchDoc[];
  exchangeIndex: ExchangeIndex;
}) {
  const [open, setOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState("");

  const openWith = useCallback((q: string) => {
    setInitialQuery(q);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* 인라인 검색바 (가짜 입력 — 클릭 시 모달) */}
      <div className="mx-auto max-w-2xl">
        <button
          type="button"
          onClick={() => openWith("")}
          className="group flex w-full items-center gap-3 rounded-full bg-surf px-6 py-4 text-left shadow-card transition hover:bg-tint"
          aria-label="회의 내용 검색 열기"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5 text-accent-400" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span className="flex-1 text-[16px] text-faint group-hover:text-mut">
            지시·발언·안건 검색 — 원탁 네트워크에서 관계를 확인하세요
          </span>
          <span className="hidden rounded-full bg-tint2 px-3 py-1 text-[12.5px] font-medium text-mut sm:block">
            29개 회의 · 295건 지시
          </span>
        </button>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {HOT_KEYWORDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => openWith(k)}
              className="rounded-full bg-tint px-3.5 py-1.5 text-[14px] font-medium text-body transition hover:bg-tint2 hover:text-ink"
            >
              #{k}
            </button>
          ))}
        </div>
      </div>

      {/* 풀스크린 모달 — 원탁 그래프 + 검색 + 대화 스레드 */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm sm:p-8"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="네트워크 검색"
        >
          <div className="metal-frame w-full max-w-5xl">
            <div className="relative rounded-[18.5px] bg-paper p-5 sm:p-7">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-ink">네트워크 검색</h2>
              <div className="flex items-center gap-2.5">
                <span className="hidden rounded-md border border-white/15 px-1.5 py-0.5 font-mono text-[11px] text-mut sm:block">
                  ESC
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="닫기"
                  className="flex size-9 items-center justify-center rounded-full bg-white text-black shadow-[0_0_14px_rgba(255,210,87,0.35)] ring-2 ring-[#ffd257]/70 transition hover:scale-110 hover:bg-[#ffd257]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="size-[18px]" aria-hidden>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <NetworkView
              key={initialQuery /* 칩으로 다시 열면 검색어 초기화 */}
              nodes={nodes}
              edges={edges}
              speakers={speakers}
              searchDocs={searchDocs}
              exchangeIndex={exchangeIndex}
              initialQuery={initialQuery}
              autoFocus
            />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
