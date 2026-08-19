/**
 * KTV 유튜브 채널의 업로드 목록에서 국무회의·국민업무보고 영상을 수집해
 * data/videos-queue.json 에 저장한다.
 *
 * 수집 소스 4개를 합친다:
 *   1) KTV 공식 "국무회의" 재생목록 (PLAYLIST_ID, 기본 PLTlQMzTtp1gY) — 전 회차 아카이브
 *   2) 채널 최신 업로드 (제목 필터) — 재생목록에 아직 안 들어간 최신 회의/업무보고 커버
 *   3) 국무회의 "회차 번호 콕집기" — 보유한 최신 회차 다음 번호("제N회 국무회의")를
 *      번호로 정확히 지목해 검색한다. 퍼지 매칭이 아니라 그 회차 본편만 잡히므로
 *      클립 오수집 여지가 없고, 재생목록이 늦거나 쇼츠에 밀려도 다음 회차가
 *      올라오는 즉시 잡는다. 국무회의 최신 추적의 "주력" 경로.
 *   4) 키워드 검색(search.list) — 회차 번호가 없는 "업무보고", 그리고 콕집기의
 *      보조 안전망. 20분 이상 긴 영상만 채택한다.
 *
 * 그리고 큐를 "누적(대기 큐)"로 운영한다: 이번 실행에서 재발견되지 않아도,
 * 아직 수집(요약)되지 않은 회의는 큐에 남겨 다음 실행에서 자막을 재확인한다.
 * (예전엔 매 실행마다 큐를 통째로 덮어써서, 자막이 늦게 붙는 회의가 창 밖으로
 *  밀리면 영영 누락됐다 — 이 구조가 그 구멍을 막는다.)
 *
 * 필요 환경변수: YOUTUBE_API_KEY
 * 선택 환경변수: PLAYLIST_ID, CHANNEL_HANDLE(기본 KTV_korea), MAX_PAGES(기본 4),
 *   SINCE(YYYY-MM-DD), SEARCH_LOOKBACK_DAYS(검색 소급 일수, 기본 90),
 *   QUEUE_MAX_AGE_DAYS(대기 큐 최대 보관 일수, 기본 45),
 *   CABINET_PROBE_AHEAD(회차 콕집기 최대 선행 탐색 수, 기본 8),
 *   CABINET_PROBE_MISSES(연속 미발견 시 중단 임계, 기본 2)
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import {
  classifyTitle,
  DATA_DIR,
  existingMeetingKeys,
  existingVideoIds,
  latestCabinetNumber,
  log,
  looksLikeClip,
  MEETINGS_DIR,
  meetingKey,
  MeetingSource,
  parseIsoDuration,
  QUEUE_FILE,
  QueueItem,
  readJson,
  sourceChannels,
  verifyCabinetVideo,
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

type Candidate = {
  videoId: string;
  title: string;
  publishedAt: string;
  type: QueueItem["type"];
  channelTitle?: string;
};

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
        // 20분 이상 긴 영상만 — 국무회의·업무보고 본편은 모두 장시간이고,
        // 쇼츠·클립·브이로그는 짧아서 검색 단계에서 원천 배제된다. 덕분에
        // 짧은 영상에 밀려 안 보이던 제NN회 본편이 결과 상단에 드러난다.
        videoDuration: "long",
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

/**
 * 국무회의 "회차 번호 콕집기" (deterministic).
 * 우리가 보유한 최신 회차(highest) 다음 번호부터 "제N회 국무회의"를 번호로
 * 정확히 지목해 검색한다. 퍼지 매칭이 아니라 그 회차 본편만 잡히므로 클립·
 * 유사영상 오수집 여지가 없고, 재생목록이 늦거나 쇼츠에 밀려도 다음 회차가
 * 올라오는 즉시 잡는다. 아직 안 열린 번호는 결과가 없으므로, 연속 miss가
 * stopAfterMisses에 도달하면 "아직 미공개"로 보고 멈춘다(쿼터 절약).
 */
async function probeCabinetByNumber(
  channelId: string,
  highest: number,
  expectYear: number,
  aheadMax: number,
  stopAfterMisses: number
): Promise<Candidate[]> {
  const out: Candidate[] = [];
  let misses = 0;
  for (let n = highest + 1; n <= highest + aheadMax; n++) {
    const numRe = new RegExp(`제\\s*${n}\\s*회`);
    let hit = false;
    try {
      const res = await yt<{
        items?: { id: { videoId?: string }; snippet: { title: string; publishedAt: string } }[];
      }>("search", {
        part: "snippet",
        channelId,
        q: `제${n}회 국무회의`,
        type: "video",
        order: "date",
        videoDuration: "long", // 본편은 장시간 — 짧은 클립 원천 배제
        maxResults: "10",
      });
      for (const it of res.items ?? []) {
        const videoId = it.id.videoId;
        const title = it.snippet.title;
        if (!videoId) continue;
        // 정확히 그 회차(제N회) + 국무회의 + 클립 아님만 채택
        if (looksLikeClip(title) || !/국무회의/.test(title) || !numRe.test(title)) continue;
        // 번호는 매년 리셋되므로 현재 시리즈(당해 연도) 영상만 채택 — 이러면
        // 옛 연도의 같은 번호(예: 2025 제32회)를 다시 끌어오지 않고, 아래
        // "연속 miss 조기 종료"도 정상 작동한다.
        if (Number(it.snippet.publishedAt.slice(0, 4)) < expectYear) continue;
        out.push({ videoId, title, publishedAt: it.snippet.publishedAt, type: "cabinet" });
        hit = true;
      }
    } catch (e) {
      log(`회차검색(제${n}회) 실패(무시): ${(e as Error).message}`);
    }
    if (hit) {
      misses = 0;
      log(`회차검색 — 제${n}회 국무회의 발견`);
    } else if (++misses >= stopAfterMisses) {
      log(`회차검색 — 제${n}회부터 ${misses}연속 없음 → 아직 미공개로 보고 중단`);
      break;
    }
  }
  return out;
}

