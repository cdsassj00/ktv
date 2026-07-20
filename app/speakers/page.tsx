import Link from "next/link";
import type { Metadata } from "next";
import SpeakerAvatar from "@/components/SpeakerAvatar";
import Reveal from "@/components/Reveal";
import { getSpeakers } from "@/lib/data";

export const metadata: Metadata = { title: "발언자" };

export default function SpeakersPage() {
  const speakers = getSpeakers();
  const entries = Object.entries(speakers);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-10">
      <header>
        <p className="overline-label">Speakers</p>
        <h1 className="h-judge mt-1">발언자</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          국무회의·국민업무보고에 참석하는 국무위원 명부입니다. 사진은 공공누리 제1유형
          자료 확보 시 출처와 함께 표시되며, 그 전에는 이니셜 아바타로 표시됩니다.
        </p>
      </header>

      <Reveal stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map(([id, sp]) => (
          <Link
            key={id}
            href={`/speakers/${id}`}
            className="flex flex-col items-center gap-2 panel p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lift"
          >
            <SpeakerAvatar speaker={sp} size="xl" />
            <div>
              <p className="font-extrabold text-ink">{sp.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{sp.role}</p>
            </div>
          </Link>
        ))}
      </Reveal>
    </div>
  );
}
