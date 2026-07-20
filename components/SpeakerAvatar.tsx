"use client";

import { useState } from "react";
import type { Speaker } from "@/lib/types";

const SIZE_CLASS = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
} as const;

/** 발언자별 고정 배경색 (이름 해시, 네이비 톤 계열) */
function bgColor(name: string): string {
  const palette = [
    "bg-navy-700",
    "bg-[#31456b]",
    "bg-[#4d5f7d]",
    "bg-[#23324e]",
    "bg-[#5a6b85]",
    "bg-[#3a4a63]",
  ];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return palette[h % palette.length];
}

/**
 * 발언자 사진 아바타. 사진이 없거나 로드 실패 시 이니셜 폴백.
 * 사진에는 title 속성으로 출처(공공누리/위키미디어 라이선스)를 표기한다.
 */
export default function SpeakerAvatar({
  speaker,
  size = "md",
}: {
  speaker: Speaker;
  size?: keyof typeof SIZE_CLASS;
}) {
  const [failed, setFailed] = useState(false);

  if (speaker.photo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={speaker.photo}
        alt={`${speaker.name} ${speaker.role}`}
        title={speaker.photoSource ? `사진 출처: ${speaker.photoSource}` : undefined}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${SIZE_CLASS[size]} shrink-0 rounded-full border border-white/15 object-cover object-top shadow`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${SIZE_CLASS[size]} ${bgColor(speaker.name)} flex shrink-0 items-center justify-center rounded-full border border-white/15 font-semibold text-white shadow`}
    >
      {speaker.name.slice(0, 1)}
    </span>
  );
}
