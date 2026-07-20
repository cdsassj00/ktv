import Link from "next/link";
import MeetingCard from "@/components/MeetingCard";
import { getMeetings } from "@/lib/data";
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

  return (
    <div className="space-y-8">
      {hasSample && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ 현재 표시되는 회의는 <strong>데모용 샘플 데이터</strong>입니다. 실제 발언·회의
          내용이 아니며, 수집 파이프라인(YouTube API + Claude 요약)을 실행하면 실제 KTV 회의
          데이터로 대체됩니다.
        </div>
      )}

      {latest && (
        <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 to-navy-700 text-white shadow-lg">
          <div className="flex flex-col gap-4 p-6 sm:p-8">
            <span className="text-xs font-medium uppercase tracking-wider text-navy-300">
              최근 회의
            </span>
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{latest.title}</h1>
              <p className="mt-1 text-sm text-navy-200">
                {formatDate(latest.date)} · {MEETING_TYPE_LABEL[latest.type]}
              </p>
            </div>
            <p className="max-w-3xl text-navy-100">{latest.summary.oneLine}</p>
            <div>
              <Link
                href={`/meetings/${latest.id}`}
                className="inline-block rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-600"
              >
                요약·발언 스레드 보기 →
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-navy-900">회의 타임라인</h2>
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {FILTERS.map((f) => (
              <Link
                key={f.key}
                href={f.key === "all" ? "/" : `/?type=${f.key}`}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  type === f.key
                    ? "bg-navy-800 font-medium text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {meetings.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
            해당 유형의 회의가 아직 없습니다.
          </p>
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
