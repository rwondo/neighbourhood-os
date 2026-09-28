import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { memories, chunks, entities, edges } from "@/lib/db/schema";
import { makeLogger } from "@/lib/log";
import { chunkText } from "./chunker";
import { embedTexts, vectorLiteral } from "./embedder";
import { extractGraph } from "./extractor";
import { searchMemory } from "./retriever";
import type { RetrievalHit } from "./types";

const log = makeLogger("memory");

export function containerForBuurt(buurtCode: string): string {
  return `buurt_${buurtCode}`;
}

// Borough-scoped container. The worst-CDI buurt within a borough rotates as
// CDI is recomputed, so a buurt-keyed container often misses. The borough is
// stable across recomputes and matches how the dashboard groups data.
export function containerForBorough(city: string, borough: string): string {
  const slug = borough
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `borough_${city}_${slug}`;
}

export async function ingestDocument({
  containerTag,
  kind,
  content,
  metadata,
  id,
  extractGraph: shouldExtractGraph = true,
}: {
  containerTag: string;
  kind: "profile" | "outcome" | "note";
  content: string;
  metadata?: Record<string, unknown>;
  id?: string;
  /** If false, skips the LLM graph extraction call (much faster bulk ingestion;
   * retrieval degrades from vector+lexical+graph to vector+lexical only). */
  extractGraph?: boolean;
}): Promise<{ memoryId: string }> {
  const memoryId = id ?? `mem_${containerTag}_${Date.now()}`;
  await getDb().insert(memories).values({ id: memoryId, containerTag, kind, content, metadata: metadata ?? null }).onConflictDoUpdate({
    target: memories.id,
    set: { content, metadata: metadata ?? null },
  });

  const pieces = chunkText({ memoryId, containerTag, text: content });
  if (pieces.length) {
    const vectors = await embedTexts(pieces.map((p) => p.content)).catch(() => [] as number[][]);
    for (let i = 0; i < pieces.length; i++) {
      const c = pieces[i];
      const vec = vectors[i];
      await getDb().insert(chunks).values({ id: c.id, memoryId, containerTag, position: c.position, content: c.content }).onConflictDoUpdate({
        target: chunks.id,
        set: { content: c.content },
      });
      if (vec && vec.length) {
        await getDb().execute(sql`UPDATE chunks SET embedding = ${vectorLiteral(vec)}::vector WHERE id = ${c.id}`);
      }
    }
  }

  if (shouldExtractGraph) {
    const graph = await extractGraph({ containerTag, memoryId, content }).catch(() => ({ entities: [], edges: [] }));
    for (const e of graph.entities) {
      await getDb()
        .insert(entities)
        .values({ id: e.id, containerTag: e.containerTag, type: e.type, name: e.name, normalizedName: e.normalizedName, metadata: e.metadata ?? null })
        .onConflictDoNothing();
    }
    for (const edge of graph.edges) {
      await getDb()
        .insert(edges)
        .values({ id: edge.id, containerTag: edge.containerTag, sourceEntity: edge.sourceEntity, targetEntity: edge.targetEntity, relation: edge.relation, weight: edge.weight, sourceMemoryId: edge.sourceMemoryId ?? null, metadata: edge.metadata ?? null })
        .onConflictDoNothing();
    }
  }

  return { memoryId };
}

export async function seedNeighbourhoodProfile(
  buurtCode: string,
  markdown: string,
  meta: Record<string, unknown>,
  options: { extractGraph?: boolean; borough?: string; city?: string } = {},
) {
  const result = await ingestDocument({
    containerTag: containerForBuurt(buurtCode),
    kind: "profile",
    content: markdown,
    metadata: { ...meta, kind: "profile" },
    extractGraph: options.extractGraph,
  });
  // Also write to the borough-scoped container so demo lookups via a different
  // buurt in the same borough still hit memory. We re-use the markdown body —
  // the worst-CDI buurt's demographics are representative of the borough.
  if (options.borough && options.city) {
    await ingestDocument({
      containerTag: containerForBorough(options.city, options.borough),
      kind: "profile",
      content: markdown,
      metadata: { ...meta, kind: "profile", scope: "borough" },
      extractGraph: options.extractGraph,
    }).catch((err) => {
      log.warn("borough-container seed failed", {
        borough: options.borough,
        city: options.city,
        err: err instanceof Error ? err.message : err,
      });
    });
  }
  return result;
}

