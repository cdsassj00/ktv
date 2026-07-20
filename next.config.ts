import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages 정적 배포용 — 전 페이지 SSG이므로 export 모드 사용
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
