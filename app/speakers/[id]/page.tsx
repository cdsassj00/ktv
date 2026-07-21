import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SpeakerAvatar from "@/components/SpeakerAvatar";
import BackLink from "@/components/BackLink";
import { getSpeaker, getSpeakerHistory, getSpeakers } from "@/lib/data";
import { formatDate, formatTime, TURN_KIND_STYLE, youtubeUrlAt } from "@/lib/utils";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(getSpeakers()).map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const sp = getSpeaker(id);
  return { title: sp ? `${sp.name} ${sp.role}` : "발언자" };
}

export default async function SpeakerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const speaker = getSpeaker(id);
  if (!speaker) notFound();
  const history = getSpeakerHistory(id);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-5 py-10">
      <BackLink />
      <header className="flex flex-col items-center gap-4 panel p-9 text-ink sm:flex-row sm:items-center">
        <SpeakerAvatar speaker={speaker} size="xl" />
        <div className="text-center sm:text-left">
          <h1 className="text-[28px] font-semibold tracking-tight">{speaker.name}</h1>
          <p className="mt-1 on-dark-mut">
            {speaker.role} · {speaker.org}
          </p>
          {speaker.term && (
            <p className="mt-1 text-[13px] text-faint">
              재임: {speaker.term.from} ~ {speaker.term.to ?? "현재"}
            </p>
          )}
          {speaker.photoSource && (
            <p className="mt-2 text-[12px] text-faint">사진 출처: {speaker.photoSource}</p>
          )}
        </div>
      </header>

      <section className="space-y-4">
        <h2 className="h-judge">회의별 발언 이력</h2>
        {history.length === 0 ? (
          <p className="panel p-8 text-center text-mut">
            아직 기록된 발언이 없습니다.
          </p>
        ) : (
          history.map(({ meeting, turns }) => (
            <div key={meeting.id} className="panel p-5">
              <Link href={`/meetings/${meeting.id}`} className="font-semibold text-ink hover:underline">
                {formatDate(meeting.date)} · {meeting.title}
              </Link>
              <ul className="mt-3 space-y-2">
                {turns.map((t, i) => {
                  const kind = TURN_KIND_STYLE[t.kind] ?? TURN_KIND_STYLE["발언"];
                  return (
                    <li key={i} className="flex items-start gap-2 text-[15px]">
                      <span className={`mt-0.5 shrink-0 rounded-full border px-2 py-0.5 text-[12px] font-medium ${kind.className}`}>
                        {kind.label}
                      </span>
                      <div>
                        <Link href={`/meetings/${meeting.id}#${t.exchangeId}`} className="text-body hover:underline">
                          <span className="text-[13px] text-faint">[{t.topic}]</span> {t.summary}
                        </Link>
                        {meeting.videoId ? (
                          <a
                            href={youtubeUrlAt(meeting.videoId, t.timestamp)}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 font-mono text-[13px] text-navy-500 hover:underline"
                          >
                            ▶ {formatTime(t.timestamp)}
                          </a>
                        ) : (
                          <span className="ml-2 font-mono text-[13px] text-faint">
                            ▶ {formatTime(t.timestamp)}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
