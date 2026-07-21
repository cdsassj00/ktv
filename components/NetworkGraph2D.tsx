"use client";

import { useEffect, useRef } from "react";
import type { NetworkEdge, NetworkNode, SpeakerMap } from "@/lib/types";
import { UNKNOWN_SPEAKER } from "@/lib/client-data";

export interface GraphHighlight {
  nodes: string[];
  pairs: string[]; // "from→to" (지시 엣지)
}

const COLOR = {
  president: "#ff6b81",
  minister: "#7fb7ff",
  unknown: "#9aa3b2",
  directive: "#ff5c72",
  reply: "#5f9dff",
  mention: "rgba(150,158,178,0.55)",
  gold: "#ffd257",
  ink: "#f5f5f7",
  mut: "#98989d",
};

const TILT = 0.4; // 원탁 기울기 (수직 압축비)

interface OrbitNode {
  id: string;
  name: string;
  role: string;
  photo?: string;
  baseR: number;
  color: string;
  ring: 0 | 1 | 2 | 3; // 0 = 중앙(대통령)
  angle0: number;
  speed: number; // 링별 회전 배속 (시차 효과)
  /* 프레임마다 갱신되는 화면 좌표 */
  sx: number;
  sy: number;
  r: number;
  depth: number; // 0(뒤) ~ 1(앞)
  alpha: number;
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** 2차 베지어 위의 점 */
function qPoint(t: number, x1: number, y1: number, cx: number, cy: number, x2: number, y2: number) {
  const u = 1 - t;
  return {
    x: u * u * x1 + 2 * u * t * cx + t * t * x2,
    y: u * u * y1 + 2 * u * t * cy + t * t * y2,
  };
}

/**
 * 발언 네트워크 2D — 기울어진 원탁(orbital) 원근 뷰.
 * 대통령을 중앙에, 발언자들을 두 겹의 타원 궤도에 배치한다.
 * 궤도가 천천히 돌며 앞쪽 노드는 크고 선명하게, 뒤쪽은 작고 흐리게(원근),
 * 안쪽·바깥 링의 회전 속도 차이로 시차(parallax)를 낸다.
 * 드래그로 회전, 지시 엣지에는 흐르는 파티클, 검색 하이라이트는 골드 점등.
 */
export default function NetworkGraph2D({
  nodes,
  edges,
  speakers,
  highlight,
  focusNode,
  height = 560,
}: {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  speakers: SpeakerMap;
  highlight?: GraphHighlight | null;
  focusNode?: string | null;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbitsRef = useRef<OrbitNode[]>([]);
  const imagesRef = useRef<Map<string, HTMLImageElement | "failed">>(new Map());
  const hlRef = useRef<{ nodes: Set<string>; pairs: Set<string> } | null>(null);
  const hoverRef = useRef<string | null>(null);
  const rotRef = useRef({ value: 0, vel: 0 });
  const focusAnimRef = useRef<{ from: number; to: number; start: number } | null>(null);
  const pulseRef = useRef<{ id: string; start: number } | null>(null);

  /* 노드 → 궤도 배치 (대통령 중앙, 발언량 상위 8명 안쪽 링, 나머지 바깥 링) */
  useEffect(() => {
    const centerId = nodes.some((n) => n.speakerId === "president")
      ? "president"
      : [...nodes].sort((a, b) => b.turnCount - a.turnCount)[0]?.speakerId;
    const rest = [...nodes]
      .filter((n) => n.speakerId !== centerId)
      .sort((a, b) => b.turnCount - a.turnCount);
    /* 발언량 순으로 안쪽부터 3겹 궤도 배치 (인원이 적으면 2겹) */
    const inner = rest.slice(0, 8);
    const useThree = rest.length > 22;
    const mid = useThree ? rest.slice(8, 22) : rest.slice(8);
    const outer = useThree ? rest.slice(22) : [];

    const make = (n: NetworkNode, ring: 0 | 1 | 2 | 3, angle0: number, speed: number): OrbitNode => {
      const sp = speakers[n.speakerId] ?? UNKNOWN_SPEAKER;
      return {
        id: n.speakerId,
        name: sp.name,
        role: sp.role.length > 14 ? sp.org || sp.role : sp.role,
        photo: sp.photo ?? undefined,
        baseR: ring === 0 ? 27 : 14 + Math.min(12, n.turnCount * 1.7),
        color:
          n.speakerId === "president"
            ? COLOR.president
            : n.speakerId === "unknown"
              ? COLOR.unknown
              : COLOR.minister,
        ring,
        angle0,
        speed,
        sx: 0, sy: 0, r: 0, depth: 0.5, alpha: 1,
      };
    };

    const orbits: OrbitNode[] = [];
    const centerNode = nodes.find((n) => n.speakerId === centerId);
    if (centerNode) orbits.push(make(centerNode, 0, 0, 0));
    inner.forEach((n, i) =>
      orbits.push(make(n, 1, Math.PI / 2 + (2 * Math.PI * i) / inner.length, 1))
    );
    mid.forEach((n, i) =>
      orbits.push(make(n, 2, Math.PI / 2 + Math.PI / mid.length + (2 * Math.PI * i) / mid.length, 0.78))
    );
    outer.forEach((n, i) =>
      orbits.push(make(n, 3, Math.PI / 2 + (2 * Math.PI * i) / outer.length, 0.58))
    );
    orbitsRef.current = orbits;

    /* 사진 프리로드 (실패 시 이니셜 디스크로 폴백) */
    for (const o of orbits) {
      if (!o.photo || imagesRef.current.has(o.id)) continue;
      const img = new Image();
      img.onload = () => imagesRef.current.set(o.id, img);
      img.onerror = () => imagesRef.current.set(o.id, "failed");
      img.src = o.photo;
    }
  }, [nodes, speakers]);

  useEffect(() => {
    hlRef.current = highlight
      ? { nodes: new Set(highlight.nodes), pairs: new Set(highlight.pairs) }
      : null;
  }, [highlight]);

  /* 검색 결과 클릭 → 해당 노드가 정면(앞)으로 오도록 궤도 회전 */
  useEffect(() => {
    if (!focusNode) return;
    const o = orbitsRef.current.find((n) => n.id === focusNode);
    if (!o) return;
    pulseRef.current = { id: focusNode, start: performance.now() };
    if (o.ring === 0 || o.speed === 0) return;
    const rot = rotRef.current.value;
    const cur = (o.angle0 + rot * o.speed) % (2 * Math.PI);
    let delta = (Math.PI / 2 - cur) % (2 * Math.PI);
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    focusAnimRef.current = {
      from: rot,
      to: rot + delta / o.speed,
      start: performance.now(),
    };
  }, [focusNode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0;
    let H = height;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = wrap.clientWidth;
      H = height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    /* ── 인터랙션: 드래그 회전 + 호버 + 클릭 ── */
    let dragging = false;
    let moved = 0;
    let lastX = 0;

    const pick = (mx: number, my: number): OrbitNode | null => {
      let best: OrbitNode | null = null;
      for (const o of orbitsRef.current) {
        if (Math.hypot(mx - o.sx, my - o.sy) <= o.r + 6) {
          if (!best || o.depth > best.depth) best = o;
        }
      }
      return best;
    };

    const onDown = (e: PointerEvent) => {
      dragging = true;
      moved = 0;
      lastX = e.clientX;
      focusAnimRef.current = null;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (dragging) {
        const dx = e.clientX - lastX;
        lastX = e.clientX;
        moved += Math.abs(dx);
        rotRef.current.value += dx * 0.006;
        rotRef.current.vel = dx * 0.006;
      } else {
        const hit = pick(e.clientX - rect.left, e.clientY - rect.top);
        hoverRef.current = hit?.id ?? null;
        canvas.style.cursor = hit ? "pointer" : "grab";
      }
    };
    const onUp = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (dragging && moved < 5) {
        const hit = pick(e.clientX - rect.left, e.clientY - rect.top);
        if (hit) window.location.href = `/speakers/${hit.id}`;
      }
      dragging = false;
    };
    const onLeave = () => {
      hoverRef.current = null;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);

    /* ── 렌더 루프 ── */
    let raf = 0;
    let prev = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(50, now - prev);
      prev = now;

      /* 회전 갱신: 포커스 비행 > 관성 > 자동 회전 */
      const anim = focusAnimRef.current;
      if (anim) {
        const t = Math.min(1, (now - anim.start) / 900);
        rotRef.current.value = anim.from + (anim.to - anim.from) * easeInOut(t);
        if (t >= 1) focusAnimRef.current = null;
      } else if (!dragging) {
        if (Math.abs(rotRef.current.vel) > 0.0004) {
          rotRef.current.value += rotRef.current.vel;
          rotRef.current.vel *= 0.94;
        } else if (!reduce && !hoverRef.current) {
          rotRef.current.value += 0.00006 * dt;
        }
      }
      const rot = rotRef.current.value;

      const cx = W / 2;
      const cy = H * 0.5;
      const Rmax = Math.min(W * 0.43, 350);
      const RADII: Record<number, number> = { 1: Rmax * 0.52, 2: Rmax * 0.77, 3: Rmax };
      const usedRings = [...new Set(orbitsRef.current.map((o) => o.ring).filter((r) => r > 0))];

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      /* 원탁 바닥 — 궤도 타원 링 + 은은한 센터 글로우 */
      const tableGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Rmax * 1.1);
      tableGlow.addColorStop(0, "rgba(90,130,220,0.08)");
      tableGlow.addColorStop(0.7, "rgba(90,130,220,0.03)");
      tableGlow.addColorStop(1, "rgba(90,130,220,0)");
      ctx.fillStyle = tableGlow;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, TILT);
      ctx.beginPath();
      ctx.arc(0, 0, Rmax * 1.1, 0, Math.PI * 2);
      ctx.fill();
      for (const R of usedRings.map((r) => RADII[r])) {
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(127,183,255,0.09)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();

      /* 화면 좌표 계산 */
      const pos = new Map<string, OrbitNode>();
      for (const o of orbitsRef.current) {
        if (o.ring === 0) {
          o.sx = cx;
          o.sy = cy - 6;
          o.depth = 0.82;
        } else {
          const R = RADII[o.ring];
          const th = o.angle0 + rot * o.speed;
          o.sx = cx + Math.cos(th) * R;
          o.sy = cy + Math.sin(th) * R * TILT;
          o.depth = (Math.sin(th) + 1) / 2;
        }
        const scale = o.ring === 0 ? 1 : 0.64 + 0.52 * o.depth;
        o.alpha = o.ring === 0 ? 1 : 0.34 + 0.66 * o.depth;
        o.r = o.baseR * scale;
        pos.set(o.id, o);
      }

      const hl = hlRef.current;
      const litNode = (id: string) => hoverRef.current === id || (hl?.nodes.has(id) ?? false);
      const dimNode = (id: string) => (hl ? !hl.nodes.has(id) && hoverRef.current !== id : false);

      /* ── 엣지 (뒤→앞 노드보다 먼저) ── */
      for (const e of edges) {
        const s = pos.get(e.source);
        const t = pos.get(e.target);
        if (!s || !t) continue;
        const key = `${e.source}→${e.target}`;
        const litPair = hl?.pairs.has(key) ?? false;
        const factor = hl ? (litPair ? 1 : 0.1) : 1;
        const alpha =
          Math.min(s.alpha, t.alpha) * factor * (e.kind === "mention" ? 0.4 : 0.8);
        if (alpha < 0.02) continue;

        /* 시작·끝을 노드 가장자리로, 컨트롤 포인트는 중심 쪽으로 당겨 곡선 */
        const dx = t.sx - s.sx;
        const dy = t.sy - s.sy;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const x1 = s.sx + ux * (s.r + 2);
        const y1 = s.sy + uy * (s.r + 2);
        const x2 = t.sx - ux * (t.r + 7);
        const y2 = t.sy - uy * (t.r + 7);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const qx = mx + (cx - mx) * 0.22 - uy * 14;
        const qy = my + (cy - my) * 0.22 + ux * 14;

        const stroke = litPair
          ? COLOR.gold
          : e.kind === "directive"
            ? COLOR.directive
            : e.kind === "reply"
              ? COLOR.reply
              : COLOR.mention;
        const width =
          (e.kind === "directive" ? 1.6 + Math.min(2.4, e.count * 0.5) : e.kind === "reply" ? 1.2 : 0.8) *
          (0.7 + 0.5 * Math.min(s.depth, t.depth));

        ctx.globalAlpha = alpha;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = litPair ? width + 0.8 : width;
        ctx.setLineDash(e.kind === "mention" ? [4, 4] : []);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(qx, qy, x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        /* 화살촉 (곡선 끝 접선 방향) */
        const tx = x2 - qx;
        const ty = y2 - qy;
        const tl = Math.hypot(tx, ty) || 1;
        const ax = tx / tl;
        const ay = ty / tl;
        const as = 4.5 + width * 1.6;
        ctx.fillStyle = stroke;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - ax * as - ay * as * 0.55, y2 - ay * as + ax * as * 0.55);
        ctx.lineTo(x2 - ax * as + ay * as * 0.55, y2 - ay * as - ax * as * 0.55);
        ctx.closePath();
        ctx.fill();

        if (e.count > 2 && e.kind === "directive" && factor === 1) {
          ctx.font = "600 10px Pretendard, sans-serif";
          ctx.fillStyle = stroke;
          ctx.textAlign = "center";
          ctx.fillText(`×${e.count}`, qx, qy - 4);
        }

        /* 지시 엣지 위를 흐르는 파티클 */
        if (!reduce && e.kind === "directive" && factor === 1) {
          const nP = 1 + Math.min(2, e.count);
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          for (let i = 0; i < nP; i++) {
            const pt = ((now * 0.00012 + i / nP + (key.length % 7) * 0.13) % 1);
            const p = qPoint(pt, x1, y1, qx, qy, x2, y2);
            ctx.globalAlpha = alpha * 0.9;
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 5);
            g.addColorStop(0, litPair ? "rgba(255,230,150,0.95)" : "rgba(255,190,200,0.9)");
            g.addColorStop(1, "rgba(255,120,140,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      }

      /* ── 노드 (뒤 → 앞) ── */
      const ordered = [...orbitsRef.current].sort((a, b) => a.depth - b.depth);
      for (const o of ordered) {
        const lit = litNode(o.id);
        const dim = dimNode(o.id);
        const hover = hoverRef.current === o.id;
        const alpha = dim ? o.alpha * 0.16 : o.alpha;
        const r = o.r * (hover ? 1.16 : lit && hl ? 1.08 : 1);
        const ringColor = lit ? COLOR.gold : o.color;

        ctx.save();
        ctx.globalAlpha = alpha;
        /* 원경은 살짝 흐리게 — 피사계 심도 */
        if (o.depth < 0.32 && !dim) ctx.filter = `blur(${((0.32 - o.depth) * 5).toFixed(1)}px)`;

        /* 글로우 */
        if (!dim) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          const g = ctx.createRadialGradient(o.sx, o.sy, r * 0.4, o.sx, o.sy, r * 2.2);
          g.addColorStop(0, `${ringColor}3a`);
          g.addColorStop(1, `${ringColor}00`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(o.sx, o.sy, r * 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        /* 본체 — 사진 원형 크롭 또는 이니셜 디스크 (입체감용 그림자) */
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 5;
        const img = o.photo ? imagesRef.current.get(o.id) : undefined;
        if (img && img !== "failed") {
          ctx.beginPath();
          ctx.arc(o.sx, o.sy, r, 0, Math.PI * 2);
          ctx.fillStyle = "#1c1c1e";
          ctx.fill();
          ctx.shadowColor = "transparent";
          ctx.save();
          ctx.beginPath();
          ctx.arc(o.sx, o.sy, r - 1, 0, Math.PI * 2);
          ctx.clip();
          const sc = Math.max((r * 2) / img.width, (r * 2) / img.height);
          ctx.drawImage(
            img,
            o.sx - (img.width * sc) / 2,
            o.sy - (img.height * sc) / 2 - img.height * sc * 0.04,
            img.width * sc,
            img.height * sc
          );
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(o.sx, o.sy, r, 0, Math.PI * 2);
          ctx.fillStyle = "#232838";
          ctx.fill();
          ctx.shadowColor = "transparent";
          ctx.font = `600 ${Math.max(11, r * 0.85)}px Pretendard, sans-serif`;
          ctx.fillStyle = "#e8ecf6";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(o.name.slice(0, 1), o.sx, o.sy + 1);
          ctx.textBaseline = "alphabetic";
        }
        /* 컬러 링 */
        ctx.beginPath();
        ctx.arc(o.sx, o.sy, r, 0, Math.PI * 2);
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = lit ? 3 : 2.2;
        ctx.stroke();

        /* 포커스 펄스 */
        const pulse = pulseRef.current;
        if (pulse && pulse.id === o.id) {
          const pt = (now - pulse.start) / 1400;
          if (pt < 1) {
            ctx.globalAlpha = alpha * (1 - pt);
            ctx.beginPath();
            ctx.arc(o.sx, o.sy, r + 4 + pt * 26, 0, Math.PI * 2);
            ctx.strokeStyle = COLOR.gold;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.globalAlpha = alpha;
          } else {
            pulseRef.current = null;
          }
        }

        /* 라벨 */
        const fs = o.ring === 0 ? 14 : 10.5 + 3 * o.depth;
        ctx.font = `600 ${fs}px Pretendard, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = COLOR.ink;
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 1;
        ctx.fillText(o.name, o.sx, o.sy + r + fs + 4);
        if (hover || lit || o.ring === 0 || o.depth > 0.78) {
          ctx.font = `500 ${fs - 3.5}px Pretendard, sans-serif`;
          ctx.fillStyle = COLOR.mut;
          ctx.fillText(o.role, o.sx, o.sy + r + fs * 2 + 5);
        }
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, [edges, height]);

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      <canvas ref={canvasRef} className="block cursor-grab" aria-label="발언 네트워크 그래프" role="img" />
    </div>
  );
}
