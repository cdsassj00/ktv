# ssjsite — 모션 & 레이아웃 패턴

`design-tokens.css`의 클래스를 실제로 움직이게 하는 JS와, 화면을 구성하는
구조 패턴 모음. React(Next.js)와 순수 HTML 두 버전을 모두 제공한다.

## 목차
1. Reveal — 스크롤 진입 페이드업 (가장 많이 씀)
2. CountUp — 숫자 카운트업
3. ScrollProgress — 상단 진행바
4. RotatingWord + 타자기 — 헤드라인 강조
5. 히어로 라인마스크 제목
6. 레이아웃 뼈대 (헤더/섹션 리듬/푸터)
7. 카드·칩·아코디언·플로팅 내비 구조

---

## 1. Reveal — 스크롤 진입 페이드업

**핵심 원칙**: 페이지 전체가 IntersectionObserver **하나**를 공유한다(수십 개씩
만들지 않는다). `threshold: 0`(요소가 뷰포트보다 길어도 발동) + `rootMargin`으로
하단 진입 시점을 늦춘다.

**React (공유 옵저버):**
```tsx
"use client";
import { useEffect, useRef } from "react";
let io: IntersectionObserver | null = null;
function observer() {
  io ??= new IntersectionObserver(
    (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("show"); io!.unobserve(e.target); } }),
    { threshold: 0, rootMargin: "0px 0px -10% 0px" }
  );
  return io;
}
export default function Reveal({ children, stagger = false, className }:
  { children: React.ReactNode; stagger?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.classList.add("show"); return; }
    if (stagger) [...el.children].forEach((c, i) =>
      ((c as HTMLElement).style.transitionDelay = `${Math.min(i, 8) * 80}ms`)); // 8개 상한
    const o = observer(); o.observe(el);
    return () => o.unobserve(el);
  }, [stagger]);
  return <div ref={ref} {...(stagger ? { "data-stagger": "" } : { "data-reveal": "" })} className={className}>{children}</div>;
}
```

**순수 HTML/JS:**
```html
<div data-reveal>…</div>  <!-- 개별 -->
<div data-stagger>…</div> <!-- 자식들 순차 -->
<script>
const io = new IntersectionObserver((es)=>es.forEach(e=>{
  if(e.isIntersecting){ e.target.classList.add("show"); io.unobserve(e.target); }
}), { threshold:0, rootMargin:"0px 0px -10% 0px" });
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.querySelectorAll("[data-reveal],[data-stagger]").forEach((el,)=>{
    el.querySelectorAll?.(":scope > *").forEach((c,i)=> c.style.transitionDelay = `${Math.min(i,8)*80}ms`);
    io.observe(el);
  });
} else document.querySelectorAll("[data-reveal],[data-stagger]").forEach(el=>el.classList.add("show"));
</script>
```

## 2. CountUp — 숫자 카운트업 (ease-out cubic, 1.2s, 화면 진입 시)
```tsx
"use client"; import { useEffect, useRef } from "react";
export default function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = String(value); return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const t0 = performance.now();
      const tick = (n: number) => { const t = Math.min(1,(n-t0)/1200);
        el.textContent = String(Math.round(value*(1-(1-t)**3))); if (t<1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el); return () => io.disconnect();
  }, [value]);
  return <span ref={ref} className="tabular">0</span>;
}
```

## 3. ScrollProgress — 상단 2px 리딩 바
```tsx
// 고정 컨테이너 안의 바를 scaleX(0→1)로. 리렌더 없이 style.transform만 갱신.
<div className="fixed inset-x-0 top-0 z-50 h-[2px]">
  <div ref={ref} className="h-full origin-left bg-accent-500" style={{transform:"scaleX(0)"}} />
</div>
// scroll 이벤트에서: const p = scrollY/(scrollHeight-innerHeight); ref.style.transform=`scaleX(${p})`
```

## 4. RotatingWord + 타자기 — 헤드라인 강조
헤드라인의 한 단어만 세로로 교체(레이아웃 안 흔들리게 grid 셀에 겹쳐 둠) +
교체 단어에 `.aurora-text`. "무엇이든 검색해 보세요"에서 "무엇이든"만 회전.
```tsx
// 모든 단어를 같은 그리드 셀(gridArea:"1/1")에 겹쳐두고, 활성=translateY(0),
// 직전=translateY(-105%), 대기=translateY(105%), 전부 opacity로. 2.3s 간격 setInterval.
<span className="inline-grid overflow-hidden align-bottom">
  {words.map((w,i)=>(<span key={w} style={{gridArea:"1/1"}}
    className={`aurora-text transition-all duration-500 ${i===idx?"translate-y-0 opacity-100":"…"}`}>{w}</span>))}
</span>
```
타자기 버전: 검색바 placeholder에 키워드를 한 글자씩 쳤다 지우며 순환 + `.caret` 커서.

