/**
 * KTV 유튜브 채널의 업로드 목록에서 국무회의·국민업무보고 영상을 수집해
 * data/videos-queue.json 에 저장한다.
 *
 * 쿼터 절약을 위해 search.list(100 unit) 대신
 * channels.list(1) + playlistItems.list(1/50개) + videos.list(1/50개)만 사용한다.
 *
 * 필요 환경변수: YOUTUBE_API_KEY
 * 선택 환경변수: CHANNEL_HANDLE(기본 KTV_korea), MAX_PAGES(기본 4), SINCE(YYYY-MM-DD)
 */
import { pathToFileURL } from "url";
import {
  classifyTitle,
  existingVideoIds,
  log,
  parseIsoDuration,
  QUEUE_FILE,
  QueueItem,
  writeJson,
} from "./lib";

const API = "https://www.googleapis.com/youtube/v3";

async function yt<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY 환경변수가 필요합니다.");
  const qs = new URLSearchParams({ ...params, key });
  const res = await fetch(`${API}/${endpoint}?${qs}`);
  if (!res.ok) throw new Error(`YouTube API ${endpoint} 실패 (${res.status}): ${await res.text()}`);
  return (await res.json()) as T;
}

export async function fetchVideos(): Promise<QueueItem[]> {
  const handle = process.env.CHANNEL_HANDLE ?? "KTV_korea";
  const maxPages = Number(process.env.MAX_PAGES ?? 4);
  const since = process.env.SINCE; // 이 날짜 이전 영상은 무시

  // 1) 채널 → uploads 재생목록 ID
  const channels = await yt<{
    items?: { contentDetails: { relatedPlaylists: { uploads: string } } }[];
  }>("channels", { part: "contentDetails", forHandle: handle });
  const uploads = channels.items?.[0]?.contentDetails.relatedPlaylists.uploads;
  if (!uploads) throw new Error(`채널을 찾을 수 없음: @${handle}`);
  log(`채널 @${handle} uploads 재생목록: ${uploads}`);

  // 2) 최신 업로드 순회 + 제목 필터
  const known = existingVideoIds();
  const candidates: { videoId: string; title: string; publishedAt: string; type: QueueItem["type"] }[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const res = await yt<{
      items: { snippet: { title: string; publishedAt: string; resourceId: { videoId: string } } }[];
      nextPageToken?: string;
    }>("playlistItems", {
      part: "snippet",
      playlistId: uploads,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    for (const item of res.items) {
      const { title, publishedAt, resourceId } = item.snippet;
      if (since && publishedAt.slice(0, 10) < since) continue;
      const type = classifyTitle(title);
      if (!type || type === "other") continue;
      if (known.has(resourceId.videoId)) continue;
      candidates.push({ videoId: resourceId.videoId, title, publishedAt, type });
    }
    pageToken = res.nextPageToken;
    if (!pageToken) break;
  }
  log(`신규 회의 영상 후보 ${candidates.length}건`);

  // 3) 영상 상세(길이·썸네일) — 생중계 예고(길이 0) 및 진행 중 라이브 제외
  const queue: QueueItem[] = [];
  for (let i = 0; i < candidates.length; i += 50) {
    const batch = candidates.slice(i, i + 50);
    const res = await yt<{
      items: {
        id: string;
        contentDetails: { duration: string };
        snippet: { thumbnails?: { high?: { url: string }; medium?: { url: string } } };
        liveStreamingDetails?: { actualEndTime?: string; actualStartTime?: string };
      }[];
    }>("videos", {
      part: "contentDetails,snippet,liveStreamingDetails",
      id: batch.map((c) => c.videoId).join(","),
    });
    for (const v of res.items) {
      const c = batch.find((b) => b.videoId === v.id)!;
      const duration = parseIsoDuration(v.contentDetails.duration);
      const live = v.liveStreamingDetails;
      if (live && live.actualStartTime && !live.actualEndTime) {
        log(`라이브 진행 중 — 건너뜀: ${c.title}`);
        continue;
      }
      if (duration < 300) {
        log(`5분 미만(예고편 추정) — 건너뜀: ${c.title}`);
        continue;
      }
      queue.push({
        ...c,
        duration,
        thumbnail: v.snippet.thumbnails?.high?.url ?? v.snippet.thumbnails?.medium?.url ?? "",
      });
    }
  }

  queue.sort((a, b) => (a.publishedAt < b.publishedAt ? -1 : 1));
  writeJson(QUEUE_FILE, queue);
  log(`큐 저장: ${QUEUE_FILE} (${queue.length}건)`);
  return queue;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  fetchVideos().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
