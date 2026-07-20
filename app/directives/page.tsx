import type { Metadata } from "next";
import DirectivesClient from "./DirectivesClient";
import BackLink from "@/components/BackLink";
import { getAllDirectives, getMeetings, getSpeakers } from "@/lib/data";

export const metadata: Metadata = { title: "지시-이행 트래커" };

export default function DirectivesPage() {
  const speakers = getSpeakers();
  const items = getAllDirectives().map(({ meeting, directive }) => ({
    meeting: { id: meeting.id, title: meeting.title, date: meeting.date, videoId: meeting.videoId },
    directive,
  }));
  const meetingIndex = Object.fromEntries(
    getMeetings().map((m) => [m.id, { title: m.title, date: m.date }])
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-10">
      <BackLink />
      <header>
        <p className="overline-label">Directive Tracker</p>
        <h1 className="h-judge mt-1">지시-이행 트래커</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-body">
          대통령·총리의 지시가 어느 부처에 내려졌고, 이후 회의에서 어떻게 후속 보고됐는지 회의를
          넘어 추적합니다. 자동 연결된 후속 보고는 <em>추정 연결</em>로 표시됩니다.
        </p>
      </header>
      <DirectivesClient items={items} speakers={speakers} meetingIndex={meetingIndex} />
    </div>
  );
}