async function probeContainer(containerTag: string, timeoutMs = 3000): Promise<"empty" | "populated" | "unknown"> {
  const probe = getDb().execute<{ exists: boolean }>(
    sql`SELECT EXISTS(SELECT 1 FROM memories WHERE container_tag = ${containerTag}) AS exists`,
  );
  try {
    const result = (await Promise.race([
      probe,
      new Promise<never>((_, rj) => setTimeout(() => rj(new Error("probe timeout")), timeoutMs)),
    ])) as unknown as Array<{ exists: boolean }>;
    return result[0]?.exists ? "populated" : "empty";
  } catch (err) {
    log.warn("memory existence probe failed — defaulting to search", { containerTag, err: err instanceof Error ? err.message : err });
    return "unknown";
  }
}

export type NeighbourhoodQueryOptions = {
  borough?: string | null;
  city?: string | null;
};

export async function queryNeighbourhood(
  buurtCode: string,
  q: string,
  options: NeighbourhoodQueryOptions | number = {},
  legacyLimit?: number,
): Promise<RetrievalHit[]> {
  // Backwards-compat: previous signature was (buurtCode, q, limit). If the
  // third arg is a number, treat it as limit.
  const opts: NeighbourhoodQueryOptions =
    typeof options === "number" ? {} : options;
  const limit =
    typeof options === "number" ? options : (legacyLimit ?? 4);

  const buurtContainer = containerForBuurt(buurtCode);
  const boroughContainer =
    opts.borough && opts.city ? containerForBorough(opts.city, opts.borough) : null;

  const containers = boroughContainer ? [buurtContainer, boroughContainer] : [buurtContainer];
  const probes = await Promise.all(containers.map((c) => probeContainer(c)));
  const populated = containers.filter((_, i) => probes[i] === "populated");
  const unknownState = containers.filter((_, i) => probes[i] === "unknown");
  const searchSet = [...populated, ...unknownState];

  log.info("queryNeighbourhood", {
    buurtCode,
    borough: opts.borough ?? null,
    containers,
    states: Object.fromEntries(containers.map((c, i) => [c, probes[i]])),
    searching: searchSet,
    query: q.slice(0, 80),
  });

  if (searchSet.length === 0) {
    log.warn(
      `no memories seeded for ${containers.join(" or ")} — short-circuiting search. ` +
        `Run \`pnpm seed:memory\` to populate borough containers.`,
    );
    return [];
  }

  const perContainer = Math.max(2, Math.ceil(limit / searchSet.length));
  const results = await Promise.all(
    searchSet.map((containerTag) => searchMemory({ containerTag, query: q, k: perContainer })),
  );
  // Flatten + dedupe by memoryId, keep top score wins.
  const merged = new Map<string, RetrievalHit>();
  for (const hits of results) {
    for (const h of hits) {
      const key = `${h.memoryId}:${h.content.slice(0, 40)}`;
      const prev = merged.get(key);
      if (!prev || h.score > prev.score) merged.set(key, h);
    }
  }
  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function writeOutcome(
  buurtCode: string,
  outcome: Record<string, unknown>,
  options: { extractGraph?: boolean; borough?: string; city?: string } = {},
) {
  const markdown = `## Outcome ${new Date().toISOString()}\n\n\`\`\`json\n${JSON.stringify(outcome, null, 2)}\n\`\`\``;
  const result = await ingestDocument({
    containerTag: containerForBuurt(buurtCode),
    kind: "outcome",
    content: markdown,
    metadata: { ...outcome, kind: "outcome" },
    extractGraph: options.extractGraph,
  });
  if (options.borough && options.city) {
    await ingestDocument({
      containerTag: containerForBorough(options.city, options.borough),
      kind: "outcome",
      content: markdown,
      metadata: { ...outcome, kind: "outcome", scope: "borough" },
      extractGraph: options.extractGraph,
    }).catch((err) => {
      log.warn("borough-container outcome write failed", {
        borough: options.borough,
        city: options.city,
        err: err instanceof Error ? err.message : err,
      });
    });
  }
  return result;
}