/**
 * 공식 allowlist 채널(비-KTV)에서 국무회의 회차 영상을 회차번호로 지목·검증해 수집한다.
 * 현재 시리즈의 회차대(latest-back .. latest+ahead)를 훑어, 연도+제N회 검증을 통과한
 * 영상만 채택한다. (작년 것/오라벨/클립은 verifyCabinetVideo가 자동 배제)
 * 반환: 검증된 후보들(각자 channelTitle 포함).
 */
async function probeChannelCabinet(
  channelId: string,
  channelTitle: string,
  fromNumber: number,
  toNumber: number,
  expectYear: number
): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (let n = Math.max(1, fromNumber); n <= toNumber; n++) {
    try {
      const res = await yt<{
        items?: { id: { videoId?: string }; snippet: { title: string; publishedAt: string } }[];
      }>("search", {
        part: "snippet",
        channelId,
        q: `제${n}회 국무회의`,
        type: "video",
        order: "date",
        videoDuration: "long",
        maxResults: "10",
      });
      for (const it of res.items ?? []) {
        const videoId = it.id.videoId;
        const title = it.snippet.title;
        if (!videoId) continue;
        if (!verifyCabinetVideo(title, n, expectYear, it.snippet.publishedAt)) continue;
        out.push({ videoId, title, publishedAt: it.snippet.publishedAt, type: "cabinet", channelTitle });
      }
    } catch (e) {
      log(`[${channelTitle}] 회차검색(제${n}회) 실패(무시): ${(e as Error).message}`);
    }
  }
  return out;
}

/** data/meetings 의 기존 회의 파일에 새로 찾은 '다른 공식 영상' 소스를 소급 추가한다.
 *  (이미 요약된 회의는 재요약하지 않으므로, 출처 링크만 채워 넣어 준다.) */
function backfillMeetingSources(altByKey: Map<string, MeetingSource[]>): number {
  if (altByKey.size === 0 || !fs.existsSync(MEETINGS_DIR)) return 0;
  let touched = 0;
  for (const f of fs.readdirSync(MEETINGS_DIR)) {
    if (!f.endsWith(".json")) continue;
    const file = path.join(MEETINGS_DIR, f);
    const m = readJson<{
      type?: string;
      title?: string;
      date?: string;
      videoId?: string;
      sources?: MeetingSource[];
    }>(file, {});
    if (!m.type || !m.title || !m.date) continue;
    const alts = altByKey.get(meetingKey(m.type, m.title, m.date));
    if (!alts || alts.length === 0) continue;
    const existing = new Set([m.videoId, ...(m.sources ?? []).map((s) => s.videoId)]);
    const add = alts.filter((s) => !existing.has(s.videoId));
    if (add.length === 0) continue;
    m.sources = [...(m.sources ?? []), ...add];
    writeJson(file, m);
    touched += 1;
    log(`기존 회의에 다른 공식 영상 소급 추가: ${m.title} (+${add.length})`);
  }
  return touched;
}

