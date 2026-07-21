import type { Metadata } from "next";
import AiPolicyClient from "./AiPolicyClient";
import BackLink from "@/components/BackLink";
import { getAllAiDataPolicy, getMonthlyAiDataCounts, getSpeakers } from "@/lib/data";

export const metadata: Metadata = { title: "AI·데이터 정책 대시보드" };

export default function AiPolicyPage() {
  const speakers = getSpeakers();
  const entries = getAllAiDataPolicy().map(({ meeting, item }) => ({
    meeting: { id: meeting.id, title: meeting.title, date: meeting.date, videoId: meeting.videoId },
    item,
  }));
  const monthly = getMonthlyAiDataCounts();

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-10">
      <BackLink />
      <header>
        <p className="overline-label">AI &amp; Data Policy</p>
        <h1 className="h-judge mt-1">AI·데이터 정책 대시보드</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-body">
          모든 회의에서 추출한 AI·데이터 정책 관련 발언을 모아봅니다. 각 발언의 타임스탬프로 원문
          영상을 바로 확인할 수 있습니다.
        </p>
      </header>
      <AiPolicyClient entries={entries} speakers={speakers} monthly={monthly} />
    </div>
  );
}
