/**
 * 수집·요약 결과를 Cloudflare R2 버킷에 아카이브한다.
 *
 * - data/meetings/*.json, data/speakers.json  → 사이트 빌드용 원본(git에도 커밋됨)의 미러
 * - data/transcripts/*.json                   → git에는 커밋하지 않는 대용량 자막의 영구 보관소
 *
 * R2의 S3 API 대신 Cloudflare REST API(Bearer 토큰)를 사용해 서명 라이브러리 의존성을 없앴다.
 *
 * 필요 환경변수:
 *   CLOUDFLARE_ACCOUNT_ID  — Cloudflare 대시보드 우측(또는 R2 페이지)에서 확인
 *   CLOUDFLARE_API_TOKEN   — "R2 편집(Object Read & Write)" 권한 토큰
 * 선택: R2_BUCKET (기본 opencabinet-data)
 */
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { DATA_DIR, log, MEETINGS_DIR, TRANSCRIPTS_DIR } from "./lib";

const BUCKET = process.env.R2_BUCKET ?? "opencabinet-data";

function apiBase(): string {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!account) throw new Error("CLOUDFLARE_ACCOUNT_ID 환경변수가 필요합니다.");
  return `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${BUCKET}/objects`;
}

async function putObject(key: string, body: string): Promise<void> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN 환경변수가 필요합니다.");
  const res = await fetch(`${apiBase()}/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) throw new Error(`R2 업로드 실패 (${res.status}) ${key}: ${await res.text()}`);
}

function* filesToUpload(): Generator<{ key: string; file: string }> {
  const speakers = path.join(DATA_DIR, "speakers.json");
  if (fs.existsSync(speakers)) yield { key: "speakers.json", file: speakers };
  for (const dir of [
    { fsDir: MEETINGS_DIR, prefix: "meetings" },
    { fsDir: TRANSCRIPTS_DIR, prefix: "transcripts" },
  ]) {
    if (!fs.existsSync(dir.fsDir)) continue;
    for (const f of fs.readdirSync(dir.fsDir)) {
      if (f.endsWith(".json")) yield { key: `${dir.prefix}/${f}`, file: path.join(dir.fsDir, f) };
    }
  }
}

/** R2 설정이 없으면 조용히 건너뛸 수 있도록 여부만 확인 */
export function r2Configured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
}

export async function uploadToR2(): Promise<void> {
  let count = 0;
  for (const { key, file } of filesToUpload()) {
    await putObject(key, fs.readFileSync(file, "utf-8"));
    count += 1;
  }
  log(`R2 업로드 완료: ${BUCKET} 버킷에 ${count}개 파일`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  uploadToR2().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
