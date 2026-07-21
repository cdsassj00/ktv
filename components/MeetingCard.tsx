import Link from "next/link";
import type { Meeting } from "@/lib/types";
import { formatDate, MEETING_TYPE_LABEL } from "@/lib/utils";

export default function MeetingCard({ meeting }: { meeting: Meeting }) {
  const aiCount = meeting.aiDataPolicy.length;
  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="panel group flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-navy-950">
        {meeting.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={meeting.thumbnail}
            alt=""
            className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1 bg-navy-950">
            <span className="text-xl font-semibold tracking-tight text-white/90">
              {MEETING_TYPE_LABEL[meeting.type]}
            </span>
            {meeting.sample && (
              <span className="on-dark-mut text-[12px]">데모 샘플 · 영상 미연결</span>
            )}
          </div>
        )}
        {aiCount > 0 && (
          <span className="chip absolute right-3 top-3 bg-accent-500 text-white">
            AI·데이터 {aiCount}건
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-5">
        <p className="text-[13px] font-medium text-mut">
          {MEETING_TYPE_LABEL[meeting.type]} · {formatDate(meeting.date)}
          {meeting.sample && <span className="ml-1.5 text-[#b25000]">샘플</span>}
        </p>
        <h3 className="text-[17px] font-semibold leading-snug tracking-tight text-ink group-hover:text-accent-500">
          {meeting.title}
        </h3>
        <p className="line-clamp-2 text-[14.5px] leading-relaxed text-body">
          {meeting.summary.oneLine}
        </p>

        <div className="mt-auto flex items-center gap-3 pt-3 text-[13px] font-medium text-mut">
          <span>안건 {meeting.summary.agenda.length}</span>
          <span className="text-hair">·</span>
          <span>스레드 {meeting.exchanges.length}</span>
          <span className="text-hair">·</span>
          <span className={meeting.directives.length > 0 ? "text-red-600" : ""}>
            지시 {meeting.directives.length}
          </span>
        </div>
      </div>
    </Link>
  );
}
