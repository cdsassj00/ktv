import Link from "next/link";
import type { Meeting } from "@/lib/types";
import { formatDate, MEETING_TYPE_LABEL } from "@/lib/utils";

export default function MeetingCard({ meeting }: { meeting: Meeting }) {
  const hasAiData = meeting.aiDataPolicy.length > 0;
  return (
    <div className="tilt-parent">
      <Link
        href={`/meetings/${meeting.id}`}
        className="tilt-card group flex h-full flex-col overflow-hidden rounded-2xl border border-navy-100/80 bg-white shadow-card"
      >
        <div className="relative aspect-video w-full overflow-hidden bg-navy-900">
          {meeting.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={meeting.thumbnail}
              alt=""
              className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="hero-surface flex size-full flex-col items-center justify-center gap-1.5">
              <span className="text-2xl font-black tracking-tight text-white/95">
                {MEETING_TYPE_LABEL[meeting.type]}
              </span>
              {meeting.sample && (
                <span className="text-[11px] font-medium text-navy-300">데모 샘플 · 영상 미연결</span>
              )}
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-md bg-navy-950/85 px-2 py-1 text-[11px] font-bold tracking-wide text-white backdrop-blur">
            {MEETING_TYPE_LABEL[meeting.type]}
          </span>
          {hasAiData && (
            <span className="absolute right-3 top-3 rounded-md bg-accent-500 px-2 py-1 text-[11px] font-bold text-white shadow-[0_6px_16px_-6px_rgb(249_93_67/0.8)]">
              AI·데이터 {meeting.aiDataPolicy.length}건
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 h-[3px] scale-x-0 bg-gradient-to-r from-accent-500 to-gold-500 transition-transform duration-500 group-hover:scale-x-100" />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>{formatDate(meeting.date)}</span>
            {meeting.sample && (
              <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-amber-700">
                샘플
              </span>
            )}
          </div>
          <h3 className="text-[17px] font-extrabold leading-snug tracking-tight text-navy-900 group-hover:text-navy-600">
            {meeting.title}
          </h3>
          <p className="line-clamp-2 text-sm leading-relaxed text-slate-600">
            {meeting.summary.oneLine}
          </p>
          <div className="mt-auto flex flex-wrap gap-1 pt-2.5">
            {meeting.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-600"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </div>
  );
}
