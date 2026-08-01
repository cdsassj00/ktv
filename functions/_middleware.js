/**
 * 호스트 정규화 — 옛 도메인(opencabinet.pages.dev)으로 들어온 요청을
 * 새 도메인(opencabinet.cc)의 같은 경로로 301 영구 리다이렉트한다.
 * 그 외 호스트(opencabinet.cc 등)는 그대로 통과시켜 무한 리다이렉트를 막는다.
 * — 옛 주소의 검색 색인·백링크 평판을 새 도메인으로 이관하기 위함.
 */
const CANONICAL_HOST = "opencabinet.cc";
const OLD_HOSTS = new Set(["opencabinet.pages.dev"]);

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (OLD_HOSTS.has(url.hostname)) {
    url.hostname = CANONICAL_HOST;
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
