import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "missing-openai-key",
});

const MODEL = "text-embedding-3-large";
const DIMENSIONS = 1536;
const BATCH = 16;

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += BATCH) {
    const slice = inputs.slice(i, i + BATCH);
    const res = await client.embeddings.create({ model: MODEL, input: slice, dimensions: DIMENSIONS });
    for (const d of res.data) out.push(d.embedding as number[]);
  }
  return out;
}

export function vectorLiteral(vec: number[]): string {
  return `[${vec.map((n) => Number.isFinite(n) ? n.toFixed(6) : "0").join(",")}]`;
}
