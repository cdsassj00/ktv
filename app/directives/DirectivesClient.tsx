"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SpeakerAvatar from "@/components/SpeakerAvatar";
import Reveal from "@/components/Reveal";
import { UNKNOWN_SPEAKER } from "@/lib/client-data";
import type { Directive, SpeakerMap } from "@/lib/types";
import { DIRECTIVE_STATUS_LABEL, formatDate, formatTime, youtubeUrlAt } from "@/lib/utils";

export interface DirectiveItem {
  meeting: { id: string; title: string; date: string; videoId: string };
  directive: Directive;
}

/** 지시 목록 + 부처 필터 (정적 export를 위해 클라이언트 상태로 필터링) */
export default function DirectivesClient({
  items,
  speakers,
  meetingIndex,
}: {
  items: DirectiveItem[];
  speakers: SpeakerMap;
  meetingIndex: Record<string, { title: string; date: string }>;
}) {
  const [org, setOrg] = useState<string | null>(null);

  const orgs = useMemo(
    () =>
      [
        ...new Set(
          items.flatMap(({ directive }) =>
            directive.to.map((id) => speakers[id]?.org).filter((o): o is string => Boolean(o))
          )
        ),
      ].sort(),
    [items, speakers]
  );

  const filtered = org
    ? items.filter(({ directive }) => directive.to.some((id) => speakers[id]?.org === org))
    : items;

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setOrg(null)}
          className={`rounded-full border px-3.5 py-1.5 text-[14px] font-medium transition ${
            !org ? "border-transparent bg-ink text-paper" : "border-transparent bg-surf text-mut hover:text-ink"
          }`}
        >
          전체
        </button>
        {orgs.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setOrg(o)}
            className={`rounded-full border px-3.5 py-1.5 text-[14px] font-medium transition ${
              org === o ? "border-transparent bg-ink text-paper" : "border-transparent bg-surf text-mut hover:text-ink"
            }`}
          >
            {o}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="panel p-8 text-center text-mut">지시 데이터가 없습니다.</p>
      ) : (
        <Reveal stagger className="space-y-4">
          {filtered.map(({ meeting, directive }) => {
            const from = speakers[directive.from] ?? UNKNOWN_SPEAKER;
            const status = DIRECTIVE_STATUS_LABEL[directive.status];
            return (
              <div key={directive.id} className="panel p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <SpeakerAvatar speaker={from} size="md" />
                  <div>
                    <span className="font-extrabold text-ink">{from.name}</span>
                    <span className="ml-1.5 text-[13px] text-mut">{from.role}</span>
                  </div>
                  <span className="text-faint">→</span>
                  <div className="flex items-center gap-2">
                    {directive.to.map((id) => {
                      const to = speakers[id] ?? UNKNOWN_SPEAKER;
                      return (
                        <Link key={id} href={`/speakers/${id}`} className="flex items-center gap-1.5 hover:underline">
                          <SpeakerAvatar speaker={to} size="sm" />
                          <span className="text-[15px] text-body">{to.org || to.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                  <span className={`ml-auto rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <p className="mt-3 text-ink">{directive.content}</p>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-mut">
                  <Link href={`/meetings/${meeting.id}`} className="text-accent-400 hover:underline">
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
                    <span key={t} className="rounded-full bg-tint2 px-2 py-0.5">
                      #{t}
                    </span>
                  ))}
                </div>

                {directive.followUps.length > 0 && (
                  <div className="mt-4 border-t border-dashed border-hair pt-3">
                    <p className="mb-2 text-[13px] font-extrabold text-green-600">후속 보고 타임라인</p>
                    <ol className="space-y-1.5">
                      {directive.followUps.map((fu, i) => {
                        const fuMeeting = meetingIndex[fu.meetingId];
                        return (
                          <li key={i} className="flex items-start gap-2 text-[15px]">
                            <span className="mt-1 size-2 shrink-0 rounded-full bg-green-600" />
                            <div>
                              <Link
                                href={
                                  fu.exchangeId
                                    ? `/meetings/${fu.meetingId}#${fu.exchangeId}`
                                    : `/meetings/${fu.meetingId}`
                                }
                                className="font-medium text-body hover:underline"
                              >
                                {fuMeeting ? formatDate(fuMeeting.date) : fu.meetingId}
                              </Link>
                              <span className="ml-2 text-body">{fu.summary}</span>
                              {fu.inferred && (
                                <span className="ml-2 rounded border border-hair bg-tint px-1 py-0.5 text-[10px] text-mut">
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
    </>
  );
}
