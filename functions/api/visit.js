/**
 * 방문자 카운터 — Cloudflare Pages Function + KV.
 * GET /api/visit?count=1  → 오늘·누적 카운트 증가 후 반환 (브라우저가 하루 1회만 호출)
 * GET /api/visit          → 조회만
 *
 * KV 사용 절감(계정 전체 KV 무료한도 보호 — 특히 쓰기 1,000/일):
 *  - 상태를 단일 키("stats", JSON {total,day,date})에 담아 읽기 2→1, 쓰기 2→1로 줄인다.
 *  - 조회 전용 요청(대다수)은 엣지 캐시(최대 60초)로 응답해 KV 읽기를 추가로 없앤다.
 *  - 쓰기(put)는 하루 1회 count=1 요청에서만, waitUntil로 백그라운드 처리(응답 지연 없음).
 *
 * KV는 원자적 증가가 없어 동시 방문이 몰리면 약간 적게 셀 수 있다(전시용으로 충분).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const shouldCount = url.searchParams.get("count") === "1";

  // 조회 전용 경로를 위한 고정 캐시 키(쿼리스트링 제거로 count=0 요청을 한데 모은다)
  const cache = caches.default;
  const cacheKey = new Request(`${url.origin}/api/visit`, { method: "GET" });

  if (!shouldCount) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  /* 한국 시간 기준 날짜 */
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

  // 단일 키 조회(읽기 1회)
  let s = null;
  const raw = await env.VISITS.get("stats");
  if (raw) {
    try {
      s = JSON.parse(raw);
    } catch {
      s = null;
    }
  }
  // 최초 1회: 옛 스키마("total" 키)에서 누적값을 승계해 카운트가 리셋되지 않게 한다.
  if (!s) {
    const oldTotal = await env.VISITS.get("total");
    s = { total: parseInt(oldTotal ?? "0", 10) || 0, day: 0, date: "" };
  }

  let total = Number(s.total) || 0;
  let day = s.date === today ? Number(s.day) || 0 : 0; // 날짜 바뀌면 오늘치 리셋

  if (shouldCount) {
    total += 1;
    day += 1;
    // 쓰기 1회(단일 키), 응답을 막지 않도록 백그라운드로
    context.waitUntil(env.VISITS.put("stats", JSON.stringify({ total, day, date: today })));
  }

  const resp = new Response(JSON.stringify({ total, today: day }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // 조회 응답만 60초 엣지 캐시. 집계 응답은 캐시 금지(최신 수치 즉시 반영).
      "cache-control": shouldCount ? "no-store" : "public, max-age=60",
    },
  });

  if (!shouldCount) context.waitUntil(cache.put(cacheKey, resp.clone()));

  return resp;
}
