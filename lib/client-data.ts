import type { Speaker } from "./types";

/** 알 수 없는 발언자 폴백 (클라이언트 컴포넌트에서도 사용 가능하도록 fs 의존 없는 모듈에 둠) */
export const UNKNOWN_SPEAKER: Speaker = {
  name: "미상",
  role: "발언자 미식별",
  org: "",
  photo: null,
  photoSource: null,
};
