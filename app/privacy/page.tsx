import type { Metadata } from "next";
import BackLink from "@/components/BackLink";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description:
    "열린국무회의(opencabinet.cc)의 개인정보처리방침 — 수집 항목, 쿠키·Google AdSense 광고, 제3자 서비스, 외부 링크, 문의처 안내.",
  alternates: { canonical: "/privacy" },
  openGraph: { title: "개인정보처리방침 — 열린국무회의", url: "/privacy" },
};

const UPDATED = "2026년 8월 12일";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel p-6 sm:p-7">
      <h2 className="text-[19px] font-semibold tracking-tight text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-body">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-5 py-10">
      <BackLink />
      <header>
        <p className="overline-label">Privacy Policy</p>
        <h1 className="h-judge mt-1">개인정보처리방침</h1>
        <p className="mt-2 text-[14px] text-mut">최종 개정일 · {UPDATED}</p>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-body">
          열린국무회의(이하 &ldquo;본 사이트&rdquo;, opencabinet.cc)는 공개된 국무회의·업무보고
          영상을 정리해 제공하는 비영리 성격의 아카이브입니다. 본 사이트는 이용자의 개인정보를
          직접 수집하지 않는 것을 원칙으로 하며, 아래와 같이 처리 방침을 안내합니다.
        </p>
      </header>

      <Section title="1. 수집하는 개인정보 항목">
        <p>
          본 사이트는 회원가입·로그인·문의 양식 등 개인정보를 입력받는 기능이 없으며, 이름·연락처·
          이메일 등 <strong className="text-ink">개인을 식별할 수 있는 정보를 직접 수집하지 않습니다.</strong>
        </p>
        <p>
          다만 웹사이트 운영 과정에서 방문 통계 집계를 위해 접속 IP·브라우저 종류·방문 일시·참조
          페이지 등 일반적인 접속 기록이 자동으로 생성·처리될 수 있습니다. 이 정보는 개인을
          특정하는 데 사용되지 않습니다.
        </p>
      </Section>

      <Section title="2. 쿠키 및 Google AdSense 광고">
        <p>
          본 사이트는 <strong className="text-ink">Google AdSense</strong>를 통해 광고를 게재합니다.
          Google을 포함한 제3자 광고 사업자는 쿠키(DoubleClick 쿠키 등)를 사용하여, 이용자가 본
          사이트나 다른 웹사이트를 방문한 기록을 바탕으로 광고를 게재할 수 있습니다.
        </p>
        <p>
          Google의 광고 쿠키 사용은 Google과 그 파트너가 이용자의 방문 정보를 기반으로 광고를
          제공할 수 있게 합니다. 이용자는{" "}
          <a
            href="https://www.google.com/settings/ads"
            target="_blank"
            rel="noreferrer"
            className="text-accent-400 hover:underline"
          >
            Google 광고 설정
          </a>
          에서 맞춤 광고를 해제할 수 있으며,{" "}
          <a
            href="https://www.aboutads.info/choices/"
            target="_blank"
            rel="noreferrer"
            className="text-accent-400 hover:underline"
          >
            www.aboutads.info
          </a>
          에서 제3자 사업자의 맞춤 광고 쿠키를 일괄 해제할 수 있습니다.
        </p>
        <p>
          이용자는 웹브라우저 설정을 통해 쿠키 저장을 거부하거나 삭제할 수 있습니다. 다만 쿠키를
          차단할 경우 광고가 이용자의 관심과 무관하게 표시될 수 있습니다.
        </p>
      </Section>

      <Section title="3. 제3자 서비스">
        <p>본 사이트는 다음의 외부 서비스를 이용하며, 각 서비스는 자체 개인정보처리방침을 따릅니다.</p>
        <ul className="ml-4 list-disc space-y-1.5 marker:text-faint">
          <li>
            <strong className="text-ink">Google AdSense</strong> — 광고 게재 (
            <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="text-accent-400 hover:underline">
              Google 개인정보처리방침
            </a>
            )
          </li>
          <li>
            <strong className="text-ink">YouTube</strong> — 회의 영상 임베드 재생. 영상 재생 시
            YouTube(Google)의 쿠키·정책이 적용됩니다.
          </li>
          <li>
            <strong className="text-ink">Cloudflare</strong> — 웹사이트 호스팅·배포 및 보안.
          </li>
        </ul>
      </Section>

      <Section title="4. 콘텐츠 및 데이터 출처">
        <p>
          본 사이트의 회의 영상은 <strong className="text-ink">KTV 국민방송</strong>이 공개한 자료를
          출처로 하며, 요약·분석은 영상 자막을 바탕으로 AI가 생성한 것으로 오류가 있을 수 있습니다.
          발언자 사진은 공공누리 제1유형(출처표시) 자료만 사용하고 각 사진에 출처를 표기합니다.
        </p>
        <p>본 사이트는 공공에 이미 공개된 정보를 재구성해 제공하며, 어떠한 비공개 정보도 다루지 않습니다.</p>
      </Section>

      <Section title="5. 외부 링크">
        <p>
          본 사이트는 YouTube, 정부 기관 등 외부 사이트로 연결되는 링크를 포함할 수 있습니다.
          외부 사이트의 개인정보 처리에 대해서는 본 사이트가 책임지지 않으며, 각 사이트의 방침을
          확인하시기 바랍니다.
        </p>
      </Section>

      <Section title="6. 아동의 개인정보">
        <p>
          본 사이트는 만 14세 미만 아동을 대상으로 하지 않으며, 아동의 개인정보를 고의로 수집하지
          않습니다.
        </p>
      </Section>

      <Section title="7. 방침의 변경">
        <p>
          본 개인정보처리방침은 법령·서비스 변경에 따라 개정될 수 있으며, 변경 시 본 페이지를 통해
          공지합니다. 상단의 &ldquo;최종 개정일&rdquo;로 최신 여부를 확인할 수 있습니다.
        </p>
      </Section>

      <Section title="8. 문의처">
        <p>
          개인정보 처리 및 본 사이트에 관한 문의는 운영 주체인 CDSA(한국데이터사이언티스트협회)로
          연락해 주시기 바랍니다.
        </p>
        <p>
          웹사이트:{" "}
          <a href="https://cdsa.kr" target="_blank" rel="noreferrer" className="text-accent-400 hover:underline">
            cdsa.kr
          </a>
        </p>
      </Section>
    </div>
  );
}
