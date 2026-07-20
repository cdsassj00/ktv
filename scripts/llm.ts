/**
 * LLM 호출 추상화 — 공급자를 선택하고, 작업 경중에 따라 모델을 2단계로 나눠 쓴다.
 *
 *   tier "light" — 가벼운 작업: 청크별 발언 분리, 지시-후속보고 매칭
 *   tier "main"  — 무거운 작업: 회의 전체 통합 요약(reduce)
 *
 * 환경변수:
 *   LLM_PROVIDER      anthropic(기본) | openrouter | openai
 *   ANTHROPIC_API_KEY / OPENROUTER_API_KEY / OPENAI_API_KEY  — 공급자에 맞는 키 1개만 있으면 됨
 *   LLM_MODEL_MAIN, LLM_MODEL_LIGHT  — 모델 직접 지정(선택). 미지정 시 공급자별 기본값 사용.
 *     OpenRouter는 "anthropic/claude-sonnet-4.5", "openai/gpt-5-mini"처럼 어떤 모델이든 지정 가능.
 */
import Anthropic from "@anthropic-ai/sdk";

export type Tier = "light" | "main";
type Provider = "anthropic" | "openrouter" | "openai";

const PROVIDER = (process.env.LLM_PROVIDER ?? "anthropic") as Provider;

const DEFAULT_MODELS: Record<Provider, Record<Tier, string>> = {
  anthropic: { main: "claude-sonnet-5", light: "claude-haiku-4-5-20251001" },
  openrouter: { main: "anthropic/claude-sonnet-4.5", light: "openai/gpt-5-mini" },
  openai: { main: "gpt-5", light: "gpt-5-mini" },
};

function modelFor(tier: Tier): string {
  if (tier === "main" && process.env.LLM_MODEL_MAIN) return process.env.LLM_MODEL_MAIN;
  if (tier === "light" && process.env.LLM_MODEL_LIGHT) return process.env.LLM_MODEL_LIGHT;
  return DEFAULT_MODELS[PROVIDER][tier];
}

/** 실행 전에 키가 있는지 확인하고 없으면 친절한 에러 */
export function assertLlmEnv(): void {
  const need: Record<Provider, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    openai: "OPENAI_API_KEY",
  };
  const key = need[PROVIDER];
  if (!key) throw new Error(`알 수 없는 LLM_PROVIDER: ${PROVIDER} (anthropic|openrouter|openai)`);
  if (!process.env[key])
    throw new Error(`LLM_PROVIDER=${PROVIDER} 사용 시 ${key} 환경변수가 필요합니다.`);
}

export function describeLlm(): string {
  return `${PROVIDER} (main=${modelFor("main")}, light=${modelFor("light")})`;
}

let anthropicClient: Anthropic | null = null;

async function askAnthropic(prompt: string, maxTokens: number, model: string): Promise<string> {
  anthropicClient ??= new Anthropic();
  const res = await anthropicClient.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** OpenAI 호환 chat/completions (OpenRouter 포함) */
async function askOpenAiCompatible(
  prompt: string,
  maxTokens: number,
  model: string
): Promise<string> {
  const isRouter = PROVIDER === "openrouter";
  const url = isRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const apiKey = isRouter ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(isRouter ? { "X-Title": "OpenCabinet" } : {}),
    },
    body: JSON.stringify({
      model,
      max_completion_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`${PROVIDER} API 실패 (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message?.content ?? "";
}

/** 프롬프트 1건 실행. 일시 오류(429/5xx)는 3회 지수 백오프 재시도 */
export async function ask(prompt: string, maxTokens: number, tier: Tier): Promise<string> {
  const model = modelFor(tier);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return PROVIDER === "anthropic"
        ? await askAnthropic(prompt, maxTokens, model)
        : await askOpenAiCompatible(prompt, maxTokens, model);
    } catch (e) {
      lastError = e;
      const msg = String(e);
      if (!/429|5\d\d|overloaded|timeout|ECONN|fetch failed/i.test(msg)) throw e;
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    }
  }
  throw lastError;
}
