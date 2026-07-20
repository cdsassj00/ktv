# 열린국무회의 (OpenCabinet)

KTV 국민방송([@KTV_korea](https://www.youtube.com/@KTV_korea))이 공개 중계하는
**국무회의·국민업무보고** 영상을 자동 수집·요약해, 회의 목록·영상·요약과
**발언 스레드 / 지시-이행 추적 / AI·데이터 정책 발언**을 한눈에 보여주는 웹 서비스입니다.

전체 설계는 [PLAN.md](./PLAN.md) 참고.

## 주요 화면

| 경로 | 내용 |
|------|------|
| `/` | 회의 타임라인 (유형 필터, AI·데이터 관련 표시) |
| `/meetings/[id]` | 회의 상세 — YouTube 임베드 + 타임스탬프 점프, **발언 스레드**(메신저형 말풍선, 지시/보고/답변 배지), 회의별 네트워크, AI·데이터 발언 하이라이트 |
| `/directives` | **지시-이행 트래커** — 지시 → 후속 보고를 회의를 넘어 추적 (자동 연결은 "추정 연결" 표시) |
| `/network` | 발언 네트워크 (전체 누적) — 노드=발언자, 굵은 빨간 화살표=지시, 네이비=답변·보고 |
| `/ai-policy` | AI·데이터 정책 대시보드 — 태그 필터 + 월별 언급 추이 |
| `/speakers`, `/speakers/[id]` | 국무위원 명부 + 개인별 발언 이력 |

## 실행

```bash
npm install
npm run dev   # http://localhost:3000
npm run build # 정적 생성 (data/*.json 기반 SSG)
```

리포에는 **데모용 샘플 회의 3건**이 들어 있어 API 키 없이도 모든 화면을 확인할 수 있습니다.
샘플은 UI 곳곳에 "샘플" 배너로 표시되며, 파이프라인이 실제 데이터를 생성하면 삭제하면 됩니다
(`data/meetings/*-sample.json`).

## 수집·요약 파이프라인

```bash
export YOUTUBE_API_KEY=...     # GCP YouTube Data API v3
export ANTHROPIC_API_KEY=...   # (기본 공급자) 또는 OPENROUTER_API_KEY / OPENAI_API_KEY

npm run pipeline              # 수집 → 자막 → 요약 한 번에
# 또는 단계별
npm run fetch:videos          # 채널 업로드 목록 → data/videos-queue.json
npm run fetch:transcripts     # 한국어 자막 → data/transcripts/*.json
npm run summarize             # LLM map-reduce → data/meetings/*.json
```

- 쿼터: `search.list`를 쓰지 않고 uploads 재생목록 순회로 **일 수십 unit** 수준.
- 유용한 환경변수: `SINCE=YYYY-MM-DD`(이후 영상만), `MAX_PAGES`(순회 페이지 수), `MAX_MEETINGS`(1회 요약 처리 수).
- 지시-이행 연결: 새 회의 요약 후 기존 회의의 미결 지시와 자동 대조해 `followUps`에
  `inferred: true`(추정 연결)로 기록합니다.

### LLM 공급자·모델 선택 (`scripts/llm.ts`)

작업 경중에 따라 모델을 2단계로 나눠 씁니다 — **light**(청크 발언 분리, 지시 매칭)와
**main**(회의 통합 요약). 공급자는 환경변수로 선택합니다:

| `LLM_PROVIDER` | 필요한 키 | 기본 main | 기본 light |
|---|---|---|---|
| `anthropic` (기본) | `ANTHROPIC_API_KEY` | claude-sonnet-5 | claude-haiku-4-5 |
| `openrouter` | `OPENROUTER_API_KEY` | anthropic/claude-sonnet-4.5 | openai/gpt-5-mini |
| `openai` | `OPENAI_API_KEY` | gpt-5 | gpt-5-mini |

`LLM_MODEL_MAIN` / `LLM_MODEL_LIGHT`로 어떤 모델이든 직접 지정할 수 있습니다.
OpenRouter를 쓰면 한 키로 Claude·GPT·Gemini 등 모델을 자유롭게 골라 쓸 수 있습니다.
(모델 ID는 시점에 따라 바뀌니 [openrouter.ai/models](https://openrouter.ai/models)에서 확인 후 지정 권장)

## 자동화 (GitHub Actions)

`.github/workflows/collect.yml` — 화요일(국무회의 당일) 오후 KST 집중 폴링 + 매일 1회 수집 후
`data/meetings/*.json`을 커밋합니다.

### Secrets 등록 위치 (처음이라면)

1. GitHub에서 리포 페이지 열기 → 상단 **Settings** 탭
2. 왼쪽 메뉴 **Secrets and variables → Actions**
3. **New repository secret** 버튼 → Name/Value 입력
   - `YOUTUBE_API_KEY` (필수)
   - `ANTHROPIC_API_KEY` 또는 `OPENROUTER_API_KEY` 또는 `OPENAI_API_KEY` (쓰는 것 하나만)
   - `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (선택 — R2 아카이브 사용 시)
4. (선택) 같은 화면의 **Variables** 탭에 `LLM_PROVIDER`, `LLM_MODEL_MAIN`, `LLM_MODEL_LIGHT`,
   `R2_BUCKET` 등록
5. **Actions** 탭 → "회의 수집·요약 파이프라인" → **Run workflow**로 수동 첫 실행

### Cloudflare R2 아카이브 (선택)

파이프라인 마지막 단계에서 수집 결과를 R2 버킷에 미러링합니다 (`scripts/upload-r2.ts`):

- `meetings/*.json`, `speakers.json` — git 원본의 백업 미러
- `transcripts/*.json` — **git에는 커밋되지 않는 자막 원문의 영구 보관소** (요약 재생성·모델 교체 시 재사용)

설정: Cloudflare 대시보드 → R2 → 버킷 생성(기본 이름 `opencabinet-data`) →
**R2 API 토큰**(Object Read & Write) 발급 → 위 Secrets에 계정 ID와 토큰 등록.
미설정 시 이 단계는 자동으로 건너뜁니다.

Vercel을 리포에 연결해 두면 커밋 → 자동 재배포로 사이트가 갱신됩니다.

## 데이터 관리 노트

- **`data/speakers.json`** — 국무위원 명부. 화자 추론 프롬프트에 주입되므로 개각 시 갱신 필요.
  ⚠️ 현재 명부는 초기 작성본이므로 **실제 재임자와 대조·검증 후 사용**하세요.
  `term`(재임 기간)을 채우면 과거 회의는 당시 재임자와 매칭할 수 있습니다.
- **발언자 사진** — 공공누리 제1유형(출처표시) 자료만 사용. `public/speakers/`에 이미지를 넣고
  `photo`(`/speakers/xxx.jpg`)와 `photoSource`(출처 문구)를 채우면 아바타 대신 사진이 표시되고
  출처가 툴팁·프로필에 표기됩니다. 사진이 없으면 이니셜 아바타로 표시됩니다.
- **요약 신뢰성** — 모든 요약·스레드·지시 항목에 타임스탬프가 있어 원문 영상으로 즉시 검증
  가능합니다. 화면에 "AI 생성 요약" 고지를 표시합니다.

## 기술 스택

Next.js 15 (App Router, SSG) · Tailwind CSS 4 · TypeScript ·
YouTube Data API v3 · Claude API · GitHub Actions · Vercel

DB 없이 `data/*.json`을 git으로 버전 관리하는 저비용 구조입니다. 회의 수가 연 수백 건 수준이라
정적 생성으로 충분하며, 검색·알림이 필요해지면 Supabase 이관을 검토합니다 (PLAN.md §3).
