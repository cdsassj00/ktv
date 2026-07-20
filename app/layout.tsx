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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="preload"
          as="style"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        {/* 최소화된 프로스티드 내비 — 브랜드 + 홈 링크만 */}
        <header className="fixed inset-x-0 top-0 z-40 bg-black/60 backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-5">
            <Link href="/" className="text-[15px] font-semibold tracking-tight text-ink">
              열린국무회의
            </Link>
            <a
              href="https://www.youtube.com/@KTV_korea"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-mut transition hover:text-ink"
            >
              KTV 원본 채널 ↗
            </a>
          </div>
        </header>

        <main className="min-h-screen pt-12">{children}</main>

        <footer className="border-t border-hair/40 bg-black">
          <div className="mx-auto max-w-6xl space-y-2 px-5 py-10 text-xs leading-relaxed text-faint">
            <p className="text-sm font-semibold tracking-tight text-mut">열린국무회의</p>
            <p>
              영상 출처:{" "}
              <a
                href="https://www.youtube.com/@KTV_korea"
                className="text-mut hover:text-ink"
                target="_blank"
                rel="noreferrer"
              >
                KTV 국민방송 유튜브 채널
              </a>
              . 요약은 영상 자막을 바탕으로 AI가 생성한 것으로, 오류가 있을 수 있습니다.
            </p>
            <p>발언자 사진은 공공누리 제1유형(출처표시) 자료만 사용하며, 각 사진에 출처를 표기합니다.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
