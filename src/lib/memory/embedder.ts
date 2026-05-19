import OpenAI, { APIError } from "openai";
import { makeLogger } from "@/lib/log";

const log = makeLogger("memory:embedder");

if (!process.env.OPENAI_API_KEY) {
  log.warn("OPENAI_API_KEY is not set — embeddings will fail and Supermemory vector search will be empty");
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "missing-openai-key",
});

const MODEL = "text-embedding-3-large";
const DIMENSIONS = 1536;
const BATCH = 16;

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const started = Date.now();
  const out: number[][] = [];
  try {
    for (let i = 0; i < inputs.length; i += BATCH) {
      const slice = inputs.slice(i, i + BATCH);
      const res = await client.embeddings.create({ model: MODEL, input: slice, dimensions: DIMENSIONS });
      for (const d of res.data) out.push(d.embedding as number[]);
    }
    log.debug("embed ok", { count: out.length, dims: out[0]?.length ?? 0, ms: Date.now() - started });
    return out;
  } catch (err) {
    if (err instanceof APIError) {
      log.error("embed failed", {
        status: err.status,
        code: err.code,
        type: err.type,
        message: err.message,
        body: (err as APIError & { error?: unknown }).error,
      });
    } else {
      log.error("embed failed", err);
    }
    throw err;
  }
}

export function vectorLiteral(vec: number[]): string {
  return `[${vec.map((n) => Number.isFinite(n) ? n.toFixed(6) : "0").join(",")}]`;
}
