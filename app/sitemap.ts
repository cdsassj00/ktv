import type { MetadataRoute } from "next";
import { getMeetings, getSpeakers } from "@/lib/data";

const BASE = "https://opencabinet.pages.dev";

/** 정적 사이트맵 — 정적 페이지 + 전체 회의·발언자 상세를 포함한다. */
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const meetings = getMeetings();
  const speakers = getSpeakers();
  const latest = meetings[0]?.date ?? "2026-01-01";

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: latest, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/meetings`, lastModified: latest, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/directives`, lastModified: latest, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/ai-policy`, lastModified: latest, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/network`, lastModified: latest, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/speakers`, lastModified: latest, changeFrequency: "monthly", priority: 0.6 },
  ];

  const meetingPages: MetadataRoute.Sitemap = meetings.map((m) => ({
    url: `${BASE}/meetings/${m.id}`,
    lastModified: m.date,
    changeFrequency: "yearly",
    priority: 0.7,
  }));

  const speakerPages: MetadataRoute.Sitemap = Object.keys(speakers).map((id) => ({
    url: `${BASE}/speakers/${id}`,
    lastModified: latest,
    changeFrequency: "monthly",
    priority: 0.4,
  }));

  return [...staticPages, ...meetingPages, ...speakerPages];
}
