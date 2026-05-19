import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { memories, chunks, entities, edges } from "@/lib/db/schema";
import { chunkText } from "./chunker";
import { embedTexts, vectorLiteral } from "./embedder";
import { extractGraph } from "./extractor";
import { searchMemory } from "./retriever";
import type { RetrievalHit } from "./types";

export function containerForBuurt(buurtCode: string): string {
  return `buurt_${buurtCode}`;
}

export async function ingestDocument({
  containerTag,
  kind,
  content,
  metadata,
  id,
}: {
  containerTag: string;
  kind: "profile" | "outcome" | "note";
  content: string;
  metadata?: Record<string, unknown>;
  id?: string;
}): Promise<{ memoryId: string }> {
  const memoryId = id ?? `mem_${containerTag}_${Date.now()}`;
  await db.insert(memories).values({ id: memoryId, containerTag, kind, content, metadata: metadata ?? null }).onConflictDoUpdate({
    target: memories.id,
    set: { content, metadata: metadata ?? null },
  });

  const pieces = chunkText({ memoryId, containerTag, text: content });
  if (pieces.length) {
    const vectors = await embedTexts(pieces.map((p) => p.content)).catch(() => [] as number[][]);
    for (let i = 0; i < pieces.length; i++) {
      const c = pieces[i];
      const vec = vectors[i];
      await db.insert(chunks).values({ id: c.id, memoryId, containerTag, position: c.position, content: c.content }).onConflictDoUpdate({
        target: chunks.id,
        set: { content: c.content },
      });
      if (vec && vec.length) {
        await db.execute(sql`UPDATE chunks SET embedding = ${vectorLiteral(vec)}::vector WHERE id = ${c.id}`);
      }
    }
  }

  const graph = await extractGraph({ containerTag, memoryId, content }).catch(() => ({ entities: [], edges: [] }));
  for (const e of graph.entities) {
    await db
      .insert(entities)
      .values({ id: e.id, containerTag: e.containerTag, type: e.type, name: e.name, normalizedName: e.normalizedName, metadata: e.metadata ?? null })
      .onConflictDoNothing();
  }
  for (const edge of graph.edges) {
    await db
      .insert(edges)
      .values({ id: edge.id, containerTag: edge.containerTag, sourceEntity: edge.sourceEntity, targetEntity: edge.targetEntity, relation: edge.relation, weight: edge.weight, sourceMemoryId: edge.sourceMemoryId ?? null, metadata: edge.metadata ?? null })
      .onConflictDoNothing();
  }

  return { memoryId };
}

export async function seedNeighbourhoodProfile(buurtCode: string, markdown: string, meta: Record<string, unknown>) {
  return ingestDocument({
    containerTag: containerForBuurt(buurtCode),
    kind: "profile",
    content: markdown,
    metadata: { ...meta, kind: "profile" },
  });
}

export async function queryNeighbourhood(buurtCode: string, q: string, limit = 4): Promise<RetrievalHit[]> {
  return searchMemory({ containerTag: containerForBuurt(buurtCode), query: q, k: limit });
}

export async function writeOutcome(buurtCode: string, outcome: Record<string, unknown>) {
  const markdown = `## Outcome ${new Date().toISOString()}\n\n\`\`\`json\n${JSON.stringify(outcome, null, 2)}\n\`\`\``;
  return ingestDocument({
    containerTag: containerForBuurt(buurtCode),
    kind: "outcome",
    content: markdown,
    metadata: { ...outcome, kind: "outcome" },
  });
}