## 5. 히어로 라인마스크 제목
```html
<h1 class="h-judge">
  <span class="ln"><span>국무회의,</span></span>
  <span class="ln"><span>대화로 읽다.</span></span>
</h1>
```
각 줄이 마스크 안에서 아래→제자리로 올라온다. 2번째 줄은 0.14s 지연(CSS에 내장).

---

## 6. 레이아웃 뼈대 — 몰입형 단일 페이지

이 디자인의 골격은 **풀블리드 히어로 → 리듬감 있는 섹션 스택 → 프로스티드 헤더/푸터**다.

**프로스티드 고정 헤더** (배경 위에 유리처럼):
```html
<header class="fixed inset-x-0 top-0 z-40 bg-black/60 backdrop-blur-xl backdrop-saturate-150">
  <div class="mx-auto flex h-12 max-w-6xl items-center gap-6 px-5">…</div>
</header>
```

**히어로** (풀높이 + 중앙 정렬 + 라디얼 비네트로 가장자리를 어둡게):
```html
<section class="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-5 text-center">
  <!-- 배경: 파티클/그래프 캔버스 또는 저투명 패럴랙스 사진 -->
  <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#000_78%)]"></div>
  <div class="relative"> … 라인마스크 제목 + 부제 + btn-pill … </div>
  <a class="scroll-cue absolute bottom-8">⌄</a>
</section>
```

**섹션 리듬**: 각 섹션은 `px-5 py-24`(모바일)~`py-24` 넉넉한 세로 여백,
콘텐츠는 `mx-auto max-w-2xl~max-w-4xl`로 가운데 묶기. 섹션 상단은 항상
`overline-label`(작은 라벨) → `h-judge`(큰 제목) → 설명문 순서.
```html
<section class="px-5 py-24">
  <div class="mx-auto max-w-3xl">
    <p class="overline-label">Network Search</p>
    <h2 class="h-judge mt-1.5">무엇이든 검색해 보세요.</h2>
    <p class="mt-3 text-[16px] leading-relaxed text-mut">설명…</p>
    <div class="mt-8">…본문…</div>
  </div>
</section>
```

**강조 섹션 분리**: 순수 블랙 위에서 특정 섹션만 도드라지게 하려면 네이비
그라데이션 패널로 감싸고 앰비언트 글로우를 얹는다.
```html
<div class="relative overflow-hidden rounded-[28px] ring-1 ring-white/10 px-6 py-14 text-center
            bg-[linear-gradient(165deg,#0b1830_0%,#070d1a_45%,#050508_100%)]">
  <div class="pointer-events-none absolute -top-24 left-1/2 h-56 w-[560px] -translate-x-1/2
              rounded-full bg-accent-500/15 blur-3xl"></div>
  … 내용 …
</div>
```

**패럴랙스 배경 사진**: 섹션 뒤에 저투명(opacity 0.1~0.2) 흑백 사진을 깔고
스크롤 진행률에 따라 translateY + opacity 스크럽. `grayscale-[.35]` + 위·아래
`bg-gradient-to-b from-black via-transparent to-black`로 가장자리 페이드.

## 7. 반복 구조 요소

**카드**: `.panel`(rounded-2xl bg-surf) + `p-5~p-7`, 호버 시
`hover:-translate-y-1 hover:shadow-lift transition`. 인용을 헤드라인으로 쓸 땐
`❝ … ❞`(accent 색 글리프)로 감싼다.

**시맨틱 칩**: 상태/종류를 `.chip` + 시맨틱 틴트 클래스로. 지시=레드,
보고=블루, 답변=그린, 질문=오렌지 (투명 배경 16% + 채도 낮춘 텍스트).

**네이티브 아코디언**: 긴 목록·상세는 `<details>`로 접는다(JS 불필요).
셰브런은 `group-open:rotate-180`. 첫 항목만 `open`.
```html
<details class="group panel p-4" open>
  <summary class="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
    <span class="flex-1">제목</span>
    <svg class="size-4 transition-transform group-open:rotate-180">⌄</svg>
  </summary>
  <div class="mt-3">…</div>
</details>
```

**다이내믹 아일랜드 플로팅 내비**: 스크롤을 따라다니는 알약. 데스크톱은 우측
세로, 모바일은 하단 가로. 접힘 시 진행률 링 + 현재 섹션 칩만, 호버/탭 시
전체 칩이 스태거로 펼쳐짐. `bg-black/70 backdrop-blur-xl border border-white/10`.

**저작권/광고 배지**: 좌하단 미니 배지(클릭 시 팝오버) 또는 상단 `.gold-banner`.
반사광 스윕으로 시선을 끌되 과하지 않게.
