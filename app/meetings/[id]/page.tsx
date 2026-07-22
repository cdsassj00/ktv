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
  if (!meeting) return { title: "회의" };
  const desc = meeting.summary.oneLine;
  const ogImg = meeting.videoId
    ? `https://i.ytimg.com/vi/${meeting.videoId}/maxresdefault.jpg`
    : "/og.png";
  return {
    title: meeting.title,
    description: desc,
    alternates: { canonical: `/meetings/${id}` },
    openGraph: {
      type: "article",
      title: `${meeting.title} — 열린국무회의`,
      description: desc,
      url: `/meetings/${id}`,
      images: [{ url: ogImg }],
    },
  };
}

/** ISO 8601 duration (초 → PT#H#M#S) */
function isoDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s ? `${s}S` : ""}` || "PT0S";
}

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meeting = getMeeting(id);
  if (!meeting) notFound();
  const speakers = getSpeakers();
  const network = buildNetwork(meeting.id);

  /* 구조화 데이터 — 검색결과에 영상·날짜·요약이 리치 스니펫으로 노출 */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: meeting.title,
    description: meeting.summary.oneLine,
    uploadDate: meeting.date,
    thumbnailUrl: meeting.videoId
      ? `https://i.ytimg.com/vi/${meeting.videoId}/maxresdefault.jpg`
      : undefined,
    duration: meeting.duration ? isoDuration(meeting.duration) : undefined,
    contentUrl: meeting.videoId ? `https://youtu.be/${meeting.videoId}` : undefined,
    embedUrl: meeting.videoId ? `https://www.youtube.com/embed/${meeting.videoId}` : undefined,
    publisher: {
      "@type": "Organization",
      name: "열린국무회의 (CDSA)",
      url: "https://opencabinet.pages.dev",
    },
    inLanguage: "ko",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MeetingDetail meeting={meeting} speakers={speakers} network={network} />
    </>
  );
}
