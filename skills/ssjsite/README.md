# ssjsite — 정부 관보 스타일 디자인 시스템 스킬

open-policy.vercel.app의 UI/UX(네이비+세리프, 종이색 배경, 관인 씰, 신문 괘선)를
실제 CSS에서 추출해 **재사용 가능한 Claude 스킬**로 정리했다.
내용(콘텐츠)은 매번 달라도, 이 스킬을 쓰면 같은 디자인·폰트·레이아웃이 적용된다.

## 구성

```
skills/ssjsite/
├── SKILL.md               # 스킬 본문: 디자인 토큰, 타이포 규칙, 컴포넌트 카탈로그, 금지 사항
├── assets/ssjsite.css     # 독립 실행 가능한 스타일시트 (토큰 + 전 컴포넌트 구현)
└── templates/example.html # 전체 페이지 골격 예시 — 복사해서 내용만 교체
```

## 설치 (Claude Code에서 스킬로 쓰기)

프로젝트에 복사:

```bash
mkdir -p .claude/skills
cp -r skills/ssjsite .claude/skills/ssjsite
```

이후 Claude Code에서 `/ssjsite` 또는 "ssjsite 스타일로 ○○ 페이지 만들어줘"라고
요청하면 이 디자인 시스템이 적용된다.

## 스킬 없이 그냥 쓰기

`assets/ssjsite.css` + 폰트 3종(Pretendard, Noto Serif KR, JetBrains Mono) 로드 후
`templates/example.html` 구조를 따라 마크업하면 된다. 자세한 규칙은 SKILL.md 참고.

## 디자인 핵심 요약

| 요소 | 값 |
|---|---|
| 배경 | 종이색 `#F7F5F0` (순백 금지) |
| 주색 | 네이비 `#0B2F5C` / 액센트 인주색 `#C8323C` / 금색 `#B08840` |
| 제목 | Noto Serif KR (신문 헤드라인) |
| 본문 | Pretendard Variable |
| 메타 | JetBrains Mono (날짜·회차·배지, uppercase + letter-spacing) |
| 모서리 | 전부 2px (둥근 모서리 금지) |
| 구획 | 그림자 대신 1~2px 괘선 |
