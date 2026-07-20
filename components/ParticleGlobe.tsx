"use client";

import { useEffect, useRef } from "react";

/**
 * 3D 파티클 글로브(particle globe) — 피보나치 구 분포 + 원근 투영.
 * 느린 자동 회전 + 페이지 스크롤이 회전각을 스크럽한다.
 * 의존성 0(canvas 2D), reduced-motion 시 정지 프레임 1회만 렌더.
 */
export default function ParticleGlobe({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const N = 620;
    // 피보나치 구
    const pts: { x: number; y: number; z: number }[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
    }

    let w = 0;
    let h = 0;
    const fit = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const rect = cv.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();

    let raf = 0;
    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * 0.34;
      const cx = w / 2;
      const cy = h / 2;
      const f = 3.2; // 원근
      const rot = t + scrollY * 0.0022; // 스크롤 스크럽
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      for (const p of pts) {
        const x = p.x * cos - p.z * sin;
        const z = p.x * sin + p.z * cos;
        const s = f / (f + z); // 스케일
        const px = cx + x * R * s;
        const py = cy + p.y * R * s * 0.96;
        const depth = (z + 1) / 2; // 0(앞)~1(뒤)
        const size = (1 - depth) * 2.2 + 0.5;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle =
          depth < 0.35
            ? `rgba(10,132,255,${0.9 - depth})`
            : `rgba(152,152,157,${0.55 - depth * 0.35})`;
        ctx.fill();
      }
    };

    if (REDUCE) {
      draw();
    } else {
      const loop = () => {
        t += 0.0016;
        draw();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    const onResize = () => {
      fit();
      if (REDUCE) draw();
    };
    addEventListener("resize", onResize, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
