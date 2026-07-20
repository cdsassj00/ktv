import Link from "next/link";
import MeetingCard from "@/components/MeetingCard";
import { getAllAiDataPolicy, getAllDirectives, getMeetings } from "@/lib/data";
import { formatDate, MEETING_TYPE_LABEL } from "@/lib/utils";

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
  const directiveCount = getAllDirectives().length;
  const aiCount = getAllAiDataPolicy().length;

  return (
    <div className="space-y-12">
      {/* ── 히어로 ─────────────────────────────── */}
      <section className="hero-surface relative overflow-hidden rounded-3xl text-white shadow-lift">
        <div className="relative z-10 grid gap-10 p-8 sm:p-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center">
          <div className="space-y-6">
            <p className="kicker">KTV 공개 국무회의 아카이브</p>
            <h1 className="text-4xl font-black leading-[1.15] tracking-tight sm:text-5xl">
              국무회의를
              <br />
              <span className="bg-gradient-to-r from-accent-400 via-gold-400 to-accent-400 bg-clip-text text-transparent">
                대화 스레드
              </span>
              로 읽다
            </h1>
            <p className="max-w-xl text-[15px] leading-relaxed text-navy-100">
              누가 지시했고, 누가 어떻게 답했는지. 대통령 주재 공개회의를 발언 단위로
              재구성하고, 지시가 다음 회의에서 어떻게 이행되는지까지 추적합니다. 모든 요약에는
              영상 타임스탬프가 붙어 원문을 바로 확인할 수 있습니다.
            </p>
            {latest && (
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/meetings/${latest.id}`}
                  className="rounded-xl bg-accent-500 px-6 py-3 text-sm font-bold text-white shadow-[0_12px_28px_-10px_rgb(249_93_67/0.7)] transition hover:-translate-y-0.5 hover:bg-accent-600"
                >
                  최근 회의 보기 →
                </Link>
                <span className="text-xs text-navy-300">
                  {formatDate(latest.date)} · {MEETING_TYPE_LABEL[latest.type]}
                </span>
              </div>
            )}
          </div>

          {/* 3D 플로팅 스탯 카드 */}
          <div className="tilt-parent relative hidden h-64 lg:block" style={{ perspective: "1100px" }}>
            <div className="glass absolute left-2 top-2 w-44 animate-float-a rounded-2xl p-4">
              <p className="text-[11px] font-bold tracking-widest text-navy-200">수집된 회의</p>
              <p className="mt-1 text-4xl font-black text-white">{all.length}</p>
              <p className="mt-1 text-[11px] text-navy-300">국무회의 · 업무보고</p>
            </div>
            <div className="glass absolute right-0 top-16 w-48 animate-float-b rounded-2xl p-4">
              <p className="text-[11px] font-bold tracking-widest text-accent-400">추적 중인 지시</p>
              <p className="mt-1 text-4xl font-black text-white">{directiveCount}</p>
              <p className="mt-1 text-[11px] text-navy-300">지시 → 후속보고 연결</p>
            </div>
            <div className="glass absolute bottom-0 left-16 w-44 animate-float-c rounded-2xl p-4">
              <p className="text-[11px] font-bold tracking-widest text-gold-400">AI·데이터 발언</p>
              <p className="mt-1 text-4xl font-black text-white">{aiCount}</p>
              <p className="mt-1 text-[11px] text-navy-300">정책 발언 하이라이트</p>
            </div>
          </div>
        </div>
      </section>

      {hasSample && (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 px-5 py-3.5 text-sm text-amber-800 shadow-card">
          ⚠️ 현재 표시되는 회의는 <strong>데모용 샘플 데이터</strong>입니다. 실제 발언·회의 내용이
          아니며, 수집 파이프라인(YouTube API + LLM 요약)을 실행하면 실제 KTV 회의 데이터로
          대체됩니다.
        </div>
      )}

      {/* ── 타임라인 ─────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="kicker">Timeline</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-navy-900">회의 타임라인</h2>
          </div>
          <div className="flex gap-1 rounded-xl border border-navy-100 bg-white p-1 shadow-card">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key === "all" ? "/" : `/?type=${f.key}`}
                className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                  type === f.key
                    ? "bg-navy-900 text-white shadow"
                    : "text-slate-500 hover:bg-navy-50 hover:text-navy-800"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {meetings.length === 0 ? (
          <p className="rounded-xl border border-navy-100 bg-white p-10 text-center text-slate-500 shadow-card">
            해당 유형의 회의가 아직 없습니다.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {meetings.map((m) => (
              <MeetingCard key={m.id} meeting={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
