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
    <div className="space-y-6">
      {meeting.sample && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ 이 회의는 <strong>데모용 샘플 데이터</strong>입니다. 실제 발언·회의 내용이 아닙니다.
        </div>
      )}

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <span className="rounded-md bg-navy-800 px-2 py-0.5 text-xs font-medium text-white">
            {MEETING_TYPE_LABEL[meeting.type]}
          </span>
          <span>{formatDate(meeting.date)}</span>
          <span>· 영상 길이 {formatTime(meeting.duration)}</span>
        </div>
        <h1 className="text-2xl font-bold text-navy-900 sm:text-3xl">{meeting.title}</h1>
        <p className="max-w-3xl text-slate-600">{meeting.summary.oneLine}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* 좌측: 플레이어 + 전체 요약 + 안건 */}
        <div className="space-y-5">
          <div ref={playerBoxRef} className="overflow-hidden rounded-xl bg-black shadow">
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
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-navy-900 to-navy-700 text-navy-200">
                <span className="text-3xl">🎬</span>
                <p className="text-sm">
                  샘플 데이터 — 연결된 영상이 없습니다. 파이프라인 실행 시 KTV 영상이 임베드됩니다.
                </p>
              </div>
            )}
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-lg font-bold text-navy-900">전체 요약</h2>
            <p className="mb-1 text-xs text-slate-400">
              ⓘ 영상 자막을 바탕으로 AI가 생성한 요약입니다. 타임스탬프로 원문을 확인하세요.
            </p>
            <div className="space-y-3 text-sm leading-relaxed text-slate-700">
              {meeting.summary.overview.split("\n\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-bold text-navy-900">안건</h2>
            <ol className="space-y-2">
              {meeting.summary.agenda.map((item, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => canSeek && seek(item.timestamp)}
                    disabled={!canSeek}
                    className={`w-full rounded-lg border border-slate-200 p-3 text-left transition ${
                      canSeek ? "hover:border-navy-300 hover:bg-navy-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy-100 text-xs font-bold text-navy-700">
                        {i + 1}
                      </span>
                      <span className="font-medium text-navy-900">{item.title}</span>
                      <span className="ml-auto font-mono text-xs text-slate-400">
                        ▶ {formatTime(item.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1.5 pl-8 text-sm text-slate-600">{item.summary}</p>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          {meeting.aiDataPolicy.length > 0 && (
            <section className="rounded-xl border-2 border-accent-500/30 bg-orange-50/50 p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-bold text-navy-900">
                🏷️ AI·데이터 정책 발언 <span className="text-accent-600">{meeting.aiDataPolicy.length}건</span>
              </h2>
              <div className="space-y-3">
                {meeting.aiDataPolicy.map((item, i) => {
                  const sp = speakers[item.speakerId] ?? UNKNOWN_SPEAKER;
                  return (
                    <div key={i} className="flex gap-3 rounded-lg bg-white p-3 shadow-sm">
                      <SpeakerAvatar speaker={sp} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{sp.name}</span>
                          <span className="text-xs text-slate-500">{item.topic}</span>
                          <button
                            type="button"
                            onClick={() => canSeek && seek(item.timestamp)}
                            className="ml-auto font-mono text-xs text-navy-500 hover:underline disabled:no-underline"
                            disabled={!canSeek}
                          >
                            ▶ {formatTime(item.timestamp)}
                          </button>
                        </div>
                        <p className="mt-1 text-sm text-slate-700">{item.summary}</p>
                        {item.quote && (
                          <p className="mt-1 border-l-2 border-accent-500 pl-2 text-sm italic text-slate-600">
                            “{item.quote}”
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {item.tags.map((t) => (
                            <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
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
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setTab("thread")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm transition ${
                tab === "thread" ? "bg-navy-800 font-medium text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              💬 발언 스레드
            </button>
            <button
              type="button"
              onClick={() => setTab("network")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm transition ${
                tab === "network" ? "bg-navy-800 font-medium text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              🕸️ 네트워크
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
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 flex items-center justify-between font-bold text-navy-900">
                📌 이 회의의 지시
                <Link href="/directives" className="text-xs font-normal text-navy-500 hover:underline">
                  전체 지시-이행 보기 →
                </Link>
              </h3>
              <div className="space-y-2">
                {meeting.directives.map((d) => {
                  const from = speakers[d.from] ?? UNKNOWN_SPEAKER;
                  const status = DIRECTIVE_STATUS_LABEL[d.status];
                  return (
                    <div key={d.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-navy-800">{from.name}</span>
                        <span className="text-slate-400">→</span>
                        {d.to.map((toId) => (
                          <span key={toId} className="text-slate-600">
                            {(speakers[toId] ?? UNKNOWN_SPEAKER).org || (speakers[toId] ?? UNKNOWN_SPEAKER).name}
                          </span>
                        ))}
                        <span className={`ml-auto rounded-full border px-2 py-0.5 ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{d.content}</p>
                      {canSeek ? (
                        <button
                          type="button"
                          onClick={() => seek(d.timestamp)}
                          className="mt-1 font-mono text-xs text-navy-500 hover:underline"
                        >
                          ▶ {formatTime(d.timestamp)}
                        </button>
                      ) : (
                        <span className="mt-1 font-mono text-xs text-slate-400">
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
            <p className="text-xs text-slate-400">
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
