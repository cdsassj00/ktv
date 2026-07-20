import type { Speaker } from "@/lib/types";

const SIZE_CLASS = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
} as const;

/** 발언자별 고정 배경색 (이름 해시) */
function bgColor(name: string): string {
  const palette = [
    "bg-navy-600",
    "bg-emerald-700",
    "bg-rose-700",
    "bg-amber-700",
    "bg-violet-700",
    "bg-cyan-700",
    "bg-slate-600",
  ];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return palette[h % palette.length];
}

/**
 * 발언자 사진. 사진이 없으면 이니셜 아바타 폴백.
 * 사진이 있는 경우 title 속성으로 공공누리 출처를 표기한다.
 */
export default function SpeakerAvatar({
  speaker,
  size = "md",
}: {
  speaker: Speaker;
  size?: keyof typeof SIZE_CLASS;
}) {
  if (speaker.photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={speaker.photo}
        alt={`${speaker.name} ${speaker.role}`}
        title={speaker.photoSource ? `사진 출처: ${speaker.photoSource}` : undefined}
        className={`${SIZE_CLASS[size]} shrink-0 rounded-full object-cover ring-2 ring-white shadow`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${SIZE_CLASS[size]} ${bgColor(speaker.name)} flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white shadow`}
    >
      {speaker.name.slice(0, 1)}
    </span>
  );
}
