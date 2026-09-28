import OpenAI, { APIError } from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { makeLogger } from "@/lib/log";

const log = makeLogger("together");

// Both models default to Kimi K2.6 because V4-Pro on Together is currently slow
// (15-71s per call) and intermittently 503s under batch load. Kimi K2.6 is
// thinking-capable too but we explicitly disable thinking for most calls so the
// output budget isn't spent on hidden reasoning.
// Slugs from https://www.together.ai/models/kimi-k26 and
// https://www.together.ai/models/deepseek-v4-pro.
export const ORCHESTRATOR_MODEL =
  process.env.TOGETHER_ORCHESTRATOR_MODEL ?? "moonshotai/Kimi-K2.6";
export const AGENT_MODEL = process.env.TOGETHER_AGENT_MODEL ?? "moonshotai/Kimi-K2.6";

log.info("Together AI client init", {
  orchestratorModel: ORCHESTRATOR_MODEL,
  agentModel: AGENT_MODEL,
  hasKey: !!process.env.TOGETHER_AI_API_KEY,
});
if (!process.env.TOGETHER_AI_API_KEY) {
  log.warn("TOGETHER_AI_API_KEY is not set — Together AI calls will fail");
}

export const together = new OpenAI({
  baseURL: "https://api.together.xyz/v1",
  apiKey: process.env.TOGETHER_AI_API_KEY ?? "missing-together-key",
});

type ReasoningStyle = "deepseek" | "kimi" | "none";

function detectReasoningStyle(model: string): ReasoningStyle {
  const lc = model.toLowerCase();
  if (lc.includes("v4-pro") || lc.includes("r1") || lc.includes("deepseek-r")) return "deepseek";
  // Kimi K2.5 / K2.6 / K2-Thinking on Together accept `reasoning: { enabled }`
  // plus `temperature: 1.0` (thinking) or `0.6` (instant). The Moonshot-native
  // `thinking: { type: ... }` is silently ignored by Together (observed during development).
  // K2 / K2-Instruct are non-thinking; treat as "none".
  if (lc.includes("kimi-k2.6") || lc.includes("kimi-k2-6") || lc.includes("kimi-k2.5") || lc.includes("kimi-k2-5") || lc.includes("kimi-k2-thinking")) {
    return "kimi";
  }
  return "none";
}

type JsonAgentCallArgs = {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** null → fastest path (no thinking / no reasoning_effort).
   * "low"|"medium"|"high" → enable model's reasoning/thinking mode. */
  reasoning?: "low" | "medium" | "high" | null;
  /** Optional label included in logs to identify the call site */
  label?: string;
  /** Hard upper bound on wall-clock time. Default 45s — Kimi K2.6 thinking can take 15-71s. */
  timeoutMs?: number;
};

const DEFAULT_AGENT_TIMEOUT_MS = 45_000;

function describeError(err: unknown): Record<string, unknown> {
  if (err instanceof APIError) {
    return {
      kind: "APIError",
      status: err.status,
      code: err.code,
      type: err.type,
      message: err.message,
      body: (err as APIError & { error?: unknown }).error,
    };
  }
  if (err instanceof Error) {
    return { kind: err.name, message: err.message };
  }
  return { kind: "unknown", value: String(err) };
}

export async function jsonAgentCall<T>({
  system,
  user,
  model = AGENT_MODEL,
  temperature = 0.3,
  maxTokens = 4096,
  reasoning = null,
  label = "jsonAgentCall",
  timeoutMs = DEFAULT_AGENT_TIMEOUT_MS,
}: JsonAgentCallArgs): Promise<T> {
  const style = detectReasoningStyle(model);
  const thinkingEnabled = !!reasoning;

  // Per Together's Kimi docs: temperature=1.0 for thinking, 0.6 for instant.
  // For deepseek/none, respect caller-passed temperature.
  const effectiveTemp = style === "kimi" ? (thinkingEnabled ? 1.0 : 0.6) : temperature;

  const body: ChatCompletionCreateParamsNonStreaming & Record<string, unknown> = {
    model,
    temperature: effectiveTemp,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  if (style === "deepseek") {
    if (reasoning) {
      body.reasoning_effort = reasoning;
      body.reasoning = { enabled: true };
    }
  } else if (style === "kimi") {
    // Together's Kimi accepts `reasoning: { enabled: bool }`. Sending
    // `enabled: false` actually suppresses thinking; the Moonshot-native
    // `thinking: { type: ... }` is silently ignored.
    body.reasoning = { enabled: thinkingEnabled };
    body.top_p = 0.95; // per Together's Kimi quickstart
  }

  const started = Date.now();
  log.info(`${label} → POST /chat/completions`, {
    model,
    style,
    temperature: effectiveTemp,
    maxTokens,
    thinking:
      style === "kimi"
        ? thinkingEnabled
          ? "enabled"
          : "disabled"
        : style === "deepseek" && reasoning
          ? reasoning
          : null,
    userChars: user.length,
    systemChars: system.length,
  });

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const completion = await together.chat.completions.create(body, {
      signal: ac.signal,
      timeout: timeoutMs,
    });
    const choice = completion.choices[0];
    const raw = choice?.message?.content ?? "";
    const finishReason = choice?.finish_reason;
    const usage = completion.usage;
    log.info(`${label} ← ok`, {
      ms: Date.now() - started,
      model: completion.model,
      finishReason,
      usage,
      responseChars: raw.length,
    });
    if (!raw.trim()) {
      const reason =
        finishReason === "length"
          ? `model returned empty body and hit max_tokens=${maxTokens} — likely consumed budget on hidden reasoning; raise maxTokens or lower reasoning_effort`
          : `model returned empty body (finish_reason=${finishReason ?? "unknown"})`;
      log.error(`${label} ← empty content`, { reason, usage });
      throw new Error(reason);
    }
    try {
      return JSON.parse(raw) as T;
    } catch (parseErr) {
      log.error(`${label} JSON parse failed`, {
        firstChars: raw.slice(0, 400),
        err: describeError(parseErr),
      });
      throw parseErr;
    }
  } catch (err) {
    const aborted =
      ac.signal.aborted ||
      (err instanceof Error && (err.name === "AbortError" || err.message.includes("aborted")));
    log.error(`${label} ← failed`, {
      ms: Date.now() - started,
      model,
      aborted,
      timeoutMs,
      ...describeError(err),
    });
    if (aborted) {
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function jsonOrchestratorCall<T>(
  args: Omit<JsonAgentCallArgs, "model" | "temperature">,
): Promise<T> {
  return jsonAgentCall<T>({
    ...args,
    model: ORCHESTRATOR_MODEL,
    temperature: 0.5, // ignored if model is Kimi (pinned to 1.0)
    label: args.label ?? "orchestrator",
  });
}
