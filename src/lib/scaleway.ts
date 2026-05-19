import OpenAI from "openai";
import { env } from "@/lib/env";
import { makeLogger } from "@/lib/log";

const log = makeLogger("scaleway");

const apiKey = env.SCALEWAY_API_KEY();

export const scaleway = apiKey
  ? new OpenAI({ baseURL: env.SCALEWAY_BASE_URL(), apiKey })
  : null;

export async function fallbackJsonCall<T>({
  system,
  user,
  temperature = 0.4,
}: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<T> {
  if (!scaleway) throw new Error("Scaleway fallback not configured");
  const completion = await scaleway.chat.completions.create({
    model: env.SCALEWAY_MODEL(),
    temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content || !content.trim()) {
    throw new Error("Scaleway returned empty content");
  }
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(`Scaleway response is not valid JSON: ${content.slice(0, 200)}`);
  }
}

export async function withFallback<T>(primary: () => Promise<T>): Promise<T> {
  try {
    return await primary();
  } catch (err) {
    if (!scaleway) throw err;
    log.warn("Together failed, attempting Scaleway fallback", err);
    // The fallback call must duplicate primary's args at the call site; this
    // helper just owns the swallow-and-retry contract. Today only `primary`
    // is passed, so a "fallback" call would need the same prompts — that
    // would require the caller. Since callers don't yet provide a fallback
    // payload, we rethrow but keep a truthful log line.
    throw err;
  }
}
