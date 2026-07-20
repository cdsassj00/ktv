"use client";

import { useState } from "react";
import type { NetworkEdge, NetworkNode, SpeakerMap } from "@/lib/types";
import NetworkGraph from "./NetworkGraph";
import NetworkGraph3D from "./NetworkGraph3D";

/** 3D(기본) / 2D 전환 가능한 네트워크 뷰 */
export default function NetworkView({
  nodes,
  edges,
  speakers,
}: {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  speakers: SpeakerMap;
}) {
  const [mode, setMode] = useState<"3d" | "2d">("3d");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-sm font-medium text-body">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 rounded bg-[#d70015]" style={{ height: 3 }} /> 지시
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-6 rounded bg-[#0066cc]" /> 답변·보고
          </span>
        </div>
        <div className="flex gap-1 rounded-full bg-tint2 p-1">
          {(["3d", "2d"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-medium uppercase transition ${
                mode === m ? "bg-white text-ink shadow-sm" : "text-mut hover:text-ink"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode === "3d" ? (
        <>
          <NetworkGraph3D nodes={nodes} edges={edges} speakers={speakers} />
          <p className="text-xs text-mut">
            드래그로 회전 · 휠로 줌 · 노드 클릭 시 발언자 페이지로 이동. 코랄색 파티클이 흐르는
            선이 <strong>지시</strong>입니다.
          </p>
        </>
      ) : (
        <div className="panel p-4">
          <NetworkGraph nodes={nodes} edges={edges} speakers={speakers} />
        </div>
      )}
    </div>
  );
}
