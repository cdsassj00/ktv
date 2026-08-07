/**
 * KTV 유튜브 채널의 업로드 목록에서 국무회의·국민업무보고 영상을 수집해
 * data/videos-queue.json 에 저장한다.
 *
 * 수집 소스 3개를 합친다:
 *   1) KTV 공식 "국무회의" 재생목록 (PLAYLIST_ID, 기본 PLTlQMzTtp1gY) — 전 회차 아카이브
 *   2) 채널 최신 업로드 (제목 필터) — 재생목록에 아직 안 들어간 최신 회의/업무보고 커버
 *   3) 키워드 검색(search.list) — "국무회의"·"업무보고"를 채널 안에서 직접 검색.
 *      재생목록 갱신이 늦거나(현재도 몇 주 밀림), 회의 영상이 쇼츠에 밀려
 *      최신 업로드 창(수백 개) 밖으로 빠져도 끝까지 찾아낸다.
 *
 * 그리고 큐를 "누적(대기 큐)"로 운영한다: 이번 실행에서 재발견되지 않아도,
 * 아직 수집(요약)되지 않은 회의는 큐에 남겨 다음 실행에서 자막을 재확인한다.
 * (예전엔 매 실행마다 큐를 통째로 덮어써서, 자막이 늦게 붙는 회의가 창 밖으로
 *  밀리면 영영 누락됐다 — 이 구조가 그 구멍을 막는다.)
 *
 * 필요 환경변수: YOUTUBE_API_KEY
 * 선택 환경변수: PLAYLIST_ID, CHANNEL_HANDLE(기본 KTV_korea), MAX_PAGES(기본 4),
 *   SINCE(YYYY-MM-DD), SEARCH_LOOKBACK_DAYS(검색 소급 일수, 기본 90),
 *   QUEUE_MAX_AGE_DAYS(대기 큐 최대 보관 일수, 기본 45)
 */
