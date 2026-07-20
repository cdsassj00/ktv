# 열린국무회의 (OpenCabinet) — 서비스 계획서

> KTV 국민방송(https://www.youtube.com/@KTV_korea)이 공개 중계하는 **국무회의·국민업무보고** 영상을
> 자동 수집·요약하여, 누구나 회의 목록·영상·요약·**AI/데이터 정책 발언**을 한눈에 볼 수 있게 하는 웹 서비스.

---

## 1. 목표

| 구분 | 내용 |
|------|------|
| 핵심 가치 | 대통령 주재 공개 회의(국무회의, 국민업무보고)를 "찾아보기 쉬운 아카이브"로 재구성 |
| 1차 사용자 | AI/데이터 정책에 관심 있는 국민, 연구자, 기자, 공무원 |
| 차별점 | ① 회의별 구조화된 요약 ② **AI·데이터 정책 발언만 모아보는 전용 대시보드** ③ 발언자(국무위원) 사진·프로필 카드 |

## 2. 데이터 소스 현황 (조사 결과)

- **KTV 유튜브 채널**: 국무회의는 통상 **매주 화요일 오전 10시 전후 생중계**, 종료 후 다시보기 업로드. 국민업무보고(부처별 업무보고)도 생중계·다시보기 제공.
- **자막**: KTV 영상은 대부분 한국어 자동 자막(ASR)이 생성됨 → 요약 파이프라인의 1차 입력.
- **보조 소스**: ktv.go.kr 다시보기 페이지, 대한민국 정책브리핑(korea.kr)의 회의 결과 보도자료 — 요약 교차검증용.
- **API**: 사용자가 보유한 **YouTube Data API v3 (GCP)** 로 영상 메타데이터 수집.

## 3. 시스템 아키텍처

```
[수집 배치 (GitHub Actions cron, 1일 2회)]
  YouTube Data API v3
    └ channels.list → uploads playlistId
    └ playlistItems.list → 신규 영상 목록
    └ 제목/설명 필터: "국무회의", "업무보고", "수석·보좌관", "비상경제" 등
  ↓
  자막 수집: youtube-transcript-api (한국어 자동자막) / 실패 시 yt-dlp --write-auto-sub
  ↓
[요약 엔진 (Claude API)]
  1) 전사 청크 분할(15~20분 단위) → 청크별 요약 (map)
  2) 청크 요약 통합 → 회의 전체 구조화 요약 (reduce)
  3) 구조화 출력(JSON): 안건 목록 / 발언자별 핵심 발언 / 주제 태그 / AI·데이터 정책 발언(타임스탬프 포함)
  ↓
[저장소]
  data/meetings/*.json + data/speakers.json  (git 커밋 = 버전관리·백업)
  ↓
[웹 프런트 (Next.js, Vercel 배포)]
  빌드 시 JSON 정적 로드 (SSG + 일 2회 재배포 트리거)
```

**설계 원칙 — 서버리스·저비용**: DB 없이 git 저장 JSON으로 시작한다. 회의 수는 연간 수백 건 수준이라 정적 생성으로 충분하며, 이후 검색·알림이 필요해지면 Supabase(Postgres + pgvector)로 이관한다.

## 4. 기술 스택

| 레이어 | 선택 | 이유 |
|--------|------|------|
| 프런트 | **Next.js 15 (App Router) + Tailwind CSS** | SSG/ISR, Vercel 무료 배포, 반응형 |
| 수집 스크립트 | **Node.js (TypeScript)** — `googleapis`, `youtube-transcript` | 프런트와 단일 언어 |
| 요약 | **Claude API** (`claude-sonnet-5` 본요약 / `claude-haiku-4-5` 태깅) | 긴 전사 처리, 구조화 JSON 출력 |
| 자동화 | **GitHub Actions cron** (화·수 오전 집중 + 일 1회) | 무료, 결과를 git 커밋으로 저장 |
| 배포 | **Vercel** | push 시 자동 재배포 |
| 영상 재생 | YouTube iframe embed + `?t=초` 딥링크 | 원본 채널 조회수 기여, 저작권 안전 |

## 5. 데이터 모델

```jsonc
// data/meetings/2026-07-15_제56회-국무회의.json
{
  "id": "2026-07-15-cabinet-56",
  "type": "cabinet",              // cabinet(국무회의) | briefing(국민업무보고) | other
  "title": "제56회 국무회의",
  "date": "2026-07-15",
  "videoId": "abc123XYZ",          // YouTube
  "videoUrl": "https://youtu.be/abc123XYZ",
  "duration": 5400,
  "thumbnail": "https://i.ytimg.com/vi/abc123XYZ/hqdefault.jpg",
  "summary": {
    "oneLine": "한 줄 요약",
    "overview": "3~5문단 전체 요약",
    "agenda": [ { "title": "안건명", "summary": "...", "timestamp": 754 } ],
    "remarks": [                    // 발언자별 핵심 발언
      { "speakerId": "president", "quote": "...", "context": "...", "timestamp": 1230 }
    ]
  },
  "aiDataPolicy": [                 // ★ 핵심 기능: AI·데이터 정책 발언
    {
      "topic": "AI 기본법 시행령",
      "speakerId": "msit-minister",
      "summary": "...",
      "quote": "직접 인용문",
      "timestamp": 2410,
      "tags": ["AI기본법", "규제", "데이터거버넌스"]
    }
  ],
  "tags": ["AI", "데이터", "K-푸드", "수출"]
}

// data/speakers.json — 국무위원 명부 (수동 관리 + 개각 시 갱신)
{
  "president": {
    "name": "이재명", "role": "대통령", "org": "대통령실",
    "photo": "/speakers/president.jpg",
    "photoSource": "대한민국 정책브리핑(korea.kr), 공공누리 제1유형",
    "term": { "from": "2025-06-04" }
  }
}
```

## 6. 핵심 기능 (화면 단위)

### 6.1 홈 — 회의 타임라인
- 최신 회의부터 카드 리스트(썸네일·날짜·유형 배지·한 줄 요약·AI/데이터 관련 여부 표시 🏷️)
- 상단 필터: [전체 | 국무회의 | 국민업무보고] + 월별 이동
- "이번 주 회의" 히어로 섹션

### 6.2 회의 상세
- 좌측(모바일 상단): YouTube 임베드 플레이어
- 우측: 구조화 요약 — 안건 아코디언, 각 항목 클릭 시 **플레이어가 해당 타임스탬프로 점프**
- 발언 요약 카드: **발언자 사진 + 이름·직함** + 핵심 발언 + ▶ 타임스탬프 버튼
- 하단: AI·데이터 정책 발언 하이라이트 섹션 (있는 경우 강조 배경)

### 6.3 AI·데이터 정책 대시보드 (`/ai-policy`)
- 모든 회의에서 추출한 AI/데이터 발언을 시간 역순 피드로 모아보기
- 태그 필터(AI기본법, 데이터거버넌스, 공공데이터, AI예산, 인재양성 …)
- 각 항목 = 발언자 사진 + 인용 + 출처 회의 링크 + 영상 타임스탬프 딥링크
- 간단 통계: 월별 AI/데이터 언급 횟수 추이 차트

### 6.4 발언자 페이지 (`/speakers`, `/speakers/[id]`)
- 국무위원 전원 사진 그리드(대통령·총리·부처 장관)
- 개인 페이지: 프로필 + 그 사람의 회의별 발언 이력

## 7. 발언자 사진 수급 전략

| 순위 | 소스 | 라이선스 |
|------|------|----------|
| 1 | **대한민국 정책브리핑 korea.kr / 각 부처 공식 홈페이지 장관 소개** | 공공누리 제1유형(출처표시) — 상업적 이용·변형 가능 |
| 2 | 위키미디어 공용(정부 공식 촬영본) | CC / KOGL 확인 후 사용 |
| 3 | 확보 실패 시 이니셜 아바타 플레이스홀더 | — |

- 모든 사진에 `photoSource` 필드로 **출처를 저장하고 화면에 툴팁/캡션으로 표기** (공공누리 의무 준수).
- 개각 대응: `speakers.json`에 재임 기간(`term`)을 두어 과거 회의는 당시 재임자와 매칭.

## 8. YouTube API 쿼터 검토

- 일일 무료 쿼터 10,000 units. 사용량: `playlistItems.list`(1 unit/50개) + `videos.list`(1 unit/50개) 수준 → **일 수십 unit으로 충분, 문제 없음.**
- `search.list`(100 units)는 쓰지 않고 uploads 재생목록 순회 + 제목 필터로 대체.

## 9. 개발 로드맵

### Phase 1 — 수집·요약 파이프라인 (핵심, ~3일)
- [ ] `scripts/fetch-videos.ts`: 채널 업로드 목록 수집, 회의 영상 분류(제목 규칙 기반)
- [ ] `scripts/fetch-transcript.ts`: 자막 수집(자동자막 폴백 포함)
- [ ] `scripts/summarize.ts`: Claude map-reduce 요약 → 구조화 JSON (안건/발언/AI·데이터 태그)
- [ ] 최근 회의 5~10건으로 품질 검증(요약 vs korea.kr 보도자료 대조)

### Phase 2 — 웹 MVP (~3일)
- [ ] Next.js 스캐폴딩 + 디자인 시스템(정부 느낌의 신뢰감 있는 톤: 네이비/화이트 + 포인트 컬러)
- [ ] 홈 타임라인, 회의 상세(임베드 + 타임스탬프 점프)
- [ ] Vercel 배포

### Phase 3 — 차별화 기능 (~3일)
- [ ] AI·데이터 정책 대시보드 + 태그 필터 + 추이 차트
- [ ] `speakers.json` 구축(현 국무위원 전원) + 공공누리 사진 수집·출처표기
- [ ] 발언자 페이지

### Phase 4 — 자동화·운영 (~2일)
- [ ] GitHub Actions cron: 화요일 오후 집중 폴링 + 일 1회 정기 수집 → JSON 커밋 → Vercel 자동 배포
- [ ] 실패 알림(Actions 실패 시 이슈 생성)
- [ ] README·운영 문서

## 10. 리스크와 대응

| 리스크 | 대응 |
|--------|------|
| 자동자막 품질 낮음 (인명·전문용어 오인식) | Claude 요약 시 "자막 오탈자 보정" 지시 + speakers.json 명부를 프롬프트에 주입해 인명 교정 |
| 자막이 아예 없는 영상 | yt-dlp 오디오 추출 → Whisper ASR 폴백 (Phase 4에서 추가) |
| 요약 할루시네이션 | 모든 요약 항목에 타임스탬프 필수 → 사용자가 원문 영상으로 즉시 검증 가능. 화면에 "AI 생성 요약" 고지 |
| 발언자 식별 오류 (자막에는 화자 정보 없음) | 회의 서두 발언 순서 관례 + 명부 기반 추론, 확신 없으면 발언자 미표기로 보수적 처리 |
| 사진 저작권 | 공공누리 제1유형만 사용, 출처 필드 필수화 |
| 영상 임베드 제한 | KTV는 임베드 허용 중. 차단되는 영상은 썸네일+외부 링크로 폴백 |

## 11. 시작 전 필요한 것 (사용자 준비물)

1. **YouTube Data API 키** → GitHub 리포 Secrets에 `YOUTUBE_API_KEY` 등록 (보유 확인됨 ✅)
2. **Claude API 키** → Secrets `ANTHROPIC_API_KEY` (요약 파이프라인용)
3. Vercel 계정 연결 (배포 시)
