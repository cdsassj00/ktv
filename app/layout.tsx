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
        {/* 프로스티드 다크 내비 (apple.com 스타일) */}
        <header className="sticky top-0 z-40 bg-[rgba(22,22,23,0.8)] text-white backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto flex h-12 max-w-5xl items-center gap-8 px-5">
            <Link href="/" className="shrink-0 text-[15px] font-semibold tracking-tight">
              열린국무회의
            </Link>
            <nav className="scroll-thin ml-auto flex gap-1 overflow-x-auto">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-link whitespace-nowrap px-3 py-1 text-xs font-normal text-[rgba(245,245,247,0.8)] hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="min-h-[60vh]">{children}</main>

        <footer className="mt-20 bg-tint2/60">
          <div className="mx-auto max-w-5xl space-y-2 px-5 py-9 text-xs leading-relaxed text-mut">
            <p className="text-sm font-semibold tracking-tight text-ink">열린국무회의</p>
            <p>
              영상 출처:{" "}
              <a
                href="https://www.youtube.com/@KTV_korea"
                className="text-navy-500 hover:underline"
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
