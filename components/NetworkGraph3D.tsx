"use client";

import { useEffect, useRef, useState } from "react";
import type { NetworkEdge, NetworkNode, SpeakerMap } from "@/lib/types";
import { UNKNOWN_SPEAKER } from "@/lib/client-data";
import NetworkGraph from "./NetworkGraph";

/* 네온 팔레트 — 은하수 톤 */
const NEON = {
  president: "#e04a63",
  minister: "#4a8fd6",
  directive: "#e04a63",
  reply: "#4a8fd6",
  mention: "#8e8e93",
  gold: "#ffd60a",
  dimNode: "rgba(90,95,110,0.18)",
  dimLink: "rgba(60,64,80,0.25)",
};

export interface GraphHighlight {
  nodes: string[];
  pairs: string[]; // "from→to" (지시 엣지)
}

function webglAvailable(): boolean {
  try {
    const cv = document.createElement("canvas");
    return Boolean(cv.getContext("webgl2") ?? cv.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * 3D 발언 네트워크 — 은하수 컨셉.
 * UnrealBloom 네온 글로우 + 스타필드 + 안개 원근 + 호버 확대 + 검색 연동 카메라 비행.
 * WebGL 미지원 시 2D SVG 폴백, reduced-motion 시 회전·파티클 정지.
 */
export default function NetworkGraph3D({
  nodes,
  edges,
  speakers,
  highlight,
  focusNode,
}: {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  speakers: SpeakerMap;
  highlight?: GraphHighlight | null;
  focusNode?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const hlRef = useRef<{ nodes: Set<string>; pairs: Set<string> } | null>(null);
  const hoverRef = useRef<string | null>(null);

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
        const [{ default: ForceGraph3D }, { default: SpriteText }, THREE, { UnrealBloomPass }] =
          await Promise.all([
            import("3d-force-graph"),
            import("three-spritetext"),
            import("three"),
            import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
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
              color: n.speakerId === "president" ? NEON.president : NEON.minister,
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
          .height(600)
          .backgroundColor("#030014")
          .showNavInfo(false)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .nodeVal((n: any) => (hoverRef.current === n.id ? n.val * 1.9 : n.val))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .nodeColor((n: any) => {
            const hl = hlRef.current;
            if (hoverRef.current === n.id) return "#e0b400";
            if (!hl) return n.color;
            return hl.nodes.has(n.id) ? "#e0b400" : NEON.dimNode;
          })
          .nodeOpacity(1)
          .nodeResolution(24)
          .nodeThreeObjectExtend(true)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .nodeThreeObject((node: any) => {
            const sprite = new SpriteText(node.label);
            sprite.color = "rgba(245,245,247,0.92)";
            sprite.textHeight = 4.6;
            sprite.fontWeight = "700";
            (sprite as unknown as { position: { set: (x: number, y: number, z: number) => void } })
              .position.set(0, -(2 + Math.cbrt(node.val) * 2.6), 0);
            return sprite;
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .linkColor((l: any) => {
            const hl = hlRef.current;
            const base = NEON[l.kind as NetworkEdge["kind"]] ?? NEON.mention;
            if (!hl) return base;
            const key = `${l.source?.id ?? l.source}→${l.target?.id ?? l.target}`;
            return hl.pairs.has(key) ? NEON.gold : NEON.dimLink;
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .linkWidth((l: any) => (l.kind === "directive" ? 1.6 : 0.55))
          .linkOpacity(0.42)
          .linkCurvature(0.18)
          .linkDirectionalArrowLength(3.6)
          .linkDirectionalArrowRelPos(0.9)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .linkDirectionalParticles((l: any) => (!reduce && l.kind === "directive" ? 2 + l.count : 0))
          .linkDirectionalParticleWidth(2.2)
          .linkDirectionalParticleSpeed(0.0045)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .onNodeHover((node: any) => {
            hoverRef.current = node?.id ?? null;
            if (containerRef.current)
              containerRef.current.style.cursor = node ? "pointer" : "default";
            graph.nodeColor(graph.nodeColor());
            graph.nodeVal(graph.nodeVal());
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .onNodeClick((node: any) => {
            window.location.href = `/speakers/${node.id}`;
          });

        // ── 은하수 연출 ──────────────────────────────
        // 1) 네온 블룸
        const bloom = new UnrealBloomPass(new THREE.Vector2(1024, 1024), 0.42, 0.4, 0.3);
        graph.postProcessingComposer().addPass(bloom);
        // 2) 스타필드 (배경 별 1500개)
        const starGeo = new THREE.BufferGeometry();
        const starPos = new Float32Array(1500 * 3);
        for (let i = 0; i < 1500; i++) {
          const r = 900 + Math.random() * 1200;
          const th = Math.random() * Math.PI * 2;
          const ph = Math.acos(2 * Math.random() - 1);
          starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
          starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
          starPos[i * 3 + 2] = r * Math.cos(ph);
        }
        starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
        const stars = new THREE.Points(
          starGeo,
          new THREE.PointsMaterial({ color: 0x8899ff, size: 1.6, transparent: true, opacity: 0.4 })
        );
        graph.scene().add(stars);
        // 3) 성운 안개(원근감)
        graph.scene().fog = new THREE.FogExp2(0x05001c, 0.0016);

        graph.d3Force("charge")?.strength(-190);
        graph.d3Force("link")?.distance(62);
        graph.cameraPosition({ z: 240 });

        const controls = graph.controls();
        if (controls && !reduce) {
          controls.autoRotate = true;
          controls.autoRotateSpeed = 0.55;
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

  /* 검색 하이라이트 반영 */
  useEffect(() => {
    hlRef.current = highlight
      ? { nodes: new Set(highlight.nodes), pairs: new Set(highlight.pairs) }
      : null;
    const g = graphRef.current;
    if (g) {
      g.nodeColor(g.nodeColor());
      g.linkColor(g.linkColor());
    }
  }, [highlight]);

  /* 검색 결과 클릭 → 해당 발언자 노드로 카메라 비행 */
  useEffect(() => {
    const g = graphRef.current;
    if (!g || !focusNode) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = g.graphData().nodes.find((n: any) => n.id === focusNode);
    if (!node || node.x === undefined) return;
    const dist = 85;
    const len = Math.hypot(node.x, node.y, node.z) || 1;
    const ratio = 1 + dist / len;
    g.controls().autoRotate = false;
    g.cameraPosition(
      { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
      node,
      1400
    );
  }, [focusNode]);

  if (status === "fallback") {
    return (
      <div className="panel p-4">
        <p className="mb-2 text-xs text-mut">3D를 지원하지 않는 환경이라 2D 그래프로 표시합니다.</p>
        <NetworkGraph nodes={nodes} edges={edges} speakers={speakers} highlight={highlight} />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-card">
      {status === "loading" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#030014]">
          <span className="spinner" />
          <span className="on-dark-mut text-xs font-semibold">은하수 네트워크 준비 중…</span>
        </div>
      )}
      <div ref={containerRef} className="min-h-[600px] w-full" />
    </div>
  );
}
