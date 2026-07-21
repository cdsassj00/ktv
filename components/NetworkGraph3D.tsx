"use client";

import { useEffect, useRef, useState } from "react";
import type { NetworkEdge, NetworkNode, SpeakerMap } from "@/lib/types";
import { UNKNOWN_SPEAKER } from "@/lib/client-data";
import NetworkGraph from "./NetworkGraph";

/* 은하 팔레트 */
const STAR = {
  president: "#ff6b81",
  minister: "#7fb7ff",
  unknown: "#9aa3b2",
  gold: "#ffd257",
  directive: "#ff5c72",
  reply: "#5f9dff",
  mention: "#3c4358",
  dimLink: "rgba(50,55,75,0.18)",
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

/** 부드러운 원형 글로우 텍스처 (별 광륜용) */
function makeGlowTexture(THREE: typeof import("three")) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.45)");
  g.addColorStop(0.6, "rgba(255,255,255,0.12)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

interface NodeParts {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  group: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coreMat: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  haloMat: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  label: any;
  base: string;
}

/**
 * 3D 발언 네트워크 — 은하 컨셉 v2.
 * 노드 = 발광 코어 + 광륜 스프라이트(진짜 별처럼), 성운 레이어 + 이중 스타필드 + 블랙 안개.
 * 검색 하이라이트는 재질을 직접 갱신(골드 점등/디밍), 호버 확대, 카메라 비행.
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
  const partsRef = useRef<Map<string, NodeParts>>(new Map());

  /* 하이라이트·호버 상태를 노드 재질에 직접 반영 */
  const applyNodeStyles = () => {
    const hl = hlRef.current;
    for (const [id, p] of partsRef.current) {
      const hovered = hoverRef.current === id;
      const lit = hovered || (hl ? hl.nodes.has(id) : false);
      const dimmed = hl ? !hl.nodes.has(id) && !hovered : false;
      const color = lit && (hl || hovered) ? STAR.gold : p.base;
      p.coreMat.color.set(color);
      p.haloMat.color.set(color);
      p.coreMat.opacity = dimmed ? 0.12 : 1;
      p.haloMat.opacity = dimmed ? 0.04 : lit ? 1 : 0.8;
      p.label.material.opacity = dimmed ? 0.15 : 1;
      const s = hovered ? 1.35 : lit && hl ? 1.15 : 1;
      p.group.scale.set(s, s, s);
    }
  };

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
        const glowTex = makeGlowTexture(THREE);
        partsRef.current.clear();

        const data = {
          nodes: nodes.map((n) => {
            const sp = speakers[n.speakerId] ?? UNKNOWN_SPEAKER;
            return {
              id: n.speakerId,
              name: `${sp.name} · ${sp.role}`,
              label: sp.name,
              val: 3 + Math.min(14, n.turnCount * 1.6),
              base:
                n.speakerId === "president"
                  ? STAR.president
                  : n.speakerId === "unknown"
                    ? STAR.unknown
                    : STAR.minister,
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
          .backgroundColor("#000004")
          .showNavInfo(false)
          .nodeVal("val")
          /* 기본 구체를 버리고 커스텀 별(코어+광륜+라벨)로 대체 */
          .nodeThreeObjectExtend(false)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .nodeThreeObject((node: any) => {
            const r = Math.cbrt(node.val) * 2.1;
            const group = new THREE.Group();

            const coreMat = new THREE.MeshBasicMaterial({
              color: node.base,
              transparent: true,
            });
            const core = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24), coreMat);

            const haloMat = new THREE.SpriteMaterial({
              map: glowTex,
              color: node.base,
              transparent: true,
              opacity: 0.8,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            });
            const halo = new THREE.Sprite(haloMat);
            halo.scale.set(r * 7, r * 7, 1);

            const label = new SpriteText(node.label);
            label.color = "#eef1f8";
            label.textHeight = 3.6;
            label.fontWeight = "600";
            label.material.transparent = true;
            label.material.depthWrite = false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (label as any).position.set(0, -(r + 5.5), 0);

            group.add(halo, core, label);
            partsRef.current.set(node.id, { group, coreMat, haloMat, label, base: node.base });
            return group;
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .linkColor((l: any) => {
            const hl = hlRef.current;
            const base = STAR[l.kind as NetworkEdge["kind"]] ?? STAR.mention;
            if (!hl) return base;
            const key = `${l.source?.id ?? l.source}→${l.target?.id ?? l.target}`;
            return hl.pairs.has(key) ? STAR.gold : STAR.dimLink;
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .linkWidth((l: any) => (l.kind === "directive" ? 1.1 : 0.4))
          .linkOpacity(0.35)
          .linkCurvature(0.22)
          .linkDirectionalArrowLength(0)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .linkDirectionalParticles((l: any) => (!reduce && l.kind === "directive" ? 1 + Math.min(3, l.count) : 0))
          .linkDirectionalParticleWidth(1.3)
          .linkDirectionalParticleSpeed(0.0038)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .onNodeHover((node: any) => {
            hoverRef.current = node?.id ?? null;
            if (containerRef.current)
              containerRef.current.style.cursor = node ? "pointer" : "default";
            applyNodeStyles();
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .onNodeClick((node: any) => {
            window.location.href = `/speakers/${node.id}`;
          });

        // ── 은하 연출 ──────────────────────────────
        const scene = graph.scene();

        // 1) 이중 스타필드: 원경(작고 흐림) + 근경(크고 또렷, 일부 컬러)
        const makeStars = (count: number, rMin: number, rMax: number, size: number, color: number, opacity: number) => {
          const geo = new THREE.BufferGeometry();
          const pos = new Float32Array(count * 3);
          for (let i = 0; i < count; i++) {
            const r = rMin + Math.random() * (rMax - rMin);
            const th = Math.random() * Math.PI * 2;
            const ph = Math.acos(2 * Math.random() - 1);
            pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
            pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
            pos[i * 3 + 2] = r * Math.cos(ph);
          }
          geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
          return new THREE.Points(
            geo,
            new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false })
          );
        };
        scene.add(makeStars(2200, 700, 1900, 1.1, 0xcdd6ee, 0.5));
        scene.add(makeStars(400, 500, 1200, 2.2, 0xffffff, 0.75));
        scene.add(makeStars(160, 500, 1400, 2.6, 0x9db8ff, 0.5));

        // 2) 성운 레이어 — 큰 글로우 스프라이트를 낮은 불투명도로 흩뿌림
        const nebula = (color: string, scale: number, x: number, y: number, z: number, opacity: number) => {
          const m = new THREE.SpriteMaterial({
            map: glowTex, color, transparent: true, opacity,
            depthWrite: false, blending: THREE.AdditiveBlending,
          });
          const s = new THREE.Sprite(m);
          s.scale.set(scale, scale, 1);
          s.position.set(x, y, z);
          return s;
        };
        scene.add(nebula("#2b3d8f", 900, -260, 140, -420, 0.10));
        scene.add(nebula("#5b2d8f", 760, 300, -180, -520, 0.08));
        scene.add(nebula("#0e4f6e", 640, 60, 260, -350, 0.07));

        // 3) 원경이 검게 잦아드는 안개 (보라색 워시 제거)
        scene.fog = new THREE.FogExp2(0x000004, 0.00115);

        // 4) 절제된 블룸 — 광륜·파티클만 은은히
        const bloom = new UnrealBloomPass(new THREE.Vector2(1024, 1024), 0.55, 0.5, 0.28);
        graph.postProcessingComposer().addPass(bloom);

        graph.d3Force("charge")?.strength(-210);
        graph.d3Force("link")?.distance(70);
        graph.cameraPosition({ z: 260 });

        const controls = graph.controls();
        if (controls && !reduce) {
          controls.autoRotate = true;
          controls.autoRotateSpeed = 0.5;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, speakers]);

  /* 검색 하이라이트 → 재질 직접 갱신 + 링크 색 재적용 */
  useEffect(() => {
    hlRef.current = highlight
      ? { nodes: new Set(highlight.nodes), pairs: new Set(highlight.pairs) }
      : null;
    applyNodeStyles();
    const g = graphRef.current;
    if (g) g.linkColor(g.linkColor());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight, status]);

  /* 검색 결과 클릭 → 해당 발언자 노드로 카메라 비행 */
  useEffect(() => {
    const g = graphRef.current;
    if (!g || !focusNode) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = g.graphData().nodes.find((n: any) => n.id === focusNode);
    if (!node || node.x === undefined) return;
    const dist = 95;
    const len = Math.hypot(node.x, node.y, node.z) || 1;
    const ratio = 1 + dist / len;
    g.controls().autoRotate = false;
    g.cameraPosition({ x: node.x * ratio, y: node.y * ratio, z: node.z * ratio }, node, 1400);
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
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#000004]">
          <span className="spinner" />
          <span className="on-dark-mut text-xs font-semibold">은하 네트워크 준비 중…</span>
        </div>
      )}
      <div ref={containerRef} className="min-h-[600px] w-full" />
    </div>
  );
}
