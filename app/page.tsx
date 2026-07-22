import Link from "next/link";
import CountUp from "@/components/CountUp";
import DirectiveFlow from "@/components/DirectiveFlow";
import FloatingNav from "@/components/FloatingNav";
import ParallaxPhoto from "@/components/ParallaxPhoto";
import ParticleGlobe from "@/components/ParticleGlobe";
import Reveal from "@/components/Reveal";
import RotatingWord from "@/components/RotatingWord";
import ScrollProgress from "@/components/ScrollProgress";
import SearchExperience from "@/components/SearchExperience";
import SpeakerAvatar from "@/components/SpeakerAvatar";
import VisitBadge from "@/components/VisitBadge";
import { IconAlert } from "@/components/icons";
import {
  buildNetwork,
  getAllAiDataPolicy,
  getAllDirectives,
  getExchangeIndex,
  getMeetings,
  getSearchDocs,
  getSpeakers,
  UNKNOWN_SPEAKER,
} from "@/lib/data";
import { formatDate, formatTime, MEETING_TYPE_LABEL, youtubeUrlAt } from "@/lib/utils";

const SECTIONS = [
  { id: "hero", label: "홈" },
  { id: "search", label: "검색" },
  { id: "meetings", label: "회의" },
  { id: "quotes", label: "말말말" },
  { id: "directives", label: "지시-이행" },
  { id: "ai-policy", label: "AI·데이터" },
  { id: "speakers", label: "발언자" },
];

