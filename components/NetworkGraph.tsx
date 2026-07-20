"use client";

import type { NetworkEdge, NetworkNode, SpeakerMap } from "@/lib/types";
import { UNKNOWN_SPEAKER } from "@/lib/client-data";

const W = 800;
const H = 520;
const CX = W / 2;
const CY = H / 2 - 10;

const EDGE_STYLE: Record<
  NetworkEdge["kind"],
  { stroke: string; width: number; dash?: string; marker: string }
> = {
  directive: { stroke: "#d70015", width: 2.5, marker: "arrow-red" },
  reply: { stroke: "#0066cc", width: 1.5, marker: "arrow-navy" },
  mention: { stroke: "#86868b", width: 1, dash: "4 3", marker: "arrow-gray" },
};

/**
 * 발언 네트워크 — 외부 라이브러리 없이 SVG로 그린다.
 * 대통령(president)을 중심에, 나머지 발언자를 타원 위에 배치.
 * 노드 크기 = 발언량, 엣지 = 지시(빨강 굵음) / 답변·보고(네이비) / 언급(점선).
 */
export default function NetworkGraph({
  nodes,
  edges,
  speakers,
}: {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  speakers: SpeakerMap;
}) {
  if (nodes.length === 0) {
    return <p className="p-4 text-sm text-slate-500">네트워크를 그릴 발언 데이터가 없습니다.</p>;
  }

  const center = nodes.find((n) => n.speakerId === "president");
  const ring = nodes.filter((n) => n.speakerId !== "president");

  const pos = new Map<string, { x: number; y: number }>();
  if (center) pos.set(center.speakerId, { x: CX, y: CY });
  ring.forEach((n, i) => {
    // 중심 노드가 없으면 전원을 타원에 배치
    const angle = (2 * Math.PI * i) / ring.length - Math.PI / 2;
    pos.set(n.speakerId, {
      x: CX + Math.cos(angle) * 300,
      y: CY + Math.sin(angle) * 185,
    });
  });

  const radius = (n: NetworkNode) => 16 + Math.min(14, n.turnCount * 2);
  const radiusOf = new Map(nodes.map((n) => [n.speakerId, radius(n)]));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="발언 네트워크 그래프">
      <defs>
        {(
          [
            ["arrow-red", "#d70015"],
            ["arrow-navy", "#0066cc"],
            ["arrow-gray", "#86868b"],
          ] as const
        ).map(([id, color]) => (
          <marker
            key={id}
            id={id}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          </marker>
        ))}
        {nodes.map((n) => (
          <clipPath key={n.speakerId} id={`clip-${n.speakerId}`}>
            <circle
              cx={pos.get(n.speakerId)!.x}
              cy={pos.get(n.speakerId)!.y}
              r={radiusOf.get(n.speakerId)!}
            />
          </clipPath>
        ))}
      </defs>

      {/* 엣지 */}
      {edges.map((e, i) => {
        const s = pos.get(e.source);
        const t = pos.get(e.target);
        if (!s || !t) return null;
        const style = EDGE_STYLE[e.kind];
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const sr = (radiusOf.get(e.source) ?? 16) + 2;
        const tr = (radiusOf.get(e.target) ?? 16) + 8;
        const x1 = s.x + ux * sr;
        const y1 = s.y + uy * sr;
        const x2 = t.x - ux * tr;
        const y2 = t.y - uy * tr;
        // 양방향 엣지가 겹치지 않도록 수직 방향으로 살짝 휘어줌
        const mx = (x1 + x2) / 2 - uy * 22;
        const my = (y1 + y2) / 2 + ux * 22;
        return (
          <g key={i}>
            <path
              d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
              fill="none"
              stroke={style.stroke}
              strokeWidth={style.width}
              strokeDasharray={style.dash}
              markerEnd={`url(#${style.marker})`}
              opacity={0.85}
            />
            {e.count > 1 && (
              <text x={mx} y={my} fontSize="11" fill={style.stroke} textAnchor="middle" dy="-2">
                ×{e.count}
              </text>
            )}
          </g>
        );
      })}

      {/* 노드 */}
      {nodes.map((n) => {
        const p = pos.get(n.speakerId)!;
        const r = radiusOf.get(n.speakerId)!;
        const sp = speakers[n.speakerId] ?? UNKNOWN_SPEAKER;
        return (
          <a key={n.speakerId} href={`/speakers/${n.speakerId}`}>
            <g className="cursor-pointer">
              <circle cx={p.x} cy={p.y} r={r} fill="#1d1d1f" stroke="#fff" strokeWidth="2.5" />
              {sp.photo ? (
                <image
                  href={sp.photo}
                  x={p.x - r}
                  y={p.y - r}
                  width={r * 2}
                  height={r * 2}
                  clipPath={`url(#clip-${n.speakerId})`}
                  preserveAspectRatio="xMidYMid slice"
                />
              ) : (
                <text
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={r * 0.9}
                  fontWeight="600"
                  fill="#fff"
                >
                  {sp.name.slice(0, 1)}
                </text>
              )}
              <text
                x={p.x}
                y={p.y + r + 14}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill="#1d1d1f"
              >
                {sp.name}
              </text>
              <text x={p.x} y={p.y + r + 27} textAnchor="middle" fontSize="10" fill="#6e6e73">
                {sp.role.length > 14 ? sp.org : sp.role}
              </text>
            </g>
          </a>
        );
      })}
    </svg>
  );
}
