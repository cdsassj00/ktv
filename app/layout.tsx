import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "열린국무회의 — KTV 국무회의·국민업무보고 아카이브",
    template: "%s | 열린국무회의",
  },
  description:
    "대통령 주재 공개 국무회의·국민업무보고 영상을 자동 수집·요약해 발언 스레드, 지시-이행 추적, AI·데이터 정책 발언을 한눈에 보여주는 아카이브",
};

const NAV = [
  { href: "/", label: "회의 목록" },
  { href: "/directives", label: "지시-이행" },
  { href: "/network", label: "발언 네트워크" },
  { href: "/ai-policy", label: "AI·데이터 정책" },
  { href: "/speakers", label: "발언자" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-950/90 text-white shadow-[0_8px_30px_-12px_rgb(8_18_38/0.6)] backdrop-blur-md">
          <div className="h-[3px] w-full bg-gradient-to-r from-accent-500 via-gold-500 to-navy-500" />
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3.5">
            <Link href="/" className="group flex shrink-0 items-baseline gap-2">
              <span className="text-xl font-black tracking-tight">
                열린<span className="text-accent-400">국무회의</span>
              </span>
              <span className="hidden text-[11px] font-medium tracking-[0.18em] text-navy-300 sm:inline">
                OPENCABINET
              </span>
            </Link>
            <nav className="scroll-thin flex gap-0.5 overflow-x-auto text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative whitespace-nowrap rounded-md px-3 py-1.5 font-semibold text-navy-100 transition hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
        <footer className="mt-20 border-t border-navy-100 bg-white/70 backdrop-blur">
          <div className="mx-auto max-w-6xl space-y-2 px-4 py-10 text-xs leading-relaxed text-slate-500">
            <p className="text-sm font-black tracking-tight text-navy-900">
              열린<span className="text-accent-500">국무회의</span>
            </p>
            <p>
              영상 출처:{" "}
              <a
                href="https://www.youtube.com/@KTV_korea"
                className="underline hover:text-navy-600"
                target="_blank"
                rel="noreferrer"
              >
                KTV 국민방송 유튜브 채널
              </a>
              . 요약은 영상 자막을 바탕으로 AI가 생성한 것으로, 오류가 있을 수 있습니다. 모든 요약
              항목의 타임스탬프로 원문 영상을 직접 확인하세요.
            </p>
            <p>발언자 사진은 공공누리 제1유형(출처표시) 자료만 사용하며, 각 사진에 출처를 표기합니다.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
