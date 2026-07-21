/**
 * 방문자 카운터 — Cloudflare Pages Function + KV.
 * GET /api/visit?count=1  → 오늘·누적 카운트 증가 후 반환 (브라우저가 하루 1회만 호출)
 * GET /api/visit          → 조회만
 * KV는 원자적 증가가 없어 동시 방문이 몰리면 약간 적게 셀 수 있다(전시용으로 충분).
 */
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const shouldCount = url.searchParams.get("count") === "1";
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
    await Promise.all([
      env.VISITS.put("total", String(total)),
      env.VISITS.put(dayKey, String(day), { expirationTtl: 60 * 60 * 24 * 3 }),
    ]);
  }

  return new Response(JSON.stringify({ total, today: day }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
