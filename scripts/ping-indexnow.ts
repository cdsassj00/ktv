/**
 * IndexNow — 새 콘텐츠를 검색엔진(네이버·빙·Yandex 등)에 즉시 알린다.
 * 수동으로 "웹페이지 수집 요청"을 누를 필요 없이, 파이프라인이 회의를
 * 수집할 때마다 자동으로 URL을 통지한다.
 *
 * 단일 엔드포인트(api.indexnow.org)에 POST하면 참여 검색엔진에 공유된다.
 * 키 소유 증명은 사이트 루트의 <KEY>.txt 파일로 이뤄진다.
 */
import fs from "fs";
import { pathToFileURL } from "url";
import { log, MEETINGS_DIR } from "./lib";

const HOST = "opencabinet.cc";
const KEY = "0c930c47a19071eb9396cc5dfb1c6ec0";
const BASE = `https://${HOST}`;

/** 전달된 URL들(없으면 최근 회의 20건 + 핵심 페이지)을 IndexNow에 통지 */
export async function pingIndexNow(urls?: string[]): Promise<void> {
  let list = urls;
  if (!list || list.length === 0) {
    const core = ["/", "/meetings", "/directives", "/ai-policy", "/speakers"].map((p) => BASE + p);
    let meetingUrls: string[] = [];
    if (fs.existsSync(MEETINGS_DIR)) {
      meetingUrls = fs
        .readdirSync(MEETINGS_DIR)
        .filter((f) => f.endsWith(".json"))
        .map((f) => {
          try {
            const id = JSON.parse(fs.readFileSync(`${MEETINGS_DIR}/${f}`, "utf-8")).id as string;
            const date = f.slice(0, 10);
            return { date, url: `${BASE}/meetings/${id}` };
          } catch {
            return null;
          }
        })
        .filter((x): x is { date: string; url: string } => x !== null)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 20)
        .map((x) => x.url);
    }
    list = [...core, ...meetingUrls];
  }
  /* IndexNow는 1회 최대 10,000 URL — 여긴 넉넉 */
  const body = { host: HOST, key: KEY, keyLocation: `${BASE}/${KEY}.txt`, urlList: list };

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    // 200/202 = 접수. 그 외는 경고만 (수집 파이프라인을 실패시키지 않음)
    if (res.ok) log(`IndexNow 통지 완료: ${list.length}개 URL (${res.status})`);
    else log(`IndexNow 응답 ${res.status} — 다음 실행에서 재시도`);
  } catch (e) {
    log(`IndexNow 통지 실패(무시): ${(e as Error).message}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  pingIndexNow().catch((e) => {
    console.error(e);
    process.exit(0); // 보조 기능 — 실패해도 exit 0
  });
}
