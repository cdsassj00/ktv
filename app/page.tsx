import Link from "next/link";
import MeetingCard from "@/components/MeetingCard";
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
    <div className="space-y-10">
      {/* ── 표지형 히어로: 명제 + 최근 회의 근거 패널 + 사실 스트립 ── */}
      <section className="overflow-hidden rounded-lg bg-navy-900 text-white shadow-lift">
        <div className="grid gap-8 p-8 sm:p-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="flex flex-col justify-center gap-5">
            <p className="overline-label">KTV 공개 국무회의·국민업무보고 아카이브</p>
            <h1 className="text-[34px] font-black leading-[1.18] tracking-tight sm:text-[42px]">
              발언을 대화 단위로 재구성하고,
              <br />
              지시의 이행까지 추적한다
            </h1>
            <ul className="on-dark-mut space-y-1.5 text-[14.5px] leading-relaxed">
              <li className="flex gap-2">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent-400" />
                발언 스레드 — 지시·답변·질문의 주고받음을 대화 흐름으로 표시, 전 항목 영상
                타임스탬프 연동
              </li>
              <li className="flex gap-2">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-gold-400" />
                지시-이행 트래커 — 지시 발언을 추출하고 다음 회의의 후속 보고와 연결
              </li>
              <li className="flex gap-2">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-navy-400" />
                AI·데이터 정책 발언만 별도 발췌해 태그·추이로 집계
              </li>
            </ul>
          </div>

          {/* 최근 회의 근거 패널 */}
          {latest && (
            <div className="rounded-lg bg-surf p-5 text-ink shadow-lift">
              <div className="flex items-center justify-between border-b border-hair pb-2.5">
                <span className="text-[11px] font-extrabold tracking-[0.18em] text-mut">최근 회의</span>
                <span className="chip border-hair bg-navy-50 text-navy-600">
                  {MEETING_TYPE_LABEL[latest.type]}
                </span>
              </div>
              <h2 className="mt-3 text-lg font-black leading-snug">{latest.title}</h2>
              <p className="mt-0.5 text-xs font-semibold text-mut">{formatDate(latest.date)}</p>
              <ol className="mt-3 space-y-1.5 border-t border-hair pt-3">
                {latest.summary.agenda.slice(0, 3).map((a, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-[13.5px]">
                    <span className="shrink-0 font-black text-accent-500">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-body">{a.title}</span>
                    <span className="shrink-0 font-mono text-[11px] text-faint">
                      {formatTime(a.timestamp)}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex items-center gap-2 border-t border-hair pt-3 text-[12px] font-bold text-mut">
                <span>지시 {latest.directives.length}건</span>
                <span className="text-hair2">·</span>
                <span>AI·데이터 발언 {latest.aiDataPolicy.length}건</span>
                <Link
                  href={`/meetings/${latest.id}`}
                  className="ml-auto rounded bg-accent-500 px-3.5 py-1.5 text-[12.5px] font-bold text-white transition hover:bg-accent-600"
                >
                  상세 보기 →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* 사실 스트립 */}
        <div className="grid grid-cols-2 gap-y-4 border-t border-white/10 bg-navy-950/60 px-8 py-4 sm:grid-cols-4 sm:px-10">
          {[
            { label: "수집 회의", value: all.length, unit: "건" },
            { label: "재구성 발언 스레드", value: threadCount, unit: "개" },
            { label: "추적 중 지시", value: directives.length, unit: `건 · 이행확인 ${reportedCount}` },
            { label: "AI·데이터 정책 발언", value: aiCount, unit: "건" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col gap-0.5 border-l-2 border-white/15 pl-3">
              <span className="on-dark-mut text-[11px] font-bold">{s.label}</span>
              <span className="text-xl font-black leading-none">
                {s.value}
                <span className="on-dark-mut ml-1 text-[11px] font-bold">{s.unit}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {hasSample && (
        <div className="rounded-lg border border-gold-400/50 bg-[#faf5e9] px-5 py-3 text-[13.5px] font-medium text-[#7a5a1a]">
          현재 표시되는 회의는 <strong>데모용 샘플 데이터</strong>입니다. 실제 발언·회의 내용이
          아니며, 수집 파이프라인(YouTube API + LLM 요약)을 실행하면 실제 KTV 회의 데이터로
          대체됩니다.
        </div>
      )}

      {/* ── 타임라인 ── */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink pb-3">
          <div>
            <p className="overline-label">Timeline</p>
            <h2 className="h-judge mt-1">회의 타임라인</h2>
          </div>
          <div className="flex gap-1 rounded-md border border-hair bg-surf p-1">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key === "all" ? "/" : `/?type=${f.key}`}
                className={`rounded px-3.5 py-1.5 text-[13px] font-bold transition ${
                  type === f.key
                    ? "bg-navy-900 text-white"
                    : "text-mut hover:bg-navy-50 hover:text-ink"
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
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {meetings.map((m) => (
              <MeetingCard key={m.id} meeting={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
