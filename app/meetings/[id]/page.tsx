import { notFound } from "next/navigation";
import type { Metadata } from "next";
import MeetingDetail from "@/components/MeetingDetail";
import { buildNetwork, getMeeting, getMeetings, getSpeakers } from "@/lib/data";

export const dynamicParams = false;

export function generateStaticParams() {
  return getMeetings().map((m) => ({ id: m.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const meeting = getMeeting(id);
  return { title: meeting?.title ?? "회의" };
}

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meeting = getMeeting(id);
  if (!meeting) notFound();
  const speakers = getSpeakers();
  const network = buildNetwork(meeting.id);
  return <MeetingDetail meeting={meeting} speakers={speakers} network={network} />;
}
