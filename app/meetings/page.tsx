import Link from "next/link";
import type { Metadata } from "next";
import BackLink from "@/components/BackLink";
import Reveal from "@/components/Reveal";
import { getMeetings } from "@/lib/data";
import { formatDate, MEETING_TYPE_LABEL } from "@/lib/utils";

export const metadata: Metadata = { title: "전체 회의" };

/** 전체 회의 목록 — 홈에는 최신 하이라이트만 두고, 전량은 여기서 컴팩트하게 */
export default function MeetingsPage() {
  const meetings = getMeetings();

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-5 py-10">
      <BackLink />
      <header>
        <p className="overline-label">Archive</p>
        <h1 className="h-judge mt-1">전체 회의 {meetings.length}건</h1>
        <p className="mt-2 text-sm leading-relaxed text-body">
          2025년 6월 취임 후 첫 국무회의부터 최신 회의까지. 행을 클릭하면 요약·발언 스레드·영상으로
          이동합니다.
        </p>
      </header>

      <Reveal stagger className="space-y-2">
        {meetings.map((m) => (
          <Link
            key={m.id}
            href={`/meetings/${m.id}`}
            className="panel group flex items-center gap-4 px-5 py-4 transition hover:bg-tint"
          >
            <div className="w-24 shrink-0 text-[12.5px] font-medium text-mut">
              {formatDate(m.date).replace(/^\d+년 /, "")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15.5px] font-semibold tracking-tight text-ink group-hover:text-accent-400">
                {m.title}
              </p>
              <p className="mt-0.5 truncate text-[12.5px] text-mut">{m.summary.oneLine}</p>
            </div>
            <div className="hidden shrink-0 items-center gap-3 text-[12px] font-medium text-mut sm:flex">
              <span className={m.directives.length > 0 ? "text-[#ff6961]" : ""}>
                지시 {m.directives.length}
              </span>
              {m.aiDataPolicy.length > 0 && (
                <span className="text-[#64b5ff]">AI {m.aiDataPolicy.length}</span>
              )}
              <span className="rounded-full bg-tint2 px-2 py-0.5 text-[11px]">
                {MEETING_TYPE_LABEL[m.type]}
              </span>
            </div>
          </Link>
        ))}
      </Reveal>
    </div>
  );
}
