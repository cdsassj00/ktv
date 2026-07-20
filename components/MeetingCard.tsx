import Link from "next/link";
import type { Meeting } from "@/lib/types";
import { formatDate, MEETING_TYPE_LABEL } from "@/lib/utils";

export default function MeetingCard({ meeting }: { meeting: Meeting }) {
  const aiCount = meeting.aiDataPolicy.length;
  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="panel group flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-navy-900">
        {meeting.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={meeting.thumbnail} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 bg-navy-900">
            <span className="text-xl font-black tracking-tight text-white/90">
              {MEETING_TYPE_LABEL[meeting.type]}
            </span>
            {meeting.sample && (
              <span className="on-dark-mut text-[11px] font-semibold">데모 샘플 · 영상 미연결</span>
            )}
          </div>
        )}
        <span className="absolute left-3 top-3 rounded bg-navy-950/85 px-2 py-0.5 text-[11px] font-bold text-white">
          {MEETING_TYPE_LABEL[meeting.type]}
        </span>
        {aiCount > 0 && (
          <span className="absolute right-3 top-3 rounded bg-accent-500 px-2 py-0.5 text-[11px] font-bold text-white">
            AI·데이터 {aiCount}건
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-[11.5px] font-bold text-mut">
          <span>{formatDate(meeting.date)}</span>
          {meeting.sample && (
            <span className="chip border-gold-400/50 bg-[#faf5e9] text-[#7a5a1a]">샘플</span>
          )}
        </div>
        <h3 className="text-[16.5px] font-extrabold leading-snug tracking-tight text-ink group-hover:text-navy-500">
          {meeting.title}
        </h3>
        <p className="line-clamp-2 text-[13.5px] leading-relaxed text-body">
          {meeting.summary.oneLine}
        </p>

        {/* 사실 행: 이 회의의 구성 요소 수 */}
        <div className="mt-auto flex items-center gap-3 border-t border-hair pt-2.5 text-[12px] font-bold text-mut">
          <span>안건 {meeting.summary.agenda.length}</span>
          <span className="text-hair2">·</span>
          <span>스레드 {meeting.exchanges.length}</span>
          <span className="text-hair2">·</span>
          <span className={meeting.directives.length > 0 ? "text-accent-500" : ""}>
            지시 {meeting.directives.length}
          </span>
          <span className="ml-auto flex flex-wrap gap-1">
            {meeting.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="rounded bg-tint px-1.5 py-0.5 text-[11px] font-semibold text-body">
                #{tag}
              </span>
            ))}
          </span>
        </div>
      </div>
    </Link>
  );
}
