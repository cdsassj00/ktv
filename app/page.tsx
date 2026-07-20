import Link from "next/link";
import MeetingCard from "@/components/MeetingCard";
import CountUp from "@/components/CountUp";
import Reveal from "@/components/Reveal";
import { IconAlert } from "@/components/icons";
import { getAllAiDataPolicy, getAllDirectives, getMeetings } from "@/lib/data";
import { formatDate, formatTime, MEETING_TYPE_LABEL } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "cabinet", label: "국무회의" },
  { key: "briefing", label: "국민업무보고" },
] as const;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type = "all" } = await searchParams;
  const all = getMeetings();
  const meetings = type === "all" ? all : all.filter((m) => m.type === type);
  const latest = all[0];
  const hasSample = all.some((m) => m.sample);

  const directives = getAllDirectives();
  const reportedCount = directives.filter(({ directive }) => directive.status === "reported").length;
  const threadCount = all.reduce((n, m) => n + m.exchanges.length, 0);
  const aiCount = getAllAiDataPolicy().length;

  return (
    <>
      {/* ── 풀블리드 블랙 히어로 ── */}
      <section className="bg-navy-950 px-5 pb-16 pt-20 text-center text-white sm:pb-20 sm:pt-24">
        <p className="text-[13px] font-semibold text-[rgba(245,245,247,0.6)]">
          KTV 공개 국무회의 아카이브
        </p>
        <h1 className="mx-auto mt-3 max-w-3xl text-[42px] font-semibold leading-[1.08] tracking-[-0.025em] sm:text-[60px]">
          <span className="ln">
            <span>국무회의, 대화로 읽다.</span>
          </span>
        </h1>
        <p className="on-dark-mut mx-auto mt-5 max-w-xl text-[17px] leading-relaxed sm:text-[19px]">
          발언을 대화 단위로 재구성하고, 지시가 다음 회의에서 어떻게 이행되는지까지 추적합니다.
          모든 요약에는 영상 타임스탬프가 붙습니다.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-5">
          {latest && (
            <Link href={`/meetings/${latest.id}`} className="btn-pill">
              최근 회의 보기
            </Link>
          )}
          <Link href="/directives" className="text-[15px] font-medium text-accent-400 hover:underline">
            지시-이행 트래커 &rsaquo;
          </Link>
        </div>

        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-y-8 sm:grid-cols-4">
          {[
            { label: "수집 회의", value: all.length, unit: "건" },
            { label: "발언 스레드", value: threadCount, unit: "개" },
            { label: "추적 중 지시", value: directives.length, unit: `건 · 이행 ${reportedCount}` },
            { label: "AI·데이터 발언", value: aiCount, unit: "건" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <span className="text-[34px] font-semibold leading-none tracking-tight">
                <CountUp value={s.value} />
              </span>
              <span className="on-dark-mut text-[13px]">
                {s.label} · {s.unit}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 최근 회의 하이라이트 (화이트 섹션) ── */}
      {latest && (
        <section className="bg-surf px-5 py-14">
          <div className="mx-auto max-w-6xl">
            {hasSample && (
              <div className="mb-8 flex items-start gap-2.5 rounded-2xl bg-[#fff8e6] px-5 py-3.5 text-[14px] text-[#8a6116]">
                <IconAlert className="mt-0.5 size-4" />
                <p>
                  현재 표시되는 회의는 <strong>데모용 샘플 데이터</strong>입니다. 실제 발언·회의
                  내용이 아니며, 수집 파이프라인(YouTube API + LLM 요약)을 실행하면 실제 KTV 회의
                  데이터로 대체됩니다.
                </p>
              </div>
            )}
            <Reveal>
              <Link
                href={`/meetings/${latest.id}`}
                className="group flex flex-col gap-6 rounded-2xl bg-tint p-7 transition hover:bg-tint2 sm:flex-row sm:items-center sm:p-8"
              >
                <div className="flex-1">
                  <p className="overline-label">
                    최근 회의 · {formatDate(latest.date)} · {MEETING_TYPE_LABEL[latest.type]}
                  </p>
                  <h2 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink group-hover:text-accent-500">
                    {latest.title}
                  </h2>
                  <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-body">
                    {latest.summary.oneLine}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-mut">
                    {latest.summary.agenda.slice(0, 3).map((a, i) => (
                      <span key={i} className="flex items-baseline gap-1.5">
                        <span className="font-semibold text-accent-500">{i + 1}</span>
                        {a.title}
                        <span className="font-mono text-[11px] text-faint">
                          {formatTime(a.timestamp)}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
                <span className="btn-link shrink-0">자세히 보기 &rsaquo;</span>
              </Link>
            </Reveal>
          </div>
        </section>
      )}

      {/* ── 타임라인 (라이트 그레이 섹션) ── */}
      <section className="px-5 py-14">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="h-judge">회의 타임라인</h2>
            <div className="flex gap-1 rounded-full bg-tint2 p-1">
              {FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={f.key === "all" ? "/" : `/?type=${f.key}`}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition ${
                    type === f.key ? "bg-white text-ink shadow-sm" : "text-mut hover:text-ink"
                  }`}
                >
                  {f.label}
                </Link>
              ))}
            </div>
          </div>

          {meetings.length === 0 ? (
            <p className="panel p-10 text-center text-mut">해당 유형의 회의가 아직 없습니다.</p>
          ) : (
            <Reveal stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {meetings.map((m) => (
                <MeetingCard key={m.id} meeting={m} />
              ))}
            </Reveal>
          )}
        </div>
      </section>
    </>
  );
}