export default function HomePage() {
  const meetings = getMeetings();
  const speakers = getSpeakers();
  const latest = meetings[0];
  const hasSample = meetings.some((m) => m.sample);

  const directives = getAllDirectives();
  const reportedCount = directives.filter(({ directive }) => directive.status === "reported").length;
  const threadCount = meetings.reduce((n, m) => n + m.exchanges.length, 0);
  const aiItems = getAllAiDataPolicy();
  const network = buildNetwork();
  const searchDocs = getSearchDocs();
  const exchangeIndex = getExchangeIndex();

  /* 말말말 — 최신 회의의 대표 인용 5개 (remarks 우선, 스레드 인용으로 보충, 중복 제거) */
  const quotes = latest
    ? [
        ...latest.summary.remarks.map((r) => ({
          speakerId: r.speakerId, quote: r.quote, timestamp: r.timestamp, context: r.context ?? "",
        })),
        ...latest.exchanges.flatMap((ex) =>
          ex.turns
            .filter((t) => t.quote)
            .map((t) => ({ speakerId: t.speakerId, quote: t.quote!, timestamp: t.timestamp, context: ex.topic }))
        ),
      ]
        .filter((q, i, arr) => arr.findIndex((x) => x.quote === q.quote) === i)
        .slice(0, 5)
    : [];

  return (
    <>
      <ScrollProgress />
      <FloatingNav sections={SECTIONS} />

      {/* ══ 1. 히어로 — 3D 파티클 글로브 (스크롤 스크럽 회전) ══ */}
      <section id="hero" className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 text-center">
        {latest && (
          <ParallaxPhoto
            src={`https://i.ytimg.com/vi/${latest.videoId}/maxresdefault.jpg`}
            fallbackSrc={`https://i.ytimg.com/vi/${latest.videoId}/hqdefault.jpg`}
            maxOpacity={0.2}
            rate={0.1}
          />
        )}
        <ParticleGlobe className="absolute inset-0 size-full opacity-70" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#000_78%)]" />
        <div className="relative">
          <p className="text-[14px] font-semibold tracking-wide text-mut">KTV 공개 국무회의 아카이브</p>
          {latest && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#30d158]/30 bg-[#30d158]/10 px-3 py-1 text-[12.5px] font-semibold text-[#4cd964]">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#30d158] opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-[#30d158]" />
              </span>
              최신 반영 · {latest.title} ({latest.date})
            </p>
          )}
          <h1 className="mx-auto mt-4 max-w-4xl text-[44px] font-semibold leading-[1.06] tracking-[-0.03em] sm:text-[68px]">
            <span className="ln">
              <span>국무회의,</span>
            </span>
            <span className="ln">
              <span>대화로 읽다.</span>
            </span>
          </h1>
          <p className="on-dark-mut mx-auto mt-6 max-w-xl text-[17px] leading-relaxed sm:text-[19px]">
            발언을 대화 단위로 재구성하고,
            <br className="sm:hidden" /> 지시의 이행까지 추적합니다.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-5">
            <a href="#meetings" className="btn-pill">
              살펴보기
            </a>
            {latest && (
              <Link href={`/meetings/${latest.id}`} className="btn-link">
                최근 회의 바로가기 &rsaquo;
              </Link>
            )}
          </div>
          <VisitBadge className="mt-6" />
        </div>
        <a href="#meetings" className="scroll-cue absolute bottom-8" aria-label="아래로 스크롤">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-6 text-mut">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </a>
      </section>

      {/* ══ 2. 네트워크 검색 — 클릭 시 원탁 그래프 모달 ══ */}
      <section id="search" className="px-5 py-20">
        <div className="mx-auto max-w-4xl">
          {/* 페이지의 순수 블랙과 구분되는 네이비 글로우 패널 */}
          <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(165deg,#0b1830_0%,#070d1a_45%,#050508_100%)] px-6 py-14 text-center ring-1 ring-white/10 sm:px-12">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[560px] -translate-x-1/2 rounded-full bg-accent-500/15 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-28 -right-16 h-48 w-72 rounded-full bg-[#ffd257]/[0.07] blur-3xl"
            />
            <div className="relative">
              <Reveal>
                <p className="overline-label">Network Search</p>
                <h2 className="h-judge mt-1.5">
                  <RotatingWord words={["무엇이든", "지시도", "발언도", "안건도", "인물도"]} /> 검색해
                  보세요.
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-[16px] leading-relaxed text-mut">
                  {directives.length}건의 지시와 {threadCount}개 대화에서 키워드를 찾아, 누가
                  지시하고 누가 답했는지 원탁 네트워크로 보여드립니다.
                </p>
              </Reveal>
              <div className="mt-8">
                <SearchExperience
                  nodes={network.nodes}
                  edges={network.edges}
                  speakers={speakers}
                  searchDocs={searchDocs}
                  exchangeIndex={exchangeIndex}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ 3. 회의 — 스티키 스택 카드 ══ */}
      <section id="meetings" className="relative overflow-hidden px-5 py-24">
        {/* 회의장 전경(국기에 대한 경례 장면) — 유튜브 자동 프레임 캡처, 인물 클로즈업 회피 */}
        <ParallaxPhoto
          src="https://i.ytimg.com/vi/dZLnc3sgHMo/maxres1.jpg"
          fallbackSrc="https://i.ytimg.com/vi/dZLnc3sgHMo/hq1.jpg"
          maxOpacity={0.13}
        />
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="overline-label">회의 아카이브</p>
            <h2 className="h-judge mt-1.5">
              매주의 공개회의가
              <br />
              차곡차곡 쌓입니다.
            </h2>
            <div className="mt-4 flex gap-8 text-[16px] text-mut">
              <span>
                <strong className="text-[26px] font-semibold text-ink"><CountUp value={meetings.length} /></strong> 회의
              </span>
              <span>
                <strong className="text-[26px] font-semibold text-ink"><CountUp value={threadCount} /></strong> 스레드
              </span>
              <span>
                <strong className="text-[26px] font-semibold text-ink"><CountUp value={aiItems.length} /></strong> AI·데이터 발언
              </span>
            </div>
          </Reveal>

          {hasSample && (
            <div className="mt-8 flex items-start gap-2.5 rounded-2xl bg-[rgba(255,214,10,0.1)] px-5 py-3.5 text-[14.5px] text-[#ffd60a]/90">
              <IconAlert className="mt-0.5 size-4" />
              <p>
                아래 회의는 <strong>데모용 샘플 데이터</strong>입니다. 수집 파이프라인 실행 시 실제
                KTV 회의로 대체됩니다.
              </p>
            </div>
          )}

          {/* 스티키 스택 — 최신 4개만 (전량은 /meetings) */}
          <div className="mt-10 space-y-6">
            {meetings.slice(0, 4).map((m, i) => (
              <Link
                key={m.id}
                href={`/meetings/${m.id}`}
                className="panel group sticky block overflow-hidden p-7 shadow-lift transition hover:bg-tint sm:p-8"
                style={{ top: `${88 + i * 14}px` }}
              >
                <p className="text-[13.5px] font-medium text-mut">
                  {m.title} · {formatDate(m.date)}
                </p>
                <h3 className="mt-2.5 line-clamp-2 text-[21px] font-semibold leading-snug tracking-tight text-ink group-hover:text-accent-400">
                  {m.summary.remarks[0]?.quote ? (
                    <>
                      <span className="mr-1 text-accent-500/80">❝</span>
                      {m.summary.remarks[0].quote}
                      <span className="ml-1 text-accent-500/80">❞</span>
                    </>
                  ) : (
                    m.summary.oneLine
                  )}
                </h3>
                {m.summary.remarks[0]?.quote && (
                  <p className="mt-2 text-[14px] text-mut">
                    — {(speakers[m.summary.remarks[0].speakerId] ?? UNKNOWN_SPEAKER).name} · {m.summary.oneLine.slice(0, 60)}{m.summary.oneLine.length > 60 ? "…" : ""}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-[14px] font-medium text-mut">
                  <span>안건 {m.summary.agenda.length}</span>
                  <span className="text-tint2">·</span>
                  <span>스레드 {m.exchanges.length}</span>
                  <span className="text-tint2">·</span>
                  <span className={m.directives.length > 0 ? "text-[#ff6961]" : ""}>
                    지시 {m.directives.length}
                  </span>
                  {m.aiDataPolicy.length > 0 && (
                    <span className="chip ml-auto bg-[rgba(10,132,255,0.16)] text-[#64b5ff]">
                      AI·데이터 {m.aiDataPolicy.length}건
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/meetings" className="btn-pill">
              전체 {meetings.length}개 회의 보기
            </Link>
          </div>
        </div>
      </section>

      {/* ══ 4. 말말말 — 이번 회의 대표 인용 피드 ══ */}
      {latest && quotes.length > 0 && (
        <section id="quotes" className="border-t border-hair/40 px-5 py-24">
          <div className="mx-auto max-w-2xl">
            <Reveal>
              <p className="overline-label">이번 회의 말말말</p>
              <h2 className="h-judge mt-1.5">
                발언 그대로,
                <br />
                핵심만 남깁니다.
              </h2>
              <p className="mt-3 text-[16px] leading-relaxed text-mut">
                {formatDate(latest.date)}에 열린 {latest.title}의 대표 발언입니다. 타임스탬프를
                누르면 원문 영상의 해당 시점으로 이동합니다.
              </p>
            </Reveal>
            <Reveal stagger className="mt-10 space-y-4">
              {quotes.map((q, i) => {
                const sp = speakers[q.speakerId] ?? UNKNOWN_SPEAKER;
                return (
                  <figure key={i} className="panel p-6 sm:p-7">
                    <span aria-hidden className="block text-[34px] leading-none text-accent-500/70">❝</span>
                    <blockquote className="mt-2 text-[18px] font-medium leading-relaxed text-ink sm:text-[19px]">
                      {q.quote}
                    </blockquote>
                    <figcaption className="mt-4 flex flex-wrap items-center gap-2.5">
                      <SpeakerAvatar speaker={sp} size="sm" />
                      <span className="text-[14.5px] font-semibold text-ink">{sp.name}</span>
                      <span className="text-[13px] text-mut">{sp.role}</span>
                      {q.context && (
                        <span className="rounded-full bg-tint2 px-2 py-0.5 text-[12px] text-mut">
                          {q.context}
                        </span>
                      )}
                      {latest.videoId ? (
                        <a
                          href={youtubeUrlAt(latest.videoId, q.timestamp)}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-auto font-mono text-[12.5px] text-accent-400 hover:underline"
                        >
                          ▶ {formatTime(q.timestamp)}
                        </a>
                      ) : (
                        <span className="ml-auto font-mono text-[12.5px] text-faint">
                          ▶ {formatTime(q.timestamp)}
                        </span>
                      )}
                    </figcaption>
                  </figure>
                );
              })}
            </Reveal>
            <div className="mt-8 text-center">
              <Link href={`/meetings/${latest.id}`} className="btn-link">
                이 회의 전체 스레드·요약 보기 &rsaquo;
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ══ 5. 지시-이행 — 셀프 드로잉 라인 ══ */}
      <section id="directives" className="relative overflow-hidden border-t border-hair/40 px-5 py-24">
        {/* 원탁 발언 장면 — 회의장 배경 (유튜브 자동 프레임 캡처) */}
        <ParallaxPhoto
          src="https://i.ytimg.com/vi/dZLnc3sgHMo/maxres3.jpg"
          fallbackSrc="https://i.ytimg.com/vi/dZLnc3sgHMo/hq3.jpg"
          maxOpacity={0.1}
          rate={0.12}
        />
        <div className="mx-auto mb-12 max-w-2xl">
          <Reveal>
            <p className="overline-label">지시-이행 트래커</p>
            <h2 className="h-judge mt-1.5">
              지시는 사라지지 않고
              <br />
              다음 회의로 이어집니다.
            </h2>
            <p className="mt-3 text-[16px] leading-relaxed text-mut">
              {directives.length}건의 지시를 추적 중이며, 그중 {reportedCount}건의 후속 보고가
              연결됐습니다. 자동 연결은 &ldquo;추정&rdquo;으로 표시됩니다.
            </p>
          </Reveal>
        </div>
        <DirectiveFlow
          items={directives.filter(({ directive }) => directive.status === "reported").slice(0, 5)}
          speakers={speakers}
          meetingIndex={Object.fromEntries(meetings.map((m) => [m.id, { title: m.title, date: m.date }]))}
        />
        <div className="mt-10 text-center">
          <Link href="/directives" className="btn-link">
            전체 지시 이력 보기 &rsaquo;
          </Link>
        </div>
      </section>

      {/* ══ 6. AI·데이터 정책 ══ */}
      <section id="ai-policy" className="border-t border-hair/40 px-5 py-24">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="overline-label">AI·데이터 정책</p>
            <h2 className="h-judge mt-1.5">
              AI·데이터 발언만
              <br />
              골라서 봅니다.
            </h2>
          </Reveal>
          <Reveal stagger className="mt-8 space-y-3">
            {aiItems.slice(0, 4).map(({ meeting, item }, i) => {
              const sp = speakers[item.speakerId] ?? UNKNOWN_SPEAKER;
              return (
                <details key={i} open={i === 0} className="panel group/ai p-5">
                  <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                    <SpeakerAvatar speaker={sp} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="text-[15px] font-semibold text-ink">{sp.name}</span>
                      <span className="ml-2 text-[13px] text-mut">{item.topic}</span>
                    </span>
                    {meeting.videoId ? (
                      <a
                        href={youtubeUrlAt(meeting.videoId, item.timestamp)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[12px] text-accent-400 hover:underline"
                      >
                        {formatTime(item.timestamp)}
                      </a>
                    ) : (
                      <span className="font-mono text-[12px] text-faint">
                        {formatTime(item.timestamp)}
                      </span>
                    )}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="size-4 shrink-0 text-mut transition-transform group-open/ai:rotate-180"
                      aria-hidden
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </summary>
                  <div className="mt-2.5 pl-[52px]">
                    <p className="text-[15px] leading-relaxed text-body">{item.summary}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {item.tags.map((t) => (
                        <span key={t} className="rounded-full bg-tint2 px-2 py-0.5 text-[12px] text-mut">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                </details>
              );
            })}
          </Reveal>
          <div className="mt-8 text-center">
            <Link href="/ai-policy" className="btn-link">
              태그 필터·추이 차트 포함 전체 보기 &rsaquo;
            </Link>
          </div>
        </div>
      </section>

      {/* ══ 7. 발언자 ══ */}
      <section id="speakers" className="border-t border-hair/40 px-5 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <p className="overline-label">발언자</p>
            <h2 className="h-judge mt-1.5">발언자 {Object.keys(speakers).length}인</h2>
          </Reveal>
          <Reveal stagger className="mt-10 flex flex-wrap items-start justify-center gap-x-6 gap-y-7">
            {Object.entries(speakers).map(([id, sp]) => (
              <Link key={id} href={`/speakers/${id}`} className="group flex w-[96px] flex-col items-center gap-1.5">
                <SpeakerAvatar speaker={sp} size="lg" />
                <span className="text-[13px] font-medium leading-tight text-body group-hover:text-ink">
                  {sp.name}
                </span>
                {sp.name !== sp.role && (
                  <span className="line-clamp-2 text-center text-[11px] leading-snug text-faint">
                    {sp.role}
                  </span>
                )}
              </Link>
            ))}
          </Reveal>
          <p className="mt-10 text-[13px] leading-relaxed text-faint">
            요약은 KTV 영상 자막 기반 AI 생성물이며 오류가 있을 수 있습니다. 모든 항목의
            타임스탬프로 원문 영상을 직접 확인하세요.
          </p>
        </div>
      </section>
    </>
  );
}
