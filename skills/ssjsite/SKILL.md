---
name: ssjsite
description: >
  신성진(SSJ) 웹사이트 디자인 시스템 — "정부 관보·신문(Government Gazette)" 스타일의
  네이비+세리프 디자인을 어떤 콘텐츠의 웹페이지에든 적용한다. 사용자가 "ssjsite",
  "ssjsite 스타일로", "관보 스타일", "open-policy 스타일", "그 정책 사이트 디자인으로
  만들어줘"라고 하거나, 정책·아카이브·데이터 서비스류 사이트를 이 디자인으로
  만들어 달라고 할 때 사용한다. 콘텐츠(내용)는 매번 다르고, 디자인 토큰·폰트·
  레이아웃·컴포넌트는 이 스킬의 규칙을 그대로 따른다.
---

# ssjsite — 정부 관보 스타일 디자인 시스템

한국 정부 자료 아카이브 사이트(open-policy.vercel.app)의 시각 언어를 재사용 가능한
디자인 시스템으로 정리한 스킬. **"종이 관보를 웹으로 옮긴 듯한" 진지하고 신뢰감 있는
톤**이 핵심이다. 내용이 무엇이든 아래 규칙을 지키면 같은 느낌이 난다.

## 0. 사용 방법

1. `assets/ssjsite.css`를 페이지에 포함한다 (또는 내용을 `<style>`로 인라인).
2. Pretendard + Noto Serif KR + JetBrains Mono 폰트를 로드한다 (§2의 링크).
3. 페이지 구조를 §4의 레이아웃 골격대로 짠다: gov-bar → masthead → nav → hero →
   section들 → footer.
4. 콘텐츠에 맞는 컴포넌트(§5)를 조합한다. **새 색·새 폰트·둥근 모서리를 추가하지
   않는다** — 이 시스템의 정체성은 절제에서 나온다.
5. `templates/example.html`이 전체 골격의 살아있는 예시다. 새 페이지는 이 파일을
   복제해 내용만 갈아끼우는 방식을 권장한다.

## 1. 디자인 토큰 (원본 사이트에서 추출한 실측값)

```css
:root {
  /* 브랜드 */
  --navy:   #0B2F5C;  /* 주 색상: 제목 강조, 활성 상태, 배지 */
  --navy-2: #143A6B;
  --navy-3: #1B4A82;
  /* 텍스트 */
  --ink:    #111418;  /* 본문 검정(순흑 아님) */
  --ink-2:  #2A2E35;
  /* 종이 그레이 스케일 — 웜톤(베이지 기운) 회색이 핵심 */
  --gray-1: #F7F5F0;  /* 페이지 배경 = 종이색 */
  --gray-2: #EFEBE1;  /* 옅은 배경, 태그 배경 */
  --gray-3: #DDD7C8;  /* 테두리 기본값 */
  --gray-4: #B6AF9E;  /* 비활성 텍스트 */
  --gray-5: #6B6558;  /* 보조 텍스트 */
  --gray-6: #3E3A30;  /* 진한 보조 텍스트 */
  --white:  #FFFFFF;  /* 카드 배경 */
  /* 액센트 */
  --accent:   #C8323C;  /* 붉은 인주(印朱)색: 네비 활성 밑줄, 하이라이트 */
  --accent-2: #B08840;  /* 금색: 보조 배지, 골드 버튼 */
  --live:     #E23D3D;  /* 라이브 표시 점 */
  --ok:       #2E7D5B;  /* 완료/성공 */
  /* 형태 */
  --radius: 2px;                                   /* 모든 모서리 2px — 둥글게 금지 */
  --shadow-sm: 0 1px 0 rgba(17,20,24,.06);
  --shadow: 0 2px 8px rgba(17,20,24,.06), 0 1px 0 rgba(17,20,24,.04);
}
```

**색 사용 규칙**
- 배경은 항상 `--gray-1`(종이색), 카드는 `--white` + `--gray-3` 1px 테두리.
- 채도 높은 색은 넓은 면적에 쓰지 않는다. `--navy`는 배지·씰·강조 텍스트에,
  `--accent`는 가는 밑줄·마킹·점에만 점적으로 쓴다.
- 다크모드 없음. `color-scheme: light` 고정.

## 2. 타이포그래피 — 3폰트 체계

| 역할 | 폰트 | 쓰는 곳 |
|---|---|---|
| **세리프 (제목)** | Noto Serif KR | 브랜드명, hero 제목, 섹션 h2, 카드 제목 — "신문 헤드라인" |
| **산세리프 (본문)** | Pretendard Variable | 본문, 내비, 버튼, UI 전반 |
| **모노 (메타)** | JetBrains Mono | 날짜, 회차, 카운트, eyebrow/kicker, 배지 라벨 — "타자기 관인" |

