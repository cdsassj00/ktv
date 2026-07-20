"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SpeakerAvatar from "@/components/SpeakerAvatar";
import Reveal from "@/components/Reveal";
import { UNKNOWN_SPEAKER } from "@/lib/client-data";
import type { AiDataPolicyItem, SpeakerMap } from "@/lib/types";
import { formatDate, formatTime, youtubeUrlAt } from "@/lib/utils";

export interface AiPolicyEntry {
  meeting: { id: string; title: string; date: string; videoId: string };
  item: AiDataPolicyItem;
}

/** 월별 언급 추이 — 인라인 SVG 바 차트 */
function TrendChart({ data }: { data: { month: string; count: number }[] }) {
  if (data.length === 0) return null;
  const W = 640;
  const H = 160;
  const pad = { top: 16, bottom: 28, left: 8, right: 8 };
  const max = Math.max(...data.map((d) => d.count), 1);
  const bw = (W - pad.left - pad.right) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="월별 AI·데이터 언급 추이">
      {data.map((d, i) => {
        const h = ((H - pad.top - pad.bottom) * d.count) / max;
        const x = pad.left + i * bw;
        const y = H - pad.bottom - h;
        return (
          <g key={d.month}>
            <rect x={x + bw * 0.2} y={y} width={bw * 0.6} height={h} rx={4} fill="#0a84ff" />
            <text x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize="12" fontWeight="600" fill="#f5f5f7">
              {d.count}
            </text>
            <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="#98989d">
              {d.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function AiPolicyClient({
  entries,
  speakers,
  monthly,
}: {
  entries: AiPolicyEntry[];
  speakers: SpeakerMap;
  monthly: { month: string; count: number }[];
}) {
  const [tag, setTag] = useState<string | null>(null);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { item } of entries)
      for (const t of item.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].map(([t, c]) => ({ tag: t, count: c })).sort((a, b) => b.count - a.count);
  }, [entries]);

  const items = tag ? entries.filter(({ item }) => item.tags.includes(tag)) : entries;

  const pill = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
      active ? "border-transparent bg-ink text-paper" : "border-transparent bg-surf text-mut hover:text-ink"
    }`;

  return (
    <>
      <section className="panel p-5">
        <h2 className="mb-2 text-sm font-black text-ink">월별 언급 추이</h2>
        <TrendChart data={monthly} />
      </section>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setTag(null)} className={pill(!tag)}>
          전체 ({entries.length})
        </button>
        {tags.map((t) => (
          <button key={t.tag} type="button" onClick={() => setTag(t.tag)} className={pill(tag === t.tag)}>
            #{t.tag} ({t.count})
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="panel p-8 text-center text-mut">해당 태그의 발언이 없습니다.</p>
      ) : (
        <Reveal stagger className="space-y-3">
          {items.map(({ meeting, item }, i) => {
            const sp = speakers[item.speakerId] ?? UNKNOWN_SPEAKER;
            return (
              <div key={`${meeting.id}-${i}`} className="panel flex gap-3 p-4">
                <Link href={`/speakers/${item.speakerId}`}>
                  <SpeakerAvatar speaker={sp} size="lg" />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/speakers/${item.speakerId}`} className="font-semibold text-ink hover:underline">
                      {sp.name}
                    </Link>
                    <span className="text-xs text-mut">{sp.role}</span>
                    <span className="rounded bg-tint2 px-1.5 py-0.5 text-xs text-body">{item.topic}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-body">{item.summary}</p>
                  {item.quote && (
                    <p className="mt-1.5 border-l-2 border-accent-400 pl-2 text-sm italic text-mut">
                      “{item.quote}”
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mut">
                    <Link href={`/meetings/${meeting.id}`} className="text-accent-400 hover:underline">
                      {formatDate(meeting.date)} · {meeting.title}
                    </Link>
                    {meeting.videoId ? (
                      <a
                        href={youtubeUrlAt(meeting.videoId, item.timestamp)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono hover:underline"
                      >
                        ▶ {formatTime(item.timestamp)}
                      </a>
                    ) : (
                      <span className="font-mono">▶ {formatTime(item.timestamp)}</span>
                    )}
                    {item.tags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTag(t)}
                        className="rounded-full bg-tint2 px-2 py-0.5 hover:bg-hair2"
                      >
                        #{t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </Reveal>
      )}
    </>
  );
}
