/**
 * 발언자 사진 자동 수색 — 파이프라인(크론)에서 매회 실행된다.
 *
 * 사진이 없는 "실명" 발언자에 대해 한국어 위키백과 문서의 대표 이미지를 찾되,
 * 오귀속(동명이인) 방지를 위해 문서 서두에 그 인물의 직책·소속 키워드가
 * 있을 때만 채택한다. 직책만 등록된 항목(titleOnly)은 건드리지 않는다.
 * 위키 문서에 나중에 사진이 올라오면 다음 크론에서 자동으로 채워진다.
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { DATA_DIR, log } from "./lib";

const SPEAKERS_PATH = path.join(DATA_DIR, "speakers.json");
const UA = "OpenCabinet/1.0 (https://opencabinet.pages.dev; archive project)";

interface Speaker {
  name: string;
  role: string;
  org?: string;
  photo?: string | null;
  photoSource?: string | null;
  titleOnly?: boolean;
  [k: string]: unknown;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function wikiQuery(title: string): Promise<{ extract: string; image: string | null } | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    redirects: "1",
    titles: title,
    prop: "extracts|pageimages",
    exintro: "1",
    explaintext: "1",
    exchars: "600",
    piprop: "name",
  });
  const res = await fetch(`https://ko.wikipedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`wiki API ${res.status}`);
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { missing?: string; extract?: string; pageimage?: string }> };
  };
  const page = Object.values(data.query?.pages ?? {})[0];
  if (!page || "missing" in page) return null;
  return { extract: page.extract ?? "", image: page.pageimage ?? null };
}

/** 직책·소속에서 검증용 키워드 추출 (4자 이상 — '장관' 같은 범용어 제외) */
function verifyKeywords(sp: Speaker): string[] {
  const tokens = `${sp.role} ${sp.org ?? ""}`
    .split(/[\s·(),/]+/)
    .filter((t) => t.length >= 4);
  return tokens.length > 0 ? tokens : [sp.role];
}

export async function findPhotos(): Promise<void> {
  const speakers: Record<string, Speaker> = JSON.parse(fs.readFileSync(SPEAKERS_PATH, "utf-8"));
  let found = 0;
  let checked = 0;

  for (const [id, sp] of Object.entries(speakers)) {
    if (sp.photo || sp.titleOnly) continue;
    checked += 1;
    try {
      const page = await wikiQuery(sp.name);
      if (!page || !page.image) {
        log(`사진 수색: ${sp.name} — 문서/이미지 없음`);
      } else {
        const extract = page.extract.replace(/\n/g, " ");
        const hit = verifyKeywords(sp).some((k) => extract.includes(k));
        if (!hit) {
          log(`사진 수색: ${sp.name} — 직책 불일치로 보류 (동명이인 방지)`);
        } else {
          const file = page.image.replace(/ /g, "_");
          speakers[id].photo =
            `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=400`;
          speakers[id].photoSource = `위키미디어 공용 (${page.image})`;
          found += 1;
          log(`사진 수색: ${sp.name} ← ${page.image}`);
        }
      }
    } catch (e) {
      log(`사진 수색: ${sp.name} — 오류(다음 실행에서 재시도): ${e}`);
    }
    await sleep(3000); // 위키미디어 API 예의
  }

  if (found > 0) {
    fs.writeFileSync(SPEAKERS_PATH, JSON.stringify(speakers, null, 2), "utf-8");
  }
  log(`사진 수색 완료: 대상 ${checked}명 중 ${found}명 확보`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  findPhotos().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
