import Link from "next/link";
import type { Metadata } from "next";
import SpeakerAvatar from "@/components/SpeakerAvatar";
import Reveal from "@/components/Reveal";
import { getAllDirectives, getMeeting, getSpeakers, UNKNOWN_SPEAKER } from "@/lib/data";
import { DIRECTIVE_STATUS_LABEL, formatDate, formatTime, youtubeUrlAt } from "@/lib/utils";

export const metadata: Metadata = { title: "지시-이행 트래커" };

export default async function DirectivesPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org } = await searchParams;
  const speakers = getSpeakers();
  const all = getAllDirectives();

  // 수명(受命) 부처 필터 목록
  const orgs = [
    ...new Set(
      all.flatMap(({ directive }) =>
        directive.to.map((id) => speakers[id]?.org).filter((o): o is string => Boolean(o))
      )
    ),
  ].sort();

  const items = org
    ? all.filter(({ directive }) => directive.to.some((id) => speakers[id]?.org === org))
    : all;

  return (
    <div className="space-y-6">
      <header>
        <p className="overline-label">Directive Tracker</p>
        <h1 className="h-judge mt-1">지시-이행 트래커</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          대통령·총리의 지시가 어느 부처에 내려졌고, 이후 회의에서 어떻게 후속 보고됐는지 회의를
          넘어 추적합니다. 자동 연결된 후속 보고는 <em>추정 연결</em>로 표시됩니다.
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/directives"
          className={`rounded-full border px-3 py-1 text-sm transition ${
            !org ? "border-navy-900 bg-navy-900 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          전체
        </Link>
        {orgs.map((o) => (
          <Link
            key={o}
            href={`/directives?org=${encodeURIComponent(o)}`}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              org === o ? "border-navy-900 bg-navy-900 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {o}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
          지시 데이터가 없습니다.
        </p>
      ) : (
        <Reveal stagger className="space-y-4">
          {items.map(({ meeting, directive }) => {
            const from = speakers[directive.from] ?? UNKNOWN_SPEAKER;
            const status = DIRECTIVE_STATUS_LABEL[directive.status];
            return (
              <div key={directive.id} className="panel p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <SpeakerAvatar speaker={from} size="md" />
                  <div>
                    <span className="font-extrabold text-ink">{from.name}</span>
                    <span className="ml-1.5 text-xs text-slate-500">{from.role}</span>
                  </div>
                  <span className="text-slate-300">→</span>
                  <div className="flex items-center gap-2">
                    {directive.to.map((id) => {
                      const to = speakers[id] ?? UNKNOWN_SPEAKER;
                      return (
                        <Link key={id} href={`/speakers/${id}`} className="flex items-center gap-1.5 hover:underline">
                          <SpeakerAvatar speaker={to} size="sm" />
                          <span className="text-sm text-slate-700">{to.org || to.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                  <span className={`ml-auto rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <p className="mt-3 text-slate-800">{directive.content}</p>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Link href={`/meetings/${meeting.id}`} className="text-navy-600 hover:underline">
                    {formatDate(meeting.date)} · {meeting.title}
                  </Link>
                  {meeting.videoId ? (
                    <a
                      href={youtubeUrlAt(meeting.videoId, directive.timestamp)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono hover:underline"
                    >
                      ▶ {formatTime(directive.timestamp)}
                    </a>
                  ) : (
                    <span className="font-mono">▶ {formatTime(directive.timestamp)}</span>
                  )}
                  {directive.tags.map((t) => (
                    <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5">
                      #{t}
                    </span>
                  ))}
                </div>

                {directive.followUps.length > 0 && (
                  <div className="mt-4 border-t border-dashed border-slate-200 pt-3">
                    <p className="mb-2 text-xs font-extrabold text-green-600">후속 보고 타임라인</p>
                    <ol className="space-y-1.5">
                      {directive.followUps.map((fu, i) => {
                        const fuMeeting = getMeeting(fu.meetingId);
                        return (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="mt-1 size-2 shrink-0 rounded-full bg-green-600" />
                            <div>
                              <Link
                                href={
                                  fu.exchangeId
                                    ? `/meetings/${fu.meetingId}#${fu.exchangeId}`
                                    : `/meetings/${fu.meetingId}`
                                }
                                className="font-medium text-navy-700 hover:underline"
                              >
                                {fuMeeting ? formatDate(fuMeeting.date) : fu.meetingId}
                              </Link>
                              <span className="ml-2 text-slate-600">{fu.summary}</span>
                              {fu.inferred && (
                                <span className="ml-2 rounded border border-slate-300 bg-slate-50 px-1 py-0.5 text-[10px] text-slate-500">
                                  추정 연결
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </div>
            );
          })}
        </Reveal>
      )}
    </div>
  );
}
