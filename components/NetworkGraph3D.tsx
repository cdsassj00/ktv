"use client";

import { useEffect, useRef, useState } from "react";
import type { NetworkEdge, NetworkNode, SpeakerMap } from "@/lib/types";
import { UNKNOWN_SPEAKER } from "@/lib/client-data";
import NetworkGraph from "./NetworkGraph";

const EDGE_COLOR: Record<NetworkEdge["kind"], string> = {
  directive: "#ff453a",
  reply: "#0a84ff",
  mention: "#98989d",
};

function webglAvailable(): boolean {
  try {
    const cv = document.createElement("canvas");
    return Boolean(cv.getContext("webgl2") ?? cv.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * 3D 발언 네트워크 — three.js(3d-force-graph) 기반.
 * 드래그로 회전, 휠로 줌. 지시 엣지는 코랄색 파티클이 흐르는 굵은 선.
 * 로딩 중 코닉 스피너, WebGL 미지원 시 2D SVG 그래프로 폴백.
 */
export interface GraphHighlight {
  nodes: string[];
  pairs: string[]; // "from→to" (지시 엣지)
}

export default function NetworkGraph3D({
  nodes,
  edges,
  speakers,
  highlight,
}: {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  speakers: SpeakerMap;
  highlight?: GraphHighlight | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const hlRef = useRef<{ nodes: Set<string>; pairs: Set<string> } | null>(null);

  useEffect(() => {
    let disposed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let graph: any;

    (async () => {
      if (!webglAvailable()) {
        setStatus("fallback");
        return;
      }
      try {
        const [{ default: ForceGraph3D }, { default: SpriteText }] = await Promise.all([
          import("3d-force-graph"),
          import("three-spritetext"),
        ]);
        if (disposed || !containerRef.current) return;

        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const data = {
          nodes: nodes.map((n) => {
            const sp = speakers[n.speakerId] ?? UNKNOWN_SPEAKER;
            return {
              id: n.speakerId,
              name: `${sp.name} · ${sp.role}`,
              label: sp.name,
              val: 4 + Math.min(20, n.turnCount * 3),
              color: n.speakerId === "president" ? "#ff453a" : "#64a0ff",
            };
          }),
          links: edges.map((e) => ({
            source: e.source,
            target: e.target,
            kind: e.kind,
            count: e.count,
          })),
        };

        graph = new ForceGraph3D(containerRef.current)
          .graphData(data)
          .width(containerRef.current.clientWidth)
          .height(560)
          .backgroundColor("#000000")
          .showNavInfo(false)
          .nodeVal("val")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .nodeColor((n: any) => {
            const hl = hlRef.current;
            if (!hl) return n.color;
            return hl.nodes.has(n.id) ? "#ffd60a" : "rgba(110,110,115,0.22)";
          })
          .nodeOpacity(0.92)
          .nodeThreeObjectExtend(true)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .nodeThreeObject((node: any) => {
            const sprite = new SpriteText(node.label);
            sprite.color = "#ffffff";
            sprite.textHeight = 4.5;
            sprite.fontWeight = "700";
            (sprite as unknown as { position: { set: (x: number, y: number, z: number) => void } })
              .position.set(0, -(2 + Math.cbrt(node.val) * 2.5), 0);
            return sprite;
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .linkColor((l: any) => {
            const hl = hlRef.current;
            const base = EDGE_COLOR[l.kind as NetworkEdge["kind"]];
            if (!hl) return base;
            const key = `${l.source?.id ?? l.source}→${l.target?.id ?? l.target}`;
            return hl.pairs.has(key) ? "#ffd60a" : "rgba(58,58,60,0.35)";
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .linkWidth((l: any) => (l.kind === "directive" ? 1.8 : 0.7))
          .linkOpacity(0.55)
          .linkDirectionalArrowLength(4)
          .linkDirectionalArrowRelPos(0.92)
          // 파티클은 상시 애니메이션이므로 reduced-motion에서는 끔
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .linkDirectionalParticles((l: any) => (!reduce && l.kind === "directive" ? 2 + l.count : 0))
          .linkDirectionalParticleWidth(1.6)
          .linkDirectionalParticleSpeed(0.006)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .onNodeClick((node: any) => {
            window.location.href = `/speakers/${node.id}`;
          });

        graph.d3Force("charge")?.strength(-180);
        graph.d3Force("link")?.distance(60);
        graph.cameraPosition({ z: 230 });
        // 사용자가 잡기 전까지 천천히 자동 회전 (reduced-motion 시 정지)
        const controls = graph.controls();
        if (controls && !reduce) {
          controls.autoRotate = true;
          controls.autoRotateSpeed = 0.6;
          controls.addEventListener?.("start", () => {
            controls.autoRotate = false;
          });
        }
        graphRef.current = graph;
        setStatus("ready");
      } catch {
        setStatus("fallback");
      }
    })();

    return () => {
      disposed = true;
      graph?._destructor?.();
    };
  }, [nodes, edges, speakers]);

  useEffect(() => {
    hlRef.current = highlight
      ? { nodes: new Set(highlight.nodes), pairs: new Set(highlight.pairs) }
      : null;
    const g = graphRef.current;
    if (g) {
      // 같은 접근자를 다시 설정해 재렌더 트리거
      g.nodeColor(g.nodeColor());
      g.linkColor(g.linkColor());
    }
  }, [highlight]);

  if (status === "fallback") {
    return (
      <div className="panel p-4">
        <p className="mb-2 text-xs text-mut">3D를 지원하지 않는 환경이라 2D 그래프로 표시합니다.</p>
        <NetworkGraph nodes={nodes} edges={edges} speakers={speakers} />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-card">
      {status === "loading" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black">
          <span className="spinner" />
          <span className="on-dark-mut text-xs font-semibold">3D 네트워크 준비 중…</span>
        </div>
      )}
      <div ref={containerRef} className="min-h-[560px] w-full" />
    </div>
  );
}
