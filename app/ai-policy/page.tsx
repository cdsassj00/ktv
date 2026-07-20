import Link from "next/link";
import type { Metadata } from "next";
import SpeakerAvatar from "@/components/SpeakerAvatar";
import Reveal from "@/components/Reveal";
import {
  getAiDataPolicyTags,
  getAllAiDataPolicy,
  getMonthlyAiDataCounts,
  getSpeakers,
  UNKNOWN_SPEAKER,
} from "@/lib/data";
import { formatDate, formatTime, youtubeUrlAt } from "@/lib/utils";

export const metadata: Metadata = { title: "AI·데이터 정책 대시보드" };

/** 월별 언급 추이 — 의존성 없는 인라인 SVG 바 차트 */
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
            <rect x={x + bw * 0.2} y={y} width={bw * 0.6} height={h} rx={4} fill="#4266a3" />
            <text x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize="12" fontWeight="600" fill="#102139">
              {d.count}
            </text>
            <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="#68758a">
              {d.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default async function AiPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>;
}) {
  const { tag } = await searchParams;
  const speakers = getSpeakers();
  const all = getAllAiDataPolicy();
  const tags = getAiDataPolicyTags();
  const monthly = getMonthlyAiDataCounts();
  const items = tag ? all.filter(({ item }) => item.tags.includes(tag)) : all;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-10">
      <header>
        <p className="overline-label">AI &amp; Data Policy</p>
        <h1 className="h-judge mt-1">AI·데이터 정책 대시보드</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-body">
          모든 회의에서 추출한 AI·데이터 정책 관련 발언을 모아봅니다. 각 발언의 타임스탬프로
          원문 영상을 바로 확인할 수 있습니다.
        </p>
      </header>

      <section className="panel p-5">
        <h2 className="mb-2 text-sm font-black text-ink">월별 언급 추이</h2>
        <TrendChart data={monthly} />
      </section>

      <div className="flex flex-wrap gap-1.5">
        <Link
          href="/ai-policy"
          className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
            !tag ? "border-transparent bg-ink text-paper" : "border-transparent bg-surf text-mut hover:text-ink"
          }`}
        >
          전체 ({all.length})
        </Link>
        {tags.map((t) => (
          <Link
            key={t.tag}
            href={`/ai-policy?tag=${encodeURIComponent(t.tag)}`}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
              tag === t.tag ? "border-transparent bg-ink text-paper" : "border-transparent bg-surf text-mut hover:text-ink"
            }`}
          >
            #{t.tag} ({t.count})
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="panel p-8 text-center text-mut">
          해당 태그의 발언이 없습니다.
        </p>
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
                    <span className="rounded bg-navy-100 px-1.5 py-0.5 text-xs text-body">{item.topic}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-body">{item.summary}</p>
                  {item.quote && (
                    <p className="mt-1.5 border-l-2 border-accent-500 pl-2 text-sm italic text-body">
                      “{item.quote}”
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mut">
                    <Link href={`/meetings/${meeting.id}`} className="text-body hover:underline">
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
                      <Link key={t} href={`/ai-policy?tag=${encodeURIComponent(t)}`} className="rounded-full bg-tint2 px-2 py-0.5 hover:bg-hair2">
                        #{t}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </Reveal>
      )}
    </div>
  );
}
