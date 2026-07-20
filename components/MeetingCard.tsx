import Link from "next/link";
import type { Meeting } from "@/lib/types";
import { formatDate, MEETING_TYPE_LABEL } from "@/lib/utils";

export default function MeetingCard({ meeting }: { meeting: Meeting }) {
  const hasAiData = meeting.aiDataPolicy.length > 0;
  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-video w-full bg-navy-800">
        {meeting.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meeting.thumbnail}
            alt=""
            className="size-full object-cover transition group-hover:opacity-90"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-navy-800 to-navy-600 text-navy-200">
            <span className="text-2xl font-bold text-white/90">
              {MEETING_TYPE_LABEL[meeting.type]}
            </span>
            {meeting.sample && <span className="text-xs">데모 샘플 · 영상 미연결</span>}
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-navy-900/85 px-2 py-0.5 text-xs font-medium text-white">
          {MEETING_TYPE_LABEL[meeting.type]}
        </span>
        {hasAiData && (
          <span className="absolute right-2 top-2 rounded-md bg-accent-500 px-2 py-0.5 text-xs font-semibold text-white">
            AI·데이터 {meeting.aiDataPolicy.length}건
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{formatDate(meeting.date)}</span>
          {meeting.sample && (
            <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-amber-700">
              샘플
            </span>
          )}
        </div>
        <h3 className="font-semibold leading-snug text-navy-900 group-hover:text-navy-600">
          {meeting.title}
        </h3>
        <p className="line-clamp-2 text-sm text-slate-600">{meeting.summary.oneLine}</p>
        <div className="mt-auto flex flex-wrap gap-1 pt-2">
          {meeting.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