import { pathToFileURL } from "url";
import {
  classifyTitle,
  existingMeetingKeys,
  existingVideoIds,
  log,
  looksLikeClip,
  meetingKey,
  parseIsoDuration,
  QUEUE_FILE,
  QueueItem,
  readJson,
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

type Candidate = { videoId: string; title: string; publishedAt: string; type: QueueItem["type"] };

/** 재생목록의 모든 항목을 페이지네이션으로 순회 */
async function listPlaylist(playlistId: string, maxPages: number) {
  const items: { videoId: string; title: string; publishedAt: string }[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const res = await yt<{
      items: { snippet: { title: string; publishedAt: string; resourceId: { videoId: string } } }[];
      nextPageToken?: string;
    }>("playlistItems", {
      part: "snippet",
      playlistId,
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    for (const item of res.items) {
      items.push({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
      });
    }
    pageToken = res.nextPageToken;
    if (!pageToken) break;
  }
  return items;
}

/**
 * 채널 안에서 키워드로 회의 영상 검색 (search.list, 100 unit/요청).
 * 재생목록·업로드 창을 못 믿을 때의 안전망. 쇼츠·클립 오수집을 막기 위해
 * 국무회의는 "제NN회"가 제목에 있어야만 채택한다.
 */
async function searchChannelMeetings(
  channelId: string,
  publishedAfterISO: string
): Promise<Candidate[]> {
  const queries: { q: string; want: QueueItem["type"]; ok: (t: string) => boolean }[] = [
    { q: "국무회의", want: "cabinet", ok: (t) => !looksLikeClip(t) && /국무회의/.test(t) && /제\s*\d+\s*회/.test(t) },
    { q: "업무보고", want: "briefing", ok: (t) => !looksLikeClip(t) && /업무보고/.test(t) },
  ];
  const out: Candidate[] = [];
  for (const { q, want, ok } of queries) {
    try {
      const res = await yt<{
        items?: {
          id: { videoId?: string };
          snippet: { title: string; publishedAt: string };
        }[];
      }>("search", {
        part: "snippet",
        channelId,
        q,
        type: "video",
        order: "date",
        maxResults: "25",
        publishedAfter: publishedAfterISO,
      });
      for (const it of res.items ?? []) {
        const videoId = it.id.videoId;
        if (!videoId) continue;
        if (!ok(it.snippet.title)) continue;
        out.push({ videoId, title: it.snippet.title, publishedAt: it.snippet.publishedAt, type: want });
      }
      log(`검색("${q}") — 회의성 후보 ${out.filter((c) => c.type === want).length}건`);
    } catch (e) {
      // 검색은 안전망 — 실패(쿼터 등)해도 나머지 소스로 계속
      log(`검색("${q}") 실패(무시): ${(e as Error).message}`);
    }
  }
  return out;
}

export async function fetchVideos(): Promise<QueueItem[]> {
  const handle = process.env.CHANNEL_HANDLE ?? "KTV_korea";
  const playlistId = process.env.PLAYLIST_ID ?? "PLTlQMzTtp1gY"; // KTV 공식 국무회의 재생목록
  const maxPages = Number(process.env.MAX_PAGES ?? 4);
  const since = process.env.SINCE; // 이 날짜 이전 영상은 무시
  const lookbackDays = Number(process.env.SEARCH_LOOKBACK_DAYS ?? 90);
  const queueMaxAgeDays = Number(process.env.QUEUE_MAX_AGE_DAYS ?? 45);

  const known = existingVideoIds();
  const knownKeys = existingMeetingKeys(); // 수정본 재업로드(다른 videoId) 중복 방지
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const seenKeys = new Set<string>();
  const add = (c: Candidate) => {
    if (since && c.publishedAt.slice(0, 10) < since) return;
    if (known.has(c.videoId) || seen.has(c.videoId)) return;
    const key = meetingKey(c.type, c.title, c.publishedAt.slice(0, 10));
    if (knownKeys.has(key) || seenKeys.has(key)) {
      log(`중복 회의(수정본 추정) — 건너뜀: ${c.title}`);
      return;
    }
    seen.add(c.videoId);
    seenKeys.add(key);
    candidates.push(c);
  };

  // 1) 공식 국무회의 재생목록 전체 — 전부 cabinet으로 분류(클립성 제외)
  for (const item of await listPlaylist(playlistId, maxPages)) {
    if (looksLikeClip(item.title)) continue;
    add({ ...item, type: "cabinet" });
  }
  log(`재생목록(${playlistId})에서 신규 ${candidates.length}건`);

  // 채널 메타(업로드 재생목록 + 채널ID) 조회
  const channels = await yt<{
    items?: { id: string; contentDetails: { relatedPlaylists: { uploads: string } } }[];
  }>("channels", { part: "contentDetails,id", forHandle: handle });
  const channel = channels.items?.[0];
  const uploads = channel?.contentDetails.relatedPlaylists.uploads;
  const channelId = channel?.id;

  // 2) 채널 최신 업로드 — 재생목록에 아직 없는 최신 회의·업무보고 커버
  if (uploads) {
    for (const item of await listPlaylist(uploads, 3)) {
      const type = classifyTitle(item.title);
      if (!type || type === "other") continue;
      add({ ...item, type });
    }
  }
  log(`업로드 포함 후보 총 ${candidates.length}건`);

  // 3) 키워드 검색 — 재생목록/업로드 창을 벗어난 최근 회의까지 추격
  if (channelId) {
    const publishedAfter = new Date(Date.now() - lookbackDays * 86400_000).toISOString();
    for (const c of await searchChannelMeetings(channelId, publishedAfter)) add(c);
  }
  log(`검색 포함 신규 회의 영상 후보 총 ${candidates.length}건`);

  // 4) 영상 상세(길이·썸네일) — 생중계 예고(길이 0) 및 진행 중 라이브 제외
  const fresh: QueueItem[] = [];
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
      fresh.push({
        ...c,
        duration,
        thumbnail: v.snippet.thumbnails?.high?.url ?? v.snippet.thumbnails?.medium?.url ?? "",
      });
    }
  }

  // 5) 대기 큐 병합 — 아직 수집 안 된 기존 큐 항목을 유지한다.
  //    이번 실행에서 재발견 못 해도(창 밖으로 밀려도) 자막 대기 중이면 남긴다.
  //    단, 이미 수집됐거나 너무 오래된(자막이 끝내 안 붙은) 항목은 정리한다.
  const ageCutoff = new Date(Date.now() - queueMaxAgeDays * 86400_000).toISOString().slice(0, 10);
  const prev = readJson<QueueItem[]>(QUEUE_FILE, []);
  const merged: QueueItem[] = [...fresh];
  const freshIds = new Set(fresh.map((q) => q.videoId));
  let carried = 0;
  let dropped = 0;
  for (const item of prev) {
    if (freshIds.has(item.videoId) || known.has(item.videoId)) continue; // 중복/이미수집 제외
    if ((item.publishedAt?.slice(0, 10) ?? "") < ageCutoff) {
      dropped += 1; // 오래도록 자막이 안 붙은 항목은 대기 큐에서 정리
      continue;
    }
    merged.push(item);
    carried += 1;
  }

  merged.sort((a, b) => (a.publishedAt < b.publishedAt ? -1 : 1));
  writeJson(QUEUE_FILE, merged);
  log(
    `큐 저장: ${QUEUE_FILE} (신규 ${fresh.length} + 대기 유지 ${carried}` +
      `${dropped ? `, 만료 정리 ${dropped}` : ""} = 총 ${merged.length}건)`
  );
  return merged;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  fetchVideos().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
