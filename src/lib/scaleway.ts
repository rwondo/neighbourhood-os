import OpenAI from "openai";
import { env } from "@/lib/env";

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
  return JSON.parse(completion.choices[0]?.message?.content ?? "{}") as T;
}

export async function withFallback<T>(primary: () => Promise<T>): Promise<T> {
  try {
    return await primary();
  } catch (err) {
    if (!scaleway) throw err;
    console.warn("[ai] Together failed, using Scaleway fallback", err);
    throw err;
  }
}
