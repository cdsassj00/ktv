"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import type { NetworkEdge, NetworkNode, SearchDoc, SpeakerMap } from "@/lib/types";
import { formatTime, TURN_KIND_STYLE, youtubeUrlAt } from "@/lib/utils";
import NetworkGraph from "./NetworkGraph";
import NetworkGraph3D, { type GraphHighlight } from "./NetworkGraph3D";

/**
 * 3D(기본)/2D 네트워크 + Fuse.js 퍼지 검색.
 * 검색어 입력 → 지시·보고·답변·AI 발언·안건에서 연관 항목 매칭 →
 * 그래프에서 관련 발언자 노드·지시 엣지를 골드로 하이라이트(나머지 디밍) + 결과 리스트.
 */
export default function NetworkView({
  nodes,
  edges,
  speakers,
  searchDocs,
}: {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  speakers: SpeakerMap;
  searchDocs?: SearchDoc[];
}) {
  const [mode, setMode] = useState<"3d" | "2d">("3d");
  const [query, setQuery] = useState("");

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

  const highlight: GraphHighlight | null = useMemo(() => {
    if (results.length === 0) return null;
    const ns = new Set<string>();
    const pairs = new Set<string>();
    for (const doc of results) {
      doc.speakerIds.forEach((id) => id !== "unknown" && ns.add(id));
      if (doc.kind === "지시" && doc.speakerIds.length >= 2) {
        const [from, ...to] = doc.speakerIds;
        to.forEach((t) => pairs.add(`${from}→${t}`));
      }
    }
    return { nodes: [...ns], pairs: [...pairs] };
  }, [results]);

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
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="검색: 부동산, AI, 물가, 자살예방, 촉법소년…"
              className="w-full rounded-full bg-surf py-2.5 pl-10 pr-4 text-[14px] text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent-500"
              aria-label="회의 내용 검색"
            />
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 text-sm font-medium text-body">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-6 rounded bg-[#ff453a]" style={{ height: 3 }} /> 지시
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-6 rounded bg-[#0a84ff]" /> 답변·보고
            </span>
          </div>
        )}
        <div className="flex gap-1 rounded-full bg-tint2 p-1">
          {(["3d", "2d"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-medium uppercase transition ${
                mode === m ? "bg-black/40 text-ink" : "text-mut hover:text-ink"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {query.trim().length >= 2 && (
        <p className="text-[13px] text-mut">
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

      {mode === "3d" ? (
        <NetworkGraph3D nodes={nodes} edges={edges} speakers={speakers} highlight={highlight} />
      ) : (
        <div className="panel p-4">
          <NetworkGraph nodes={nodes} edges={edges} speakers={speakers} highlight={highlight} />
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((doc, i) => {
            const kindStyle = TURN_KIND_STYLE[doc.kind] ?? {
              label: doc.kind,
              className:
                doc.kind === "AI·데이터"
                  ? "border-transparent bg-[rgba(10,132,255,0.16)] text-[#64b5ff]"
                  : "border-transparent bg-tint2 text-mut",
            };
            return (
              <div key={i} className="panel flex items-start gap-3 p-4">
                <span className={`chip mt-0.5 shrink-0 ${kindStyle.className}`}>{kindStyle.label}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-body">
                    {doc.speakerNames && (
                      <strong className="mr-1.5 text-ink">{doc.speakerNames.split(" ")[0]}</strong>
                    )}
                    {doc.text}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-mut">
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
