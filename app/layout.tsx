import type { Metadata } from "next";
import Link from "next/link";
import CreditBadge from "@/components/CreditBadge";
import VisitBadge from "@/components/VisitBadge";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://opencabinet.pages.dev"),
  title: {
    default: "열린국무회의 — KTV 국무회의·국민업무보고 아카이브",
    template: "%s | 열린국무회의",
  },
  description:
    "대통령 주재 공개 국무회의·국민업무보고 영상을 자동 수집·요약해 발언 스레드, 지시-이행 추적, AI·데이터 정책 발언을 한눈에 보여주는 아카이브",
  keywords: [
    "국무회의",
    "국민업무보고",
    "이재명 대통령",
    "국무회의 요약",
    "지시 이행",
    "AI 정책",
    "데이터 정책",
    "KTV",
    "정부 정책",
    "국무회의 발언",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "열린국무회의 — 국무회의, 대화로 읽다",
    description:
      "공개 국무회의 발언을 대화 단위로 재구성하고, 지시의 이행까지 추적하는 아카이브",
    url: "/",
    siteName: "열린국무회의",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "열린국무회의 — 국무회의, 대화로 읽다" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.png"],
  },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "열린국무회의",
              alternateName: "OpenCabinet",
              url: "https://opencabinet.pages.dev",
              description:
                "대통령 주재 공개 국무회의·국민업무보고 영상을 AI로 요약해 발언 스레드·지시 이행·AI 데이터 정책을 보여주는 아카이브",
              inLanguage: "ko",
              publisher: {
                "@type": "Organization",
                name: "CDSA 한국데이터사이언티스트협회",
                url: "https://cdsa.kr",
              },
              potentialAction: {
                "@type": "SearchAction",
                target: "https://opencabinet.pages.dev/network?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </head>
      <body>
        {/* CDSA 골드 배너 — 스크롤에도 항상 상단 고정, 황금빛 반사 스윕 */}
        <a
          href="https://cdsa.kr"
          target="_blank"
          rel="noreferrer"
          className="gold-banner fixed inset-x-0 top-0 z-50 flex h-9 items-center justify-center gap-2 overflow-hidden px-4"
        >
          <span className="gold-shine" aria-hidden />
          <span className="relative rounded-full bg-black/25 px-1.5 py-px text-[10px] font-bold tracking-wide text-[#fff7dc]">
            AD
          </span>
          <span className="relative truncate text-[12.5px] font-semibold tracking-tight text-[#241a02] sm:text-[13.5px]">
            강사가 부족하다고 아무 강사나 뽑고 계십니까? — AX 전환·AI 교육은{" "}
            <span className="underline underline-offset-2">CDSA와 함께</span>
          </span>
        </a>

        {/* 프로스티드 내비 — 브랜드 + 섹션 링크 */}
        <header className="fixed inset-x-0 top-9 z-40 bg-black/60 backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto flex h-12 max-w-6xl items-center gap-6 px-5">
            <Link href="/" className="shrink-0 text-[16px] font-semibold tracking-tight text-ink">
              열린국무회의
            </Link>
            <nav className="scroll-thin flex flex-1 gap-0.5 overflow-x-auto">
              {[
                { href: "/meetings", label: "회의" },
                { href: "/directives", label: "지시-이행" },
                { href: "/network", label: "네트워크" },
                { href: "/ai-policy", label: "AI·데이터" },
                { href: "/speakers", label: "발언자" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap rounded-full px-3 py-1 text-[13px] text-mut transition hover:bg-white/10 hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <a
              href="https://www.youtube.com/@KTV_korea"
              target="_blank"
              rel="noreferrer"
              className="hidden shrink-0 text-[13px] text-mut transition hover:text-ink sm:block"
            >
              KTV 원본 ↗
            </a>
          </div>
        </header>

        <main className="min-h-screen pt-[84px]">{children}</main>

        <footer className="border-t border-hair/40 bg-black">
          <div className="mx-auto max-w-6xl space-y-2 px-5 py-10 text-[13px] leading-relaxed text-faint">
            <p className="text-[15px] font-semibold tracking-tight text-mut">열린국무회의</p>
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
            <p>
              Made by{" "}
              <a href="https://cdsa.kr" target="_blank" rel="noreferrer" className="font-semibold text-[#ffd257]/80 hover:text-[#ffd257]">
                CDSA
              </a>{" "}
              (한국데이터사이언티스트협회) · ⓒ 2026 CDSA. All rights reserved.
            </p>
            <VisitBadge className="pt-2" />
          </div>
        </footer>

        <CreditBadge />
      </body>
    </html>
  );
}
