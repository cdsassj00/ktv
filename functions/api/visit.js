/**
 * 방문자 카운터 — Cloudflare Pages Function + KV.
 * GET /api/visit?count=1  → 오늘·누적 카운트 증가 후 반환 (브라우저가 하루 1회만 호출)
 * GET /api/visit          → 조회만
 *
 * KV 사용 절감(계정 전체 KV 무료한도 보호):
 *  - 조회 전용 요청(대다수)은 엣지 캐시(최대 60초)로 응답해, 60초 창 안의 반복 방문은
 *    KV를 전혀 건드리지 않는다. 트래픽이 몰릴수록 KV 읽기가 급감한다.
 *  - 쓰기(put)는 브라우저가 하루 1회만 보내는 count=1 요청에서만, 응답을 막지 않도록
 *    waitUntil로 백그라운드 처리한다.
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

  // 조회 요청은 엣지 캐시가 있으면 KV 없이 즉시 응답
  if (!shouldCount) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  /* 한국 시간 기준 날짜 키 */
  const today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const dayKey = `day:${today}`;

  const [totalRaw, dayRaw] = await Promise.all([
    env.VISITS.get("total"),
    env.VISITS.get(dayKey),
  ]);
  let total = parseInt(totalRaw ?? "0", 10) || 0;
  let day = parseInt(dayRaw ?? "0", 10) || 0;

  if (shouldCount) {
    total += 1;
    day += 1;
    // 쓰기는 응답을 지연시키지 않도록 백그라운드로
    context.waitUntil(
      Promise.all([
        env.VISITS.put("total", String(total)),
        env.VISITS.put(dayKey, String(day), { expirationTtl: 60 * 60 * 24 * 3 }),
      ])
    );
  }

  const resp = new Response(JSON.stringify({ total, today: day }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // 조회 응답만 60초 엣지 캐시 → 이후 방문은 KV를 안 건드린다. 집계 응답은 캐시 금지.
      "cache-control": shouldCount ? "no-store" : "public, max-age=60",
    },
  });

  // 조회 응답을 엣지에 저장(집계 요청은 저장하지 않아 최신 수치가 곧 반영됨)
  if (!shouldCount) context.waitUntil(cache.put(cacheKey, resp.clone()));

  return resp;
}
