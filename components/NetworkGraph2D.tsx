"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { NetworkEdge, NetworkNode, SpeakerMap } from "@/lib/types";
import { UNKNOWN_SPEAKER } from "@/lib/client-data";
import SpeakerAvatar from "./SpeakerAvatar";

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

const ZOOM_MIN = 0.55;
const ZOOM_MAX = 2.6;

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
 * 대통령을 중앙에, 발언자들을 최대 3겹의 타원 궤도에 배치한다.
 * 앞쪽 노드는 크고 선명, 뒤쪽은 작고 흐리게(원근) + 링별 회전 시차.
 *
 * 조작: 가로 드래그 = 회전, 세로 드래그 = 기울기(틸트), 휠·핀치 = 확대/축소(커서 기준),
 * 노드 클릭 = 그 사람의 관계만 밝히기(+정보 카드), 빈 곳 클릭 = 해제.
 * 검색 하이라이트는 골드 점등, 결과 클릭 시 해당 노드가 정면으로 회전.
 */
export default function NetworkGraph2D({
  nodes,
  edges,
  speakers,
  highlight,
  focusNode,
  onSelect,
  height = 560,
}: {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  speakers: SpeakerMap;
  highlight?: GraphHighlight | null;
  focusNode?: string | null;
  /** 노드 선택/해제 시 부모에 통지 — 아래 발언 목록 연동용 */
  onSelect?: (speakerId: string | null) => void;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbitsRef = useRef<OrbitNode[]>([]);
  const imagesRef = useRef<Map<string, HTMLImageElement | "failed">>(new Map());
  const hlRef = useRef<{ nodes: Set<string>; pairs: Set<string> } | null>(null);
  const hoverRef = useRef<string | null>(null);
  const rotRef = useRef({ value: 0, vel: 0 });
  const viewRef = useRef({ zoom: 1, panX: 0, panY: 0, tilt: 0.4 });
  const selRef = useRef<string | null>(null);
  const focusAnimRef = useRef<{ from: number; to: number; start: number } | null>(null);
  const pulseRef = useRef<{ id: string; start: number } | null>(null);
  const zoomApiRef = useRef<{ by: (f: number) => void; reset: () => void }>({
    by: () => {},
    reset: () => {},
  });
  const [selected, setSelected] = useState<string | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  /* 노드 → 궤도 배치 (대통령 중앙, 발언량 순 3겹 링) */
  useEffect(() => {
    const centerId = nodes.some((n) => n.speakerId === "president")
      ? "president"
      : [...nodes].sort((a, b) => b.turnCount - a.turnCount)[0]?.speakerId;
    const rest = [...nodes]
      .filter((n) => n.speakerId !== centerId)
      .sort((a, b) => b.turnCount - a.turnCount);
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

  /* 검색 하이라이트가 들어오면 노드 선택은 해제 (검색이 우선) */
  useEffect(() => {
    hlRef.current = highlight
      ? { nodes: new Set(highlight.nodes), pairs: new Set(highlight.pairs) }
      : null;
    if (highlight && selRef.current) {
      selRef.current = null;
      setSelected(null);
      onSelect?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const coarse = matchMedia("(pointer: coarse)").matches; // 터치 기기: 탭 판정 반경 확대
    let W = 0;
    let H = height;
    let dpr = 1;
    let defaultTilt = 0.4;

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = wrap.clientWidth;
      H = W < 520 ? Math.min(height, 470) : height;
      wrap.style.height = `${H}px`;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      /* 좁은 화면은 궤도가 작아 겹침 — 기본 기울기를 세워 세로 공간 활용 */
      defaultTilt = W < 520 ? 0.58 : 0.4;
    };
    resize();
    viewRef.current.tilt = defaultTilt;
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    /* 인접 노드 맵 (선택 시 관계 하이라이트용) */
    const neighbors = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!neighbors.has(e.source)) neighbors.set(e.source, new Set());
      if (!neighbors.has(e.target)) neighbors.set(e.target, new Set());
      neighbors.get(e.source)!.add(e.target);
      neighbors.get(e.target)!.add(e.source);
    }

    /* ── 뷰 조작: 회전·틸트 드래그 + 휠/핀치 줌 ── */
    const pointers = new Map<number, { x: number; y: number }>();
    let moved = 0;
    let pinchDist = 0;

    const zoomAt = (mx: number, my: number, factor: number) => {
      const v = viewRef.current;
      const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.zoom * factor));
      const cx = W / 2;
      const cy = H * 0.5;
      /* 커서 아래 지점이 그대로 있도록 팬 보정 */
      v.panX = mx - cx - ((mx - cx - v.panX) / v.zoom) * nz;
      v.panY = my - cy - ((my - cy - v.panY) / v.zoom) * nz;
      v.zoom = nz;
    };
    zoomApiRef.current = {
      by: (f: number) => zoomAt(W / 2, H * 0.5, f),
      reset: () => {
        viewRef.current = { zoom: 1, panX: 0, panY: 0, tilt: defaultTilt };
        rotRef.current.vel = 0;
      },
    };

    const pick = (mx: number, my: number): OrbitNode | null => {
      const slack = coarse ? 14 : 6;
      let best: OrbitNode | null = null;
      for (const o of orbitsRef.current) {
        if (Math.hypot(mx - o.sx, my - o.sy) <= o.r + slack) {
          if (!best || o.depth > best.depth) best = o;
        }
      }
      return best;
    };

    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) moved = 0;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
      focusAnimRef.current = null;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const prev = pointers.get(e.pointerId);
      if (prev) {
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
          /* 핀치 줌 */
          const [a, b] = [...pointers.values()];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinchDist > 0) {
            const mid = { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top };
            zoomAt(mid.x, mid.y, dist / pinchDist);
          }
          pinchDist = dist;
          moved += 10;
        } else {
          const dx = e.clientX - prev.x;
          const dy = e.clientY - prev.y;
          moved += Math.abs(dx) + Math.abs(dy);
          /* 가로 = 궤도 회전. 세로 기울기는 마우스 전용 —
             터치의 세로 스와이프는 touch-action: pan-y로 페이지 스크롤에 양보 */
          rotRef.current.value += dx * 0.006;
          rotRef.current.vel = dx * 0.006;
          if (e.pointerType === "mouse") {
            const v = viewRef.current;
            v.tilt = Math.min(0.75, Math.max(0.18, v.tilt + dy * 0.0022));
          }
        }
      } else {
        const hit = pick(e.clientX - rect.left, e.clientY - rect.top);
        hoverRef.current = hit?.id ?? null;
        canvas.style.cursor = hit ? "pointer" : "grab";
      }
    };
    const onUp = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const wasClick = pointers.size === 1 && moved < 6;
      pointers.delete(e.pointerId);
      pinchDist = 0;
      if (!wasClick) return;
      const hit = pick(e.clientX - rect.left, e.clientY - rect.top);
      /* 클릭 = 관계 하이라이트 선택/해제 (프로필 이동은 정보 카드에서) */
      const next = hit && hit.id !== selRef.current ? hit.id : null;
      selRef.current = next;
      setSelected(next);
      onSelectRef.current?.(next);
      if (next) pulseRef.current = { id: next, start: performance.now() };
    };
    /* 브라우저가 스크롤을 가져가면(pointercancel) 클릭으로 처리하지 않는다 */
    const onCancel = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      pinchDist = 0;
    };
    const onLeave = () => {
      hoverRef.current = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0012));
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    /* ── 렌더 루프 ── */
    let raf = 0;
    let prev = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(50, now - prev);
      prev = now;

      const dragging = pointers.size > 0;
      const anim = focusAnimRef.current;
      if (anim) {
        const t = Math.min(1, (now - anim.start) / 900);
        rotRef.current.value = anim.from + (anim.to - anim.from) * easeInOut(t);
        if (t >= 1) focusAnimRef.current = null;
      } else if (!dragging) {
        if (Math.abs(rotRef.current.vel) > 0.0004) {
          rotRef.current.value += rotRef.current.vel;
          rotRef.current.vel *= 0.94;
        } else if (!reduce && !hoverRef.current && !selRef.current) {
          rotRef.current.value += 0.00006 * dt;
        }
      }
      const rot = rotRef.current.value;
      const { zoom, panX, panY, tilt } = viewRef.current;

      const cx = W / 2 + panX;
      const cy = H * 0.5 + panY;
      const compact = W < 520; // 모바일: 노드·라벨 축소 + 뒷줄 라벨 생략
      const sizeK = Math.min(1, Math.max(0.55, W / 760));
      const Rmax = Math.min(W * (compact ? 0.47 : 0.43), 350) * zoom;
      const RADII: Record<number, number> = { 1: Rmax * 0.52, 2: Rmax * 0.77, 3: Rmax };
      const usedRings = [...new Set(orbitsRef.current.map((o) => o.ring).filter((r) => r > 0))];
      const nodeScale = zoom ** 0.85 * sizeK;
      const lblScale = Math.min(1.45, 0.78 + 0.32 * zoom) * (compact ? 0.9 : 1);

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
      ctx.scale(1, tilt);
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
          o.sy = cy - 6 * zoom;
          o.depth = 0.82;
        } else {
          const R = RADII[o.ring];
          const th = o.angle0 + rot * o.speed;
          o.sx = cx + Math.cos(th) * R;
          o.sy = cy + Math.sin(th) * R * tilt;
          o.depth = (Math.sin(th) + 1) / 2;
        }
        const scale = o.ring === 0 ? 1 : 0.64 + 0.52 * o.depth;
        o.alpha = o.ring === 0 ? 1 : 0.34 + 0.66 * o.depth;
        o.r = o.baseR * scale * nodeScale;
        pos.set(o.id, o);
      }

      const hl = hlRef.current;
      const sel = selRef.current;
      const selNeighbors = sel ? neighbors.get(sel) : undefined;
      /* 우선순위: 노드 클릭 선택(가장 최근 행동) > 검색 하이라이트 */
      const litNode = (id: string) => {
        if (hoverRef.current === id) return true;
        if (sel) return id === sel || (selNeighbors?.has(id) ?? false);
        if (hl) return hl.nodes.has(id);
        return false;
      };
      const dimNode = (id: string) => {
        if (hoverRef.current === id) return false;
        if (sel) return !(id === sel || (selNeighbors?.has(id) ?? false));
        if (hl) return !hl.nodes.has(id);
        return false;
      };

      /* ── 엣지 (노드보다 먼저) ── */
      for (const e of edges) {
        const s = pos.get(e.source);
        const t = pos.get(e.target);
        if (!s || !t) continue;
        const key = `${e.source}→${e.target}`;
        const touchesSel = sel !== null && (e.source === sel || e.target === sel);
        const litPair = sel ? touchesSel : hl ? hl.pairs.has(key) : false;
        const factor = sel || hl ? (litPair ? 1 : 0.08) : 1;
        const alpha =
          Math.min(s.alpha, t.alpha) * factor * (e.kind === "mention" ? 0.4 : 0.8);
        if (alpha < 0.02) continue;

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

        /* 선택 관계는 종류 색 유지(골드는 검색 전용), 검색 매칭은 골드 */
        const kindColor =
          e.kind === "directive" ? COLOR.directive : e.kind === "reply" ? COLOR.reply : COLOR.mention;
        const stroke = !sel && hl && litPair ? COLOR.gold : kindColor;
        const width =
          (e.kind === "directive" ? 1.6 + Math.min(2.4, e.count * 0.5) : e.kind === "reply" ? 1.2 : 0.8) *
          (0.7 + 0.5 * Math.min(s.depth, t.depth)) *
          zoom ** 0.7;

        ctx.globalAlpha = alpha;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = litPair ? width + 0.8 : width;
        ctx.setLineDash(e.kind === "mention" ? [4, 4] : []);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(qx, qy, x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        /* 화살촉 */
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

        /* 반복 지시 배수 — 관계가 밝혀졌거나 크게 반복될 때만 */
        if (e.kind === "directive" && e.count > 1 && (litPair || e.count > 2) && factor === 1) {
          ctx.font = `600 ${10 * lblScale}px Pretendard, sans-serif`;
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
            const pr = 5 * zoom ** 0.7;
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pr);
            g.addColorStop(0, !sel && hl && litPair ? "rgba(255,230,150,0.95)" : "rgba(255,190,200,0.9)");
            g.addColorStop(1, "rgba(255,120,140,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
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
        const isSel = sel === o.id;
        const alpha = dim ? o.alpha * 0.16 : o.alpha;
        const r = o.r * (hover ? 1.16 : isSel ? 1.12 : lit && hl ? 1.08 : 1);
        const ringColor = isSel || (!sel && hl && lit) ? COLOR.gold : o.color;

        ctx.save();
        ctx.globalAlpha = alpha;
        if (o.depth < 0.32 && !dim && zoom < 1.4) ctx.filter = `blur(${((0.32 - o.depth) * 5).toFixed(1)}px)`;

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

        /* 본체 — 사진 원형 크롭 또는 이니셜 디스크 */
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
        ctx.lineWidth = lit || isSel ? 3 : 2.2;
        ctx.stroke();

        /* 포커스·선택 펄스 */
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

        /* 라벨 — 모바일은 뒷줄 이름 생략(겹침 방지), 직책은 강조 시에만 */
        const showName = !compact || o.ring === 0 || o.depth > 0.62 || lit || hover || isSel;
        const showRole =
          hover || isSel || o.ring === 0 || (!compact && (lit || o.depth > 0.78));
        if (showName) {
          const fs = (o.ring === 0 ? 14 : 10.5 + 3 * o.depth) * lblScale;
          ctx.font = `600 ${fs}px Pretendard, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillStyle = COLOR.ink;
          ctx.shadowColor = "rgba(0,0,0,0.8)";
          ctx.shadowBlur = 4;
          ctx.shadowOffsetY = 1;
          ctx.fillText(o.name, o.sx, o.sy + r + fs + 4);
          if (showRole) {
            ctx.font = `500 ${fs - 3.5}px Pretendard, sans-serif`;
            ctx.fillStyle = COLOR.mut;
            ctx.fillText(o.role, o.sx, o.sy + r + fs * 2 + 5);
          }
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
      canvas.removeEventListener("pointercancel", onCancel);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [edges, height]);

  const selSpeaker = selected ? (speakers[selected] ?? UNKNOWN_SPEAKER) : null;
  const selDegree = selected
    ? edges.filter((e) => e.source === selected || e.target === selected).length
    : 0;

  return (
    <div ref={wrapRef} className="relative w-full select-none" style={{ height }}>
      <canvas
        ref={canvasRef}
        className="block cursor-grab"
        style={{ touchAction: "pan-y" }} /* 세로 스와이프는 페이지 스크롤로 양보 */
        aria-label="발언 네트워크 그래프"
        role="img"
      />

      {/* 선택된 발언자 정보 카드 — 관계도 위에 떠 있음 */}
      {selected && selSpeaker && (
        <div className="absolute left-3 top-3 flex max-w-[260px] items-center gap-3 rounded-2xl bg-black/70 p-3.5 shadow-lift backdrop-blur-md">
          <SpeakerAvatar speaker={selSpeaker} size="md" />
          <div className="min-w-0">
            <p className="truncate text-[14.5px] font-semibold text-ink">{selSpeaker.name}</p>
            <p className="truncate text-[12.5px] text-mut">{selSpeaker.role}</p>
            <p className="mt-0.5 text-[12px] text-faint">연결 {selDegree}건 표시 중</p>
            <Link
              href={`/speakers/${selected}`}
              className="mt-1 inline-block text-[12.5px] font-medium text-accent-400 hover:underline"
            >
              프로필·발언 이력 보기 &rsaquo;
            </Link>
          </div>
          <button
            type="button"
            aria-label="선택 해제"
            onClick={() => {
              selRef.current = null;
              setSelected(null);
              onSelect?.(null);
            }}
            className="ml-1 self-start rounded-full bg-white/10 p-1 text-mut hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* 줌 컨트롤 */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        {(
          [
            ["확대", "+", () => zoomApiRef.current.by(1.3)],
            ["축소", "−", () => zoomApiRef.current.by(1 / 1.3)],
            ["보기 초기화", "⟲", () => zoomApiRef.current.reset()],
          ] as const
        ).map(([label, glyph, fn]) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            onClick={fn}
            className="flex size-9 items-center justify-center rounded-full bg-white/10 text-[16px] font-semibold text-ink backdrop-blur-md transition hover:bg-white/20"
          >
            {glyph}
          </button>
        ))}
      </div>
    </div>
  );
}
