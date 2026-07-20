import Link from "next/link";
import type { Metadata } from "next";
import SpeakerAvatar from "@/components/SpeakerAvatar";
import { getSpeakers } from "@/lib/data";

export const metadata: Metadata = { title: "발언자" };

export default function SpeakersPage() {
  const speakers = getSpeakers();
  const entries = Object.entries(speakers);

  return (
    <div className="space-y-6">
      <header>
        <p className="kicker">Speakers</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-navy-900">발언자</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          국무회의·국민업무보고에 참석하는 국무위원 명부입니다. 사진은 공공누리 제1유형
          자료 확보 시 출처와 함께 표시되며, 그 전에는 이니셜 아바타로 표시됩니다.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map(([id, sp]) => (
          <Link
            key={id}
            href={`/speakers/${id}`}
            className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <SpeakerAvatar speaker={sp} size="xl" />
            <div>
              <p className="font-semibold text-navy-900">{sp.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{sp.role}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
