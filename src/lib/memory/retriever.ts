import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { makeLogger } from "@/lib/log";
import { embedTexts, vectorLiteral } from "./embedder";
import type { RetrievalHit } from "./types";

const log = makeLogger("memory:retriever");

type SearchOptions = {
  containerTag: string;
  query: string;
  k?: number;
  graphExpand?: boolean;
};

export async function searchMemory({ containerTag, query, k = 4, graphExpand = true }: SearchOptions): Promise<RetrievalHit[]> {
  const started = Date.now();
  log.info("search", { containerTag, query: query.slice(0, 80), k, graphExpand });

  const [embedding] = await embedTexts([query]).catch((err) => {
    log.warn("embed failed — vector search will be skipped", err);
    return [[] as number[]];
  });
  const vec = embedding.length ? vectorLiteral(embedding) : null;
  if (!vec) log.warn("no embedding produced — running lexical+graph only", { containerTag });

  type VectorRow = { content: string; memory_id: string; container_tag: string; distance: number };
  type LexicalRow = { content: string; memory_id: string; container_tag: string; sim: number };
  type GraphRow = { content: string; memory_id: string; container_tag: string };

  const vectorHits: VectorRow[] = vec
    ? ((await db.execute<VectorRow>(sql`
        SELECT content, memory_id, container_tag, (embedding <=> ${vec}::vector) AS distance
        FROM chunks
        WHERE container_tag = ${containerTag} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vec}::vector
        LIMIT ${k}
      `)) as unknown as VectorRow[])
    : [];

  const lexicalHits = (await db.execute<LexicalRow>(sql`
      SELECT content, memory_id, container_tag, similarity(content, ${query}) AS sim
      FROM chunks
      WHERE container_tag = ${containerTag} AND content % ${query}
      ORDER BY sim DESC
      LIMIT ${k}
    `)) as unknown as LexicalRow[];

  const hits: RetrievalHit[] = [];
  for (const r of vectorHits ?? []) {
    hits.push({ content: r.content, memoryId: r.memory_id, containerTag: r.container_tag, score: 1 - r.distance, source: "vector" });
  }
  for (const r of lexicalHits ?? []) {
    hits.push({ content: r.content, memoryId: r.memory_id, containerTag: r.container_tag, score: r.sim, source: "lexical" });
  }

  if (graphExpand) {
    const expansion = (await db.execute<GraphRow>(sql`
        SELECT m.content, m.id AS memory_id, m.container_tag
        FROM edges e
        JOIN memories m ON m.id = e.source_memory_id
        WHERE e.container_tag = ${containerTag}
          AND EXISTS (
            SELECT 1 FROM entities en
            WHERE en.container_tag = ${containerTag}
              AND (en.id = e.source_entity OR en.id = e.target_entity)
              AND en.normalized_name ILIKE ${"%" + query.toLowerCase() + "%"}
          )
        LIMIT ${k}
      `)) as unknown as GraphRow[];
    for (const r of expansion ?? []) {
      hits.push({ content: r.content, memoryId: r.memory_id, containerTag: r.container_tag, score: 0.5, source: "graph" });
    }
  }

  const deduped = dedupe(hits).slice(0, k * 2);
  log.info("search result", {
    containerTag,
    ms: Date.now() - started,
    rawHits: hits.length,
    deduped: deduped.length,
    vector: vectorHits.length,
    lexical: lexicalHits.length,
    bySource: deduped.reduce<Record<string, number>>((acc, h) => {
      acc[h.source] = (acc[h.source] ?? 0) + 1;
      return acc;
    }, {}),
  });
  return deduped;
}

function dedupe(hits: RetrievalHit[]): RetrievalHit[] {
  const map = new Map<string, RetrievalHit>();
  for (const h of hits) {
    const key = `${h.memoryId}:${h.content.slice(0, 40)}`;
    const prev = map.get(key);
    if (!prev || h.score > prev.score) map.set(key, h);
  }
  return [...map.values()].sort((a, b) => b.score - a.score);
}