로드 (원본과 동일한 CDN):

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"/>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@600;700;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
```

**스케일·조판 규칙 (실측)**
- 본문 15px / line-height 1.6, `word-break: keep-all` (한국어 단어 단위 줄바꿈 필수).
- hero 제목: 세리프 `clamp(30px, 4.2vw, 50px)`, line-height 1.15, letter-spacing -0.03em,
  `text-wrap: balance`. 핵심 단어에만 `<span class="navy">`로 네이비색.
- 섹션 h2: 세리프 26px/700, 아래 `border-bottom: 2px solid var(--ink)` (신문 괘선).
- eyebrow/kicker: 모노 11px, letter-spacing 0.14em, uppercase, 앞에 24px 가로선.
- 숫자는 `font-variant-numeric: tabular-nums`.

## 3. 질감을 만드는 디테일 (빠뜨리면 느낌이 안 남)

1. **radius 2px 고정** — pill 버튼, 둥근 카드 금지. 원형은 브랜드 씰과 상태 점만.
2. **괘선 문화** — 구획은 그림자가 아니라 1~2px 실선으로 나눈다. 섹션 제목 밑 2px
   먹선, 카드 1px 회색선, masthead 하단 1px선.
3. **브랜드 씰**: 네이비 원(44px) 안에 세리프 한 글자 + 바깥 4px 떨어진 1px 동심원
   (관인 느낌). `.brand-seal` 참고.
4. **하이라이트 `<mark>`**: 배경 `rgba(200,50,60,.15)` + `box-shadow: inset 0 -2px 0
   var(--accent)` — 붉은 밑줄 형광펜.
5. **활성 내비**: 텍스트 네이비 + 아래 2px `--accent` 밑줄 (파랑 글자에 빨간 줄).
6. **라이브 점**: 6px 원 + `box-shadow 0 0 0 3px rgba(226,61,61,.22)` + 1.6s pulse.
7. 호버 전환은 `transition: all .15s` — 빠르고 절제되게. 화려한 애니메이션 금지.

## 4. 레이아웃 골격

```
┌ .gov-bar      먹색(--ink) 얇은 띠. 모노 12px. 왼쪽: 라이브점+공지, 오른쪽: 링크들
├ .masthead     종이색. .brand(씰+세리프 제목+모노 부제) ↔ 우측 메타. 하단 1px선
├ .nav 줄       탭형 내비 + 우측 .nav-search(⌘K 힌트 kbd 포함)
├ .hero-ed      eyebrow → 세리프 대제목(핵심어 .navy) → .lead 문단 → 통계/CTA
├ 본문 섹션들   .section-head(세리프 h2 + 모노 카운트, 먹선 2px) + 카드 그리드
└ footer        먹색 배경, 흰 텍스트, 모노 메타
```

- 컨테이너: `.container` max-width 1360px / `.container-narrow` 1180px, 좌우 40px
  (모바일 20px).
- 그리드: 카드 목록 `repeat(auto-fill, minmax(300px, 1fr))`, gap 20px.
- 상세 페이지: 본문 2fr + 사이드 1fr의 2컬럼, 1024px 이하에서 1컬럼.

## 5. 컴포넌트 카탈로그 (`assets/ssjsite.css`에 전부 구현됨)

| 클래스 | 용도 |
|---|---|
| `.gov-bar` `.gov-bar-dot` | 최상단 먹색 공지 띠 + 라이브 점 |
| `.masthead` `.brand` `.brand-seal` `.brand-title` `.brand-sub` | 제호 영역 |
| `.nav` `.nav-item(.active)` `.nav-search` `.nav-search-kbd` | 내비게이션 |
| `.hero-ed` `.hero-h1` `.eyebrow` `.kicker` `.lead` | 히어로 |
| `.section-head` + `h2` + `.section-head-count` | 섹션 제목(먹선) |
| `.card` `.card-pad` `.card-title` `.card-meta` | 기본 카드 |
| `.btn` `.btn-primary` `.btn-outline` `.btn-ghost` `.btn-gold` `.btn-sm` | 버튼 |
| `.badge` + `-cabinet/-report/-done/-ing/-gray/-ai/-live/-agenda` | 모노 대문자 상태 배지 |
| `.chip(.active)` `.chip-count` | 필터 칩 (활성 = 먹색 반전) |
| `.tag` `.tag-navy` `.tag-accent` | `#` 붙는 해시태그 |
| `.stat` `.stat-num` `.stat-label` | 모노 숫자 통계 |
| `.speaker` `.speaker-avatar` `.speaker-name` `.speaker-role` | 인물 카드(사진 원형은 예외 허용) |
| `.timeline` `.timeline-item` | 세로 괘선 타임라인 |
| `mark` | 붉은 형광펜 하이라이트 |
| `.mono` `.serif` `.tabular` `.small` | 유틸리티 |

## 6. 하지 말 것

- ❌ 다른 폰트 추가 (Inter, Roboto, 나눔고딕 등 금지 — 3폰트 체계 유지)
- ❌ border-radius 4px 이상, pill/원형 버튼
- ❌ 그라데이션, 유리효과(glassmorphism), 화려한 그림자
- ❌ 채도 높은 파랑/보라 배경면, 다크모드
- ❌ 이모지를 UI 아이콘으로 남용 (텍스트·괘선·점으로 해결)
- ❌ 순백 배경 페이지 (`#fff`는 카드에만, 페이지는 반드시 종이색 `--gray-1`)

## 7. 새 사이트에 적용하는 절차

1. 콘텐츠의 정보 구조를 먼저 정한다 (목록형? 상세형? 대시보드형?).
2. `templates/example.html`을 복사해 gov-bar 공지문·브랜드명(씰 글자 1자)·내비
   항목·hero 문구를 교체한다.
3. 도메인 배지를 정의한다 — 배지 색은 기존 6종(-cabinet 네이비, -report 금색,
   -done 녹색, -ing 황토, -gray, -live 적색)에 의미만 다시 부여한다. 새 색 금지.
4. 본문 섹션을 §5 컴포넌트 조합으로 구성한다.
5. 마지막으로 §3 디테일 체크리스트(씰 동심원, 먹선, mark, 모노 메타)를 검수한다.
