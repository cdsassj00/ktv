"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import type { ExchangeTurn, NetworkEdge, NetworkNode, SearchDoc, SpeakerMap } from "@/lib/types";
import { formatTime, TURN_KIND_STYLE, youtubeUrlAt } from "@/lib/utils";
import { UNKNOWN_SPEAKER } from "@/lib/client-data";
import SpeakerAvatar from "./SpeakerAvatar";
import NetworkGraph2D, { type GraphHighlight } from "./NetworkGraph2D";

export type ExchangeIndex = Record<
  string,
  { topic: string; meetingId: string; meetingTitle: string; videoId: string; turns: ExchangeTurn[] }
>;

/**
 * 원근감 2D 네트워크 + Fuse.js 퍼지 검색.
 * 검색어 입력 → 지시·보고·답변·AI 발언·안건에서 연관 항목 매칭 →
 * 그래프에서 관련 발언자 노드·지시 엣지를 골드로 하이라이트(나머지 디밍) + 결과 리스트.
 */
export default function NetworkView({
  nodes,
  edges,
  speakers,
  searchDocs,
  exchangeIndex,
  initialQuery,
  autoFocus,
}: {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  speakers: SpeakerMap;
  searchDocs?: SearchDoc[];
  exchangeIndex?: ExchangeIndex;
  initialQuery?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [selected, setSelected] = useState<number | null>(null);
  const [focusNode, setFocusNode] = useState<string | null>(null);
  const [speakerSel, setSpeakerSel] = useState<string | null>(null); // 그래프 노드 선택

  const fuse = useMemo(
    () =>
      searchDocs
        ? new Fuse(searchDocs, {
            keys: [
              { name: "text", weight: 2 },
              { name: "topic", weight: 1.5 },
              { name: "tags", weight: 1.5 },
              { name: "speakerNames", weight: 1 },
              { name: "kind", weight: 0.5 },
              { name: "meetingTitle", weight: 0.5 },
            ],
            threshold: 0.34,
            ignoreLocation: true,
            minMatchCharLength: 2,
          })
        : null,
    [searchDocs]
  );

  const results = useMemo(() => {
    if (!fuse || query.trim().length < 2) return [];
    return fuse.search(query.trim()).slice(0, 8).map((r) => r.item);
  }, [fuse, query]);

  /* 노드 선택 시: 그 인물이 참여한 발언·지시·대화 목록 (최신 회의 우선) */
  const speakerDocs = useMemo(() => {
    if (!speakerSel || !searchDocs) return [];
    return searchDocs
      .filter((d) => d.speakerIds.includes(speakerSel))
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 10);
  }, [speakerSel, searchDocs]);

  /* 아래 목록에 실제로 보여줄 문서: 노드 선택이 검색보다 우선 (그래프와 동일 규칙) */
  const docs = speakerSel ? speakerDocs : results;

  // 검색어가 바뀌면 선택·카메라 초기화
  useMemo(() => {
    setSelected(null);
    setFocusNode(null);
    return null;
  }, [query]);

  const selectedDoc = selected !== null ? docs[selected] : null;
  const selectedExchange =
    selectedDoc?.exchangeId && exchangeIndex
      ? exchangeIndex[`${selectedDoc.meetingId}#${selectedDoc.exchangeId}`]
      : null;

  const highlight: GraphHighlight | null = useMemo(() => {
    if (results.length === 0) return null;
    const ns = new Set<string>();
    const pairs = new Set<string>();
    if (selectedExchange) {
      for (const t of selectedExchange.turns) {
        if (t.speakerId !== "unknown") ns.add(t.speakerId);
        if (t.inReplyTo !== null) {
          const parent = selectedExchange.turns[t.inReplyTo];
          if (parent && parent.speakerId !== "unknown" && t.speakerId !== "unknown")
            pairs.add(`${t.speakerId}→${parent.speakerId}`);
        }
      }
      return { nodes: [...ns], pairs: [...pairs] };
    }
    for (const doc of results) {
      doc.speakerIds.forEach((id) => id !== "unknown" && ns.add(id));
      if (doc.kind === "지시" && doc.speakerIds.length >= 2) {
        const [from, ...to] = doc.speakerIds;
        to.forEach((t) => pairs.add(`${from}→${t}`));
      }
    }
    return { nodes: [...ns], pairs: [...pairs] };
  }, [results, selectedExchange]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {searchDocs ? (
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint"
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              autoFocus={autoFocus}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="검색: 부동산, AI, 물가, 자살예방, 촉법소년…"
              className="w-full rounded-full bg-surf py-2.5 pl-10 pr-4 text-[15px] text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent-500"
              aria-label="회의 내용 검색"
            />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-4 text-[13.5px] font-medium text-mut">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 rounded bg-[#ff5c72]" style={{ height: 3 }} /> 지시
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-6 rounded bg-[#5f9dff]" /> 답변·보고
          </span>
          <span className="hidden text-faint sm:inline">
            드래그 회전 · 위아래 드래그 기울기 · 휠/핀치 확대 · 인물 클릭 시 관계만 표시
          </span>
          <span className="text-faint sm:hidden">
            좌우 드래그 회전 · 두 손가락 확대 · 인물 탭 시 관계 표시
          </span>
        </div>
      </div>

      {!speakerSel && query.trim().length >= 2 && (
        <p className="text-[14px] text-mut">
          {results.length > 0 ? (
            <>
              <strong className="text-[#ffd60a]">{results.length}건</strong> 매칭 — 관련 발언자와
              지시 관계가 그래프에 <span className="text-[#ffd60a]">골드</span>로 표시됩니다.
            </>
          ) : (
            "매칭 결과가 없습니다. 다른 검색어를 시도해 보세요."
          )}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl bg-[#050508] shadow-card">
        <NetworkGraph2D
          nodes={nodes}
          edges={edges}
          speakers={speakers}
          highlight={highlight}
          focusNode={focusNode}
          onSelect={(id) => {
            setSpeakerSel(id);
            setSelected(null);
          }}
        />
      </div>

      {/* 노드 선택 시 — 그 인물의 발언 목록 헤더 */}
      {speakerSel && searchDocs && (
        <p className="text-[14px] text-mut">
          <strong className="text-ink">
            {(speakers[speakerSel] ?? UNKNOWN_SPEAKER).name}
          </strong>
          {(speakers[speakerSel] ?? UNKNOWN_SPEAKER).role && (
            <span className="ml-1.5 text-[13px]">{(speakers[speakerSel] ?? UNKNOWN_SPEAKER).role}</span>
          )}{" "}
          — 관련 발언·지시 <strong className="text-[#ffd60a]">{speakerDocs.length}건</strong>
          {speakerDocs.length === 0 && " (재구성된 발언 기록이 없습니다)"}
        </p>
      )}

      {docs.length > 0 && (
        <div className="space-y-2">
          {docs.map((doc, i) => {
            const kindStyle = TURN_KIND_STYLE[doc.kind] ?? {
              label: doc.kind,
              className:
                doc.kind === "AI·데이터"
                  ? "border-transparent bg-[rgba(10,132,255,0.16)] text-[#64b5ff]"
                  : "border-transparent bg-tint2 text-mut",
            };
            const isSelected = selected === i;
            const hasThread = Boolean(doc.exchangeId && exchangeIndex?.[`${doc.meetingId}#${doc.exchangeId}`]);
            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelected(isSelected ? null : i);
                  const firstKnown = doc.speakerIds.find((id) => id !== "unknown");
                  setFocusNode(isSelected ? null : firstKnown ?? null);
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLElement).click()}
                className={`panel flex cursor-pointer items-start gap-3 p-4 transition ${
                  isSelected ? "ring-2 ring-[#ffd60a]/60" : "hover:bg-tint"
                }`}
              >
                <span className={`chip mt-0.5 shrink-0 ${kindStyle.className}`}>{kindStyle.label}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] leading-relaxed text-body">
                    {doc.speakerNames && (
                      <strong className="mr-1.5 text-ink">{doc.speakerNames.split(" ")[0]}</strong>
                    )}
                    {doc.text}
                  </p>
                  {hasThread && !isSelected && (
                    <p className="mt-1 text-[12.5px] font-medium text-[#ffd60a]/80">
                      클릭하면 이 발언이 오간 대화 전체가 펼쳐지고, 그래프가 발언자에게 이동합니다
                    </p>
                  )}
                  {isSelected && selectedExchange && (
                    <div className="mt-3 space-y-2 border-t border-hair pt-3" onClick={(e) => e.stopPropagation()}>
                      <p className="text-[13px] font-semibold text-mut">
                        대화 스레드 「{selectedExchange.topic}」 — {selectedExchange.turns.length}개 발언
                      </p>
                      {selectedExchange.turns.map((turn, ti) => {
                        const sp = speakers[turn.speakerId] ?? UNKNOWN_SPEAKER;
                        const k = TURN_KIND_STYLE[turn.kind] ?? TURN_KIND_STYLE["발언"];
                        return (
                          <div
                            key={ti}
                            className="flex gap-2.5"
                            style={{ marginLeft: turn.inReplyTo !== null ? 20 : 0 }}
                          >
                            <SpeakerAvatar speaker={sp} size="sm" />
                            <div className="bubble flex-1 !p-2.5">
                              <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                                <span className="text-[13.5px] font-semibold text-ink">{sp.name}</span>
                                <span className={`chip ${k.className}`}>{k.label}</span>
                                <a
                                  href={youtubeUrlAt(doc.videoId, turn.timestamp)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="ml-auto font-mono text-[12px] text-faint hover:text-ink"
                                >
                                  ▶ {formatTime(turn.timestamp)}
                                </a>
                              </div>
                              <p className="text-[13.5px] leading-relaxed text-body">{turn.summary}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-mut">
                    <Link
                      href={
                        doc.exchangeId
                          ? `/meetings/${doc.meetingId}#${doc.exchangeId}`
                          : `/meetings/${doc.meetingId}`
                      }
                      className="text-accent-400 hover:underline"
                    >
                      {doc.meetingTitle} · {doc.date}
                    </Link>
                    {doc.videoId && (
                      <a
                        href={youtubeUrlAt(doc.videoId, doc.timestamp)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-faint hover:text-ink"
                      >
                        ▶ {formatTime(doc.timestamp)}
                      </a>
                    )}
                    {doc.topic && <span>#{doc.topic}</span>}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
