import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";

export const ORCHESTRATOR_MODEL = "moonshotai/Kimi-K2.6-Instruct";
export const AGENT_MODEL = "deepseek-ai/DeepSeek-V4-Pro";

export const together = new OpenAI({
  baseURL: "https://api.together.xyz/v1",
  apiKey: process.env.TOGETHER_AI_API_KEY ?? "missing-together-key",
});

type JsonAgentCallArgs = {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  reasoning?: "low" | "medium" | "high" | null;
};

function isReasoningModel(model: string): boolean {
  return model.toLowerCase().includes("v4-pro") || model.toLowerCase().includes("r1");
}

export async function jsonAgentCall<T>({
  system,
  user,
  model = AGENT_MODEL,
  temperature = 0.3,
  maxTokens = 2048,
  reasoning = "high",
}: JsonAgentCallArgs): Promise<T> {
  const body: ChatCompletionCreateParamsNonStreaming & Record<string, unknown> = {
    model,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (reasoning && isReasoningModel(model)) {
    body.reasoning_effort = reasoning;
    body.reasoning = { enabled: true };
  }
  const completion = await together.chat.completions.create(body);
  const raw = completion.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as T;
}

export async function jsonOrchestratorCall<T>(args: Omit<JsonAgentCallArgs, "model" | "temperature">): Promise<T> {
  return jsonAgentCall<T>({ ...args, model: ORCHESTRATOR_MODEL, temperature: 0.5 });
}