export async function fetchVideos(): Promise<QueueItem[]> {
  const handle = process.env.CHANNEL_HANDLE ?? "KTV_korea";
  const playlistId = process.env.PLAYLIST_ID ?? "PLTlQMzTtp1gY"; // KTV 공식 국무회의 재생목록
  const maxPages = Number(process.env.MAX_PAGES ?? 4);
  const since = process.env.SINCE; // 이 날짜 이전 영상은 무시
  const lookbackDays = Number(process.env.SEARCH_LOOKBACK_DAYS ?? 90);
  const queueMaxAgeDays = Number(process.env.QUEUE_MAX_AGE_DAYS ?? 45);
  const primaryTitle = sourceChannels().find((c) => c.primary)?.title ?? "KTV 국민방송";

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

  // 3) 국무회의 회차 번호 콕집기 — 현재 시리즈의 다음 회차를 번호로 정확히 지목
  if (channelId) {
    const latest = latestCabinetNumber(); // 연도 리셋 반영: 가장 최근 연도의 최대 회차
    if (latest.number > 0) {
      const aheadMax = Number(process.env.CABINET_PROBE_AHEAD ?? 8);
      const stopMisses = Number(process.env.CABINET_PROBE_MISSES ?? 2);
      for (const c of await probeCabinetByNumber(channelId, latest.number, latest.year, aheadMax, stopMisses))
        add(c);
      log(
        `회차 콕집기 후 신규 후보 총 ${candidates.length}건 ` +
          `(보유 최신 ${latest.year}년 제${latest.number}회 기준)`
      );
    }
  }

  // 4) 키워드 검색 — 회차 없는 업무보고, 그리고 회차 콕집기의 보조 안전망
  if (channelId) {
    const publishedAfter = new Date(Date.now() - lookbackDays * 86400_000).toISOString();
    for (const c of await searchChannelMeetings(channelId, publishedAfter)) add(c);
  }
  log(`검색 포함 신규 회의 영상 후보 총 ${candidates.length}건`);

  // 4.5) 수동 추가 영상 — KTV 채널 밖(다른 채널 재송출 등)에 있어 검색·업로드로는
  //      못 잡는 회의를 videoId로 직접 넣는다. data/extra-videos.json 형식:
  //      [{ "videoId": "...", "title": "제32회 국무회의", "type": "cabinet", "publishedAt": "2026-07-28" }]
  //      상세(길이·썸네일)는 아래 5)에서 videos.list로 채널 무관하게 채운다.
  const extras = readJson<
    { videoId: string; title: string; type: QueueItem["type"]; publishedAt: string }[]
  >(`${DATA_DIR}/extra-videos.json`, []);
  for (const e of extras) {
    if (!e.videoId || !e.title) continue;
    const publishedAt = /T/.test(e.publishedAt) ? e.publishedAt : `${e.publishedAt}T00:00:00Z`;
    add({ videoId: e.videoId, title: e.title, type: e.type ?? "cabinet", publishedAt });
  }
  if (extras.length) log(`수동 추가(extra-videos) 반영 후 후보 총 ${candidates.length}건`);

  // 4.7) 공식 다중 채널 보강 — KTV 외 allowlist 공식 채널(대통령실 등)에서 같은 회차를
  //      회차번호로 지목·검증해 (a) 같은 회의면 '다른 공식 영상'(alternate source)으로,
  //      (b) KTV에 없는 회차면 gap-fill 신규 회의로 추가한다. 연도+제N회 검증을 통과한
  //      영상만 채택하므로 작년 것/오라벨은 자동 배제된다.
  const altByKey = new Map<string, MeetingSource[]>();
  const officialChannels = sourceChannels().filter((c) => !c.primary && c.id);
  if (officialChannels.length) {
    const latest = latestCabinetNumber();
    if (latest.number > 0) {
      // 쿼터 절약: 공식 보강은 최근 회차 몇 개(alternate) + 앞 몇 개(gap-fill)만 훑는다.
      const back = Number(process.env.OFFICIAL_PROBE_BACK ?? 3);
      const ahead = Number(process.env.OFFICIAL_PROBE_AHEAD ?? 3);
      for (const ch of officialChannels) {
        const found = await probeChannelCabinet(
          ch.id,
          ch.title,
          latest.number - back,
          latest.number + ahead,
          latest.year
        );
        for (const c of found) {
          const key = meetingKey("cabinet", c.title, c.publishedAt.slice(0, 10));
          const owned = knownKeys.has(key) || seenKeys.has(key);
          if (owned) {
            // 이미 KTV(또는 이번 실행 후보)가 가진 회의 → 다른 공식 영상으로만 기록
            if (known.has(c.videoId) || candidates.some((x) => x.videoId === c.videoId)) continue;
            const list = altByKey.get(key) ?? [];
            if (!list.some((s) => s.videoId === c.videoId)) {
              list.push({
                videoId: c.videoId,
                title: c.title,
                channelTitle: c.channelTitle ?? ch.title,
                url: `https://youtu.be/${c.videoId}`,
              });
              altByKey.set(key, list);
            }
          } else {
            // KTV에 없는 회차 → 신규 회의로 보충(gap fill)
            add(c);
          }
        }
        log(`[${ch.title}] 보강 — 다른영상 ${[...altByKey.values()].reduce((n, v) => n + v.length, 0)}건 / gap-fill 포함 후보 총 ${candidates.length}건`);
      }
    }
  }

  // 5) 영상 상세(길이·썸네일) — 생중계 예고(길이 0) 및 진행 중 라이브 제외
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
      const key = meetingKey(c.type, c.title, c.publishedAt.slice(0, 10));
      const sources = altByKey.get(key);
      fresh.push({
        ...c,
        channelTitle: c.channelTitle ?? primaryTitle,
        duration,
        thumbnail: v.snippet.thumbnails?.high?.url ?? v.snippet.thumbnails?.medium?.url ?? "",
        ...(sources && sources.length ? { sources } : {}),
      });
    }
  }

  // 이미 요약된 기존 회의에는 재요약 없이 '다른 공식 영상' 링크만 소급 추가
  const backfilled = backfillMeetingSources(altByKey);
  if (backfilled) log(`기존 회의 ${backfilled}건에 다른 공식 영상 소급 반영`);

  // 6) 대기 큐 병합 — 아직 수집 안 된 기존 큐 항목을 유지한다.
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
