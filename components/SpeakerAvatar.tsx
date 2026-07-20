import type { Speaker } from "@/lib/types";

const SIZE_CLASS = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
} as const;

/** 발언자별 고정 배경색 (이름 해시) */
function bgColor(name: string): string {
  /* 색은 관계·상태 전용이므로 아바타는 네이비 톤 계열로만 구분한다 */
  const palette = [
    "bg-navy-700",
    "bg-navy-500",
    "bg-[#31456b]",
    "bg-[#4d5f7d]",
    "bg-[#23324e]",
    "bg-[#5a6b85]",
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
