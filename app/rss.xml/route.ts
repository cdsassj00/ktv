import { getMeetings } from "@/lib/data";
import { MEETING_TYPE_LABEL } from "@/lib/utils";

const BASE = "https://opencabinet.pages.dev";

/** 정적 RSS 2.0 피드 — 최신 회의 40건. 네이버·구글이 새 회의를 빠르게 수집한다. */
export const dynamic = "force-static";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const meetings = getMeetings().slice(0, 40);
  const items = meetings
    .map((m) => {
      const url = `${BASE}/meetings/${m.id}`;
      const label = MEETING_TYPE_LABEL[m.type] ?? "회의";
      const pubDate = new Date(`${m.date}T09:00:00+09:00`).toUTCString();
      return `    <item>
      <title>${esc(`[${label}] ${m.title}`)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${esc(m.summary.oneLine)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>열린국무회의 — 국무회의·국민업무보고 아카이브</title>
    <link>${BASE}</link>
    <description>대통령 주재 공개 국무회의·국민업무보고 영상을 AI로 요약해 발언 스레드·지시 이행·AI 데이터 정책을 보여주는 아카이브</description>
    <language>ko</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
