"use client";

/** 뒤로가기 — 히스토리가 있으면 back(), 직접 진입(딥링크)이면 홈으로 */
export default function BackLink({ label = "뒤로" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (history.length > 1 && document.referrer.startsWith(location.origin)) {
          history.back();
        } else {
          location.href = "/";
        }
      }}
      className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-surf px-4 py-2 text-[13.5px] font-medium text-body transition hover:bg-tint hover:text-ink"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4" aria-hidden>
        <path d="m15 18-6-6 6-6" />
      </svg>
      {label}
    </button>
  );
}
