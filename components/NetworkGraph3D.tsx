"use client";

import { useEffect, useRef } from "react";
import type { NetworkEdge, NetworkNode, SpeakerMap } from "@/lib/types";
import { UNKNOWN_SPEAKER } from "@/lib/client-data";

const EDGE_COLOR: Record<NetworkEdge["kind"], string> = {
  directive: "#f95d43",
  reply: "#5b83b8",
  mention: "#64748b",
};

/**
 * 3D 발언 네트워크 — three.js(3d-force-graph) 기반.
 * 드래그로 회전, 휠로 줌. 지시 엣지는 코랄색 파티클이 흐르는 굵은 선.
 * SSR 불가 라이브러리이므로 useEffect에서 동적 import.
 */
export default function NetworkGraph3D({
  nodes,
  edges,
  speakers,
}: {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  speakers: SpeakerMap;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let graph: any;

    (async () => {
      const [{ default: ForceGraph3D }, { default: SpriteText }] = await Promise.all([
        import("3d-force-graph"),
        import("three-spritetext"),
      ]);
      if (disposed || !containerRef.current) return;

      const data = {
        nodes: nodes.map((n) => {
          const sp = speakers[n.speakerId] ?? UNKNOWN_SPEAKER;
          return {
            id: n.speakerId,
            name: `${sp.name} · ${sp.role}`,
            label: sp.name,
            val: 4 + Math.min(20, n.turnCount * 3),
            color: n.speakerId === "president" ? "#f95d43" : "#8aa9d1",
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
        .backgroundColor("#081226")
        .showNavInfo(false)
        .nodeVal("val")
        .nodeColor("color")
        .nodeOpacity(0.92)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .nodeThreeObjectExtend(true)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .nodeThreeObject((node: any) => {
          const sprite = new SpriteText(node.label);
          sprite.color = "#ffffff";
          sprite.textHeight = 4.5;
          sprite.fontWeight = "700";
          // three 버전 간 타입 불일치로 Object3D.position이 타입에 노출되지 않아 캐스팅
          (sprite as unknown as { position: { set: (x: number, y: number, z: number) => void } })
            .position.set(0, -(2 + Math.cbrt(node.val) * 2.5), 0);
          return sprite;
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .linkColor((l: any) => EDGE_COLOR[l.kind as NetworkEdge["kind"]])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .linkWidth((l: any) => (l.kind === "directive" ? 1.8 : 0.7))
        .linkOpacity(0.55)
        .linkDirectionalArrowLength(4)
        .linkDirectionalArrowRelPos(0.92)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .linkDirectionalParticles((l: any) => (l.kind === "directive" ? 2 + l.count : 0))
        .linkDirectionalParticleWidth(1.6)
        .linkDirectionalParticleSpeed(0.006)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .onNodeClick((node: any) => {
          window.location.href = `/speakers/${node.id}`;
        });

      // 노드가 덜 뭉치도록 반발력·링크 거리 조정
      graph.d3Force("charge")?.strength(-180);
      graph.d3Force("link")?.distance(60);
      graph.cameraPosition({ z: 230 });
    })();

    return () => {
      disposed = true;
      graph?._destructor?.();
    };
  }, [nodes, edges, speakers]);

  return (
    <div className="overflow-hidden rounded-2xl border border-navy-800 shadow-lift">
      <div ref={containerRef} className="min-h-[560px] w-full" />
    </div>
  );
}
