"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Meeting, NetworkEdge, NetworkNode, SpeakerMap } from "@/lib/types";
import {
  DIRECTIVE_STATUS_LABEL,
  formatDate,
  formatTime,
  MEETING_TYPE_LABEL,
  youtubeUrlAt,
} from "@/lib/utils";
import { UNKNOWN_SPEAKER } from "@/lib/client-data";
import ThreadView from "./ThreadView";
import { IconAlert, IconFilm, IconInfo, IconNetwork, IconPin, IconTag, IconThread } from "./icons";
import NetworkView from "./NetworkView";
import SpeakerAvatar from "./SpeakerAvatar";

type Tab = "thread" | "network";

export default function MeetingDetail({
  meeting,
  speakers,
  network,
}: {
  meeting: Meeting;
  speakers: SpeakerMap;
  network: { nodes: NetworkNode[]; edges: NetworkEdge[] };
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerBoxRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("thread");
  const canSeek = Boolean(meeting.videoId);

  /** YouTube iframe API postMessage로 해당 시점으로 점프 + 재생 */
  const seek = (t: number) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      JSON.stringify({ event: "command", func: "seekTo", args: [Math.floor(t), true] }),
      "*"
    );
    win.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
    playerBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-10">
      {meeting.sample && (
        <div className="rounded-2xl bg-[rgba(255,214,10,0.1)] px-4 py-3 text-sm text-[#ffd60a]/90">
          <IconAlert className="mr-1.5 size-4 align-[-2px]" /> 이 회의는 <strong>데모용 샘플 데이터</strong>입니다. 실제 발언·회의 내용이 아닙니다.
        </div>
      )}

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-mut">
          <span className="chip bg-tint2 text-mut">
            {MEETING_TYPE_LABEL[meeting.type]}
          </span>
          <span>{formatDate(meeting.date)}</span>
          <span>· 영상 길이 {formatTime(meeting.duration)}</span>
        </div>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-ink sm:text-[34px]">{meeting.title}</h1>
        <p className="max-w-3xl text-body">{meeting.summary.oneLine}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* 좌측: 플레이어 + 전체 요약 + 안건 */}
        <div className="space-y-5">
          <div ref={playerBoxRef} className="overflow-hidden rounded-2xl bg-black shadow-card">
            {canSeek ? (
              <iframe
                ref={iframeRef}
                className="aspect-video w-full"
                src={`https://www.youtube.com/embed/${meeting.videoId}?enablejsapi=1`}
                title={meeting.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-navy-900 text-navy-300">
                <IconFilm className="size-8" />
                <p className="text-sm">
                  샘플 데이터 — 연결된 영상이 없습니다. 파이프라인 실행 시 KTV 영상이 임베드됩니다.
                </p>
              </div>
            )}
          </div>

          <section className="panel p-5">
            <h2 className="mb-2 text-lg font-semibold tracking-tight text-ink">전체 요약</h2>
            <p className="mb-1 text-xs text-faint">
              <IconInfo className="mr-1 size-3.5 align-[-2px]" /> 영상 자막을 바탕으로 AI가 생성한 요약입니다. 타임스탬프로 원문을 확인하세요.
            </p>
            <div className="space-y-3 text-sm leading-relaxed text-body">
              {meeting.summary.overview.split("\n\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="mb-3 text-lg font-semibold tracking-tight text-ink">안건</h2>
            <ol className="space-y-2">
              {meeting.summary.agenda.map((item, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => canSeek && seek(item.timestamp)}
                    disabled={!canSeek}
                    className={`w-full rounded-xl bg-tint p-3 text-left transition ${
                      canSeek ? "hover:bg-tint2" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-tint2 text-xs font-semibold text-accent-400">
                        {i + 1}
                      </span>
                      <span className="font-medium text-ink">{item.title}</span>
                      <span className="ml-auto font-mono text-xs text-faint">
                        ▶ {formatTime(item.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1.5 pl-8 text-sm text-body">{item.summary}</p>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          {meeting.aiDataPolicy.length > 0 && (
            <section className="rounded-2xl bg-[rgba(10,132,255,0.08)] p-5">
              <h2 className="mb-3 text-lg font-semibold tracking-tight text-ink">
                <IconTag className="mr-1.5 size-[18px] align-[-2px] text-accent-500" /> AI·데이터 정책 발언 <span className="text-accent-500">{meeting.aiDataPolicy.length}건</span>
              </h2>
              <div className="space-y-3">
                {meeting.aiDataPolicy.map((item, i) => {
                  const sp = speakers[item.speakerId] ?? UNKNOWN_SPEAKER;
                  return (
                    <div key={i} className="flex gap-3 rounded-xl bg-surf p-3">
                      <SpeakerAvatar speaker={sp} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{sp.name}</span>
                          <span className="text-xs text-mut">{item.topic}</span>
                          <button
                            type="button"
                            onClick={() => canSeek && seek(item.timestamp)}
                            className="ml-auto font-mono text-xs text-navy-500 hover:underline disabled:no-underline"
                            disabled={!canSeek}
                          >
                            ▶ {formatTime(item.timestamp)}
                          </button>
                        </div>
                        <p className="mt-1 text-sm text-body">{item.summary}</p>
                        {item.quote && (
                          <p className="mt-1 border-l-2 border-accent-400 pl-2 text-sm italic text-body">
                            “{item.quote}”
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {item.tags.map((t) => (
                            <span key={t} className="rounded-full bg-tint2 px-2 py-0.5 text-[11px] text-body">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* 우측: 발언 스레드 / 네트워크 탭 */}
        <div className="space-y-4">
          <div className="flex gap-1 rounded-full bg-tint2 p-1">
            <button
              type="button"
              onClick={() => setTab("thread")}
              className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                tab === "thread" ? "bg-tint2 text-ink" : "text-mut hover:text-ink"
              }`}
            >
              <IconThread className="mr-1.5 size-4 align-[-2px]" /> 발언 스레드
            </button>
            <button
              type="button"
              onClick={() => setTab("network")}
              className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                tab === "network" ? "bg-tint2 text-ink" : "text-mut hover:text-ink"
              }`}
            >
              <IconNetwork className="mr-1.5 size-4 align-[-2px]" /> 네트워크
            </button>
          </div>

          {tab === "thread" ? (
            <ThreadView
              exchanges={meeting.exchanges}
              speakers={speakers}
              onSeek={seek}
              canSeek={canSeek}
            />
          ) : (
            <NetworkView nodes={network.nodes} edges={network.edges} speakers={speakers} />
          )}

          {meeting.directives.length > 0 && (
            <section className="panel p-4">
              <h3 className="mb-3 flex items-center justify-between font-bold text-ink">
                <IconPin className="mr-1.5 size-4 align-[-2px] text-accent-500" /> 이 회의의 지시
                <Link href="/directives" className="text-xs font-normal text-navy-500 hover:underline">
                  전체 지시-이행 보기 →
                </Link>
              </h3>
              <div className="space-y-2">
                {meeting.directives.map((d) => {
                  const from = speakers[d.from] ?? UNKNOWN_SPEAKER;
                  const status = DIRECTIVE_STATUS_LABEL[d.status];
                  return (
                    <div key={d.id} className="rounded-xl bg-tint p-3">
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-ink">{from.name}</span>
                        <span className="text-faint">→</span>
                        {d.to.map((toId) => (
                          <span key={toId} className="text-body">
                            {(speakers[toId] ?? UNKNOWN_SPEAKER).org || (speakers[toId] ?? UNKNOWN_SPEAKER).name}
                          </span>
                        ))}
                        <span className={`ml-auto rounded-full border px-2 py-0.5 ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm text-body">{d.content}</p>
                      {canSeek ? (
                        <button
                          type="button"
                          onClick={() => seek(d.timestamp)}
                          className="mt-1 font-mono text-xs text-navy-500 hover:underline"
                        >
                          ▶ {formatTime(d.timestamp)}
                        </button>
                      ) : (
                        <span className="mt-1 font-mono text-xs text-faint">
                          ▶ {formatTime(d.timestamp)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {canSeek && (
            <p className="text-xs text-faint">
              원본 영상:{" "}
              <a href={youtubeUrlAt(meeting.videoId, 0)} target="_blank" rel="noreferrer" className="underline">
                KTV 유튜브에서 보기
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
