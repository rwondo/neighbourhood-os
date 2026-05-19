# RAG Knowledge Graph Swap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the hosted Supermemory API with a self-hosted RAG knowledge-graph backed by Supabase Postgres + pgvector. Keep the public interface (`seedNeighbourhoodProfile`, `queryNeighbourhood`, `writeOutcome`) identical so nothing in `src/lib/agents/*` changes.

**Architecture:** Four new tables — `memories` (raw docs), `chunks` (sentence-aware splits with `vector(3072)` embeddings + HNSW index), `entities` (cluster/activity/venue/season/outcome nodes), `edges` (typed relationships). Ingest pipeline: chunk → embed (OpenAI text-embedding-3-large) → store, plus a parallel LLM extraction pass (DeepSeek R1 via Together, JSON mode) that emits entities + edges. Retrieval: vector top-K filtered by `containerTag`, lexical boost via `pg_trgm`, and one-hop graph expansion on mentioned entities. Same callable surface from the orchestrator.

**Tech Stack:** Drizzle ORM + postgres-js, Supabase Postgres with `vector` + `pg_trgm` extensions, OpenAI SDK (text-embedding-3-large, 3072-dim), Together AI DeepSeek R1 (entity extractor in JSON mode). No external memory service.

**Hackathon ground rules:**
- Demo must never crash. Every ingest step is wrapped: chunk and embed are required, graph extraction degrades to "no entities" on failure.
- Same interface as the existing `src/lib/supermemory.ts` so the orchestrator and seed script are unchanged.
- No tests. Verification is `pnpm build` + `pnpm exec tsc --noEmit -p scripts/tsconfig.json`.
- Keep `src/lib/supermemory.ts` as a thin re-export shim that delegates to the new module (avoids touching every importer).

---

## Dependency Graph

```
Task 1 (schema + pgvector + pg_trgm) ──┐
                                       ├─► Task 5 (retriever)
Task 2 (chunker)                     ──┤
Task 3 (embedder)                    ──┤      │
Task 4 (entity/edge extractor)        ──┘      ▼
                                            Task 6 (public interface)
                                                  │
                                                  ▼
                                            Task 7 (shim + import sweep)
                                                  │
                                                  ▼
                                            Task 8 (build verify)
```

Tasks 2, 3, 4 are independent and dispatched in parallel after Task 1. Task 5 depends on 2 + 3 + schema. Task 6 wires them. Task 7 keeps `src/lib/supermemory.ts` working as a re-export. Task 8 is the final gate.

---

## File Structure

### Create
| Path | Responsibility |
|---|---|
| `src/lib/memory/chunker.ts` | Sentence-aware splitter, ~500-char windows with 80-char overlap, returns `Chunk[]` |
| `src/lib/memory/embedder.ts` | OpenAI text-embedding-3-large client + `embed(texts: string[])` batching |
| `src/lib/memory/extractor.ts` | LLM-driven entity + edge extractor — DeepSeek R1 JSON mode |
| `src/lib/memory/retriever.ts` | Hybrid retriever: pgvector top-K + `pg_trgm` boost + graph one-hop expansion |
| `src/lib/memory/index.ts` | Public interface: `seedNeighbourhoodProfile`, `queryNeighbourhood`, `writeOutcome`, `ingestDocument` |
| `src/lib/memory/types.ts` | Module-local types: `MemoryDoc`, `Chunk`, `Entity`, `Edge`, `RetrievalHit` |
| `drizzle/0001_pgvector_memory.sql` | Hand-written migration enabling `vector` + `pg_trgm` and creating the 4 tables with indexes |

### Modify
| Path | Reason |
|---|---|
| `src/lib/db/schema.ts` | Add `memories`, `chunks`, `entities`, `edges` Drizzle table definitions |
| `src/lib/supermemory.ts` | Replace internals with thin re-export from `@/lib/memory`. Keeps existing `import` paths working in `src/lib/agents/orchestrator.ts` and `scripts/seed-neighbourhoods.ts` |
| `.env.example` | Note that `SUPERMEMORY_API_KEY` is no longer required; `OPENAI_API_KEY` is now load-bearing |
| `src/lib/env.ts` | Soften `SUPERMEMORY_API_KEY` to optional, add `OPENAI_API_KEY` accessor |

### Delete
None — the shim keeps `supermemory.ts` for backwards compatibility.

---

## Task 1: Schema + Extensions + Drizzle Tables

**Files:**
- Create: `drizzle/0001_pgvector_memory.sql`
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Write `drizzle/0001_pgvector_memory.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS memories (
  id text PRIMARY KEY,
  container_tag text NOT NULL,
  kind text NOT NULL DEFAULT 'profile',
  content text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memories_container_idx ON memories (container_tag);
CREATE INDEX IF NOT EXISTS memories_kind_idx ON memories (kind);

CREATE TABLE IF NOT EXISTS chunks (
  id text PRIMARY KEY,
  memory_id text NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  container_tag text NOT NULL,
  position integer NOT NULL,
  content text NOT NULL,
  embedding vector(3072),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chunks_container_idx ON chunks (container_tag);
CREATE INDEX IF NOT EXISTS chunks_trgm_idx ON chunks USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx ON chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS entities (
  id text PRIMARY KEY,
  container_tag text NOT NULL,
  type text NOT NULL,
  name text NOT NULL,
  normalized_name text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (container_tag, type, normalized_name)
);
CREATE INDEX IF NOT EXISTS entities_container_idx ON entities (container_tag);
CREATE INDEX IF NOT EXISTS entities_normalized_idx ON entities (normalized_name);

CREATE TABLE IF NOT EXISTS edges (
  id text PRIMARY KEY,
  container_tag text NOT NULL,
  source_entity text NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_entity text NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relation text NOT NULL,
  weight real NOT NULL DEFAULT 1,
  source_memory_id text REFERENCES memories(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS edges_container_idx ON edges (container_tag);
CREATE INDEX IF NOT EXISTS edges_source_idx ON edges (source_entity);
CREATE INDEX IF NOT EXISTS edges_target_idx ON edges (target_entity);
CREATE INDEX IF NOT EXISTS edges_relation_idx ON edges (relation);
```

- [ ] **Step 2: Add Drizzle definitions to `src/lib/db/schema.ts`**

Append to the existing file (do not remove the existing tables). The `vector` type isn't first-class in `drizzle-orm` 0.45's pg-core for arbitrary dims, so model it as `text` for the schema-level type and use raw SQL when writing/reading. Keep the column name `embedding` so SQL queries match.

```ts
// === Memory / RAG knowledge graph ===
export const memories = pgTable("memories", {
  id: text("id").primaryKey(),
  containerTag: text("container_tag").notNull(),
  kind: text("kind").notNull().default("profile"),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chunks = pgTable("chunks", {
  id: text("id").primaryKey(),
  memoryId: text("memory_id").notNull(),
  containerTag: text("container_tag").notNull(),
  position: integer("position").notNull(),
  content: text("content").notNull(),
  // embedding is vector(3072); managed via raw SQL since drizzle-orm 0.45 lacks a typed vector column for 3072 dims
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const entities = pgTable("entities", {
  id: text("id").primaryKey(),
  containerTag: text("container_tag").notNull(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const edges = pgTable("edges", {
  id: text("id").primaryKey(),
  containerTag: text("container_tag").notNull(),
  sourceEntity: text("source_entity").notNull(),
  targetEntity: text("target_entity").notNull(),
  relation: text("relation").notNull(),
  weight: real("weight").notNull().default(1),
  sourceMemoryId: text("source_memory_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Memory = typeof memories.$inferSelect;
export type ChunkRow = typeof chunks.$inferSelect;
export type Entity = typeof entities.$inferSelect;
export type EdgeRow = typeof edges.$inferSelect;
```

- [ ] **Step 3: Soften env access**

Modify `src/lib/env.ts` — change `SUPERMEMORY_API_KEY` from required to optional, and add `OPENAI_API_KEY`:

```ts
SUPERMEMORY_API_KEY: () => process.env.SUPERMEMORY_API_KEY,
OPENAI_API_KEY: () => need("OPENAI_API_KEY"),
```

(The shim in Task 7 must not call `env.SUPERMEMORY_API_KEY()` to throw — it's just kept around for any leftover code paths.)

- [ ] **Step 4: Note in `.env.example`**

Add a comment line near `SUPERMEMORY_API_KEY`:

```
# SUPERMEMORY_API_KEY is no longer used — memory is self-hosted on Supabase
SUPERMEMORY_API_KEY=
```

And ensure `OPENAI_API_KEY` has the comment "required for text-embedding-3-large".

- [ ] **Step 5: Build to verify schema additions compile**

Run: `pnpm build`
Expected: succeeds; new tables compile; nothing else broken.

- [ ] **Step 6: Apply migration manually (skipped if no DB)**

Manual: run the SQL in `drizzle/0001_pgvector_memory.sql` in Supabase SQL editor.

---

## Task 2: Chunker

**Files:**
- Create: `src/lib/memory/types.ts`
- Create: `src/lib/memory/chunker.ts`

- [ ] **Step 1: Write `src/lib/memory/types.ts`**

```ts
export type MemoryDoc = {
  id: string;
  containerTag: string;
  kind: "profile" | "outcome" | "note";
  content: string;
  metadata?: Record<string, unknown>;
};

export type Chunk = {
  id: string;
  memoryId: string;
  containerTag: string;
  position: number;
  content: string;
};

export type Entity = {
  id: string;
  containerTag: string;
  type: "cluster" | "activity" | "venue" | "season" | "outcome" | "neighbourhood";
  name: string;
  normalizedName: string;
  metadata?: Record<string, unknown>;
};

export type Edge = {
  id: string;
  containerTag: string;
  sourceEntity: string;
  targetEntity: string;
  relation: "attended" | "located_at" | "in_season" | "resulted_in" | "targets" | "mentions";
  weight: number;
  sourceMemoryId?: string;
  metadata?: Record<string, unknown>;
};

export type RetrievalHit = {
  content: string;
  memoryId: string;
  containerTag: string;
  score: number;
  source: "vector" | "lexical" | "graph";
  metadata?: Record<string, unknown>;
};
```

- [ ] **Step 2: Write `src/lib/memory/chunker.ts`**

```ts
import type { Chunk } from "./types";

const TARGET = 500;
const OVERLAP = 80;
const SENTENCE_BREAK = /([.!?])\s+(?=[A-Z0-9])/g;

export function chunkText({
  memoryId,
  containerTag,
  text,
}: {
  memoryId: string;
  containerTag: string;
  text: string;
}): Chunk[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];
  const sentences = splitSentences(normalized);

  const out: Chunk[] = [];
  let buffer = "";
  let position = 0;
  for (const s of sentences) {
    if (buffer.length + s.length + 1 <= TARGET) {
      buffer = buffer ? `${buffer} ${s}` : s;
      continue;
    }
    if (buffer) {
      out.push(makeChunk(memoryId, containerTag, position++, buffer));
      const tail = buffer.slice(Math.max(0, buffer.length - OVERLAP));
      buffer = tail ? `${tail} ${s}` : s;
    } else {
      out.push(makeChunk(memoryId, containerTag, position++, s.slice(0, TARGET)));
      buffer = s.length > TARGET ? s.slice(TARGET - OVERLAP) : "";
    }
  }
  if (buffer.trim()) out.push(makeChunk(memoryId, containerTag, position++, buffer));
  return out;
}

function splitSentences(text: string): string[] {
  const parts = text.split(SENTENCE_BREAK);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const body = parts[i];
    const punct = parts[i + 1] ?? "";
    const sentence = `${body ?? ""}${punct}`.trim();
    if (sentence) out.push(sentence);
  }
  return out;
}

function makeChunk(memoryId: string, containerTag: string, position: number, content: string): Chunk {
  return {
    id: `chk_${memoryId}_${position}`,
    memoryId,
    containerTag,
    position,
    content: content.trim(),
  };
}
```

- [ ] **Step 3: Build to verify**

Run: `pnpm build`
Expected: succeeds.

---

## Task 3: Embedder

**Files:**
- Create: `src/lib/memory/embedder.ts`

- [ ] **Step 1: Write `src/lib/memory/embedder.ts`**

```ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "missing-openai-key",
});

const MODEL = "text-embedding-3-large";
const BATCH = 16;

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += BATCH) {
    const slice = inputs.slice(i, i + BATCH);
    const res = await client.embeddings.create({ model: MODEL, input: slice });
    for (const d of res.data) out.push(d.embedding as number[]);
  }
  return out;
}

export function vectorLiteral(vec: number[]): string {
  return `[${vec.map((n) => Number.isFinite(n) ? n.toFixed(6) : "0").join(",")}]`;
}
```

- [ ] **Step 2: Build to verify**

Run: `pnpm build`
Expected: succeeds.

---

## Task 4: Entity + Edge Extractor

**Files:**
- Create: `src/lib/memory/extractor.ts`

- [ ] **Step 1: Write `src/lib/memory/extractor.ts`**

```ts
import { jsonAgentCall } from "@/lib/together";
import type { Entity, Edge } from "./types";

const SYSTEM = `You are a knowledge-graph extractor for a Dutch municipal cohesion platform.
You read a short memory document about a neighbourhood (demographic profile, intervention outcome, or activity note) and emit structured entities and edges.

Allowed entity types: cluster, activity, venue, season, outcome, neighbourhood.
Allowed edge relations: attended, located_at, in_season, resulted_in, targets, mentions.

Rules:
- Normalised names are lower-case ASCII, words separated by single spaces. Example: "Elderly Dutch 65+" -> "elderly dutch 65".
- Output strictly the JSON schema. No prose.
- If unsure, omit. Better to under-extract than fabricate.

Schema:
{
  "entities": [{ "type": "cluster|activity|venue|season|outcome|neighbourhood", "name": "string", "normalized_name": "string" }],
  "edges": [{ "source": "normalized_name", "target": "normalized_name", "relation": "attended|located_at|in_season|resulted_in|targets|mentions", "weight": number }]
}`;

type ExtractorOut = {
  entities: { type: Entity["type"]; name: string; normalized_name: string }[];
  edges: { source: string; target: string; relation: Edge["relation"]; weight?: number }[];
};

export async function extractGraph({
  containerTag,
  memoryId,
  content,
}: {
  containerTag: string;
  memoryId: string;
  content: string;
}): Promise<{ entities: Entity[]; edges: Edge[] }> {
  const out = await jsonAgentCall<ExtractorOut>({
    system: SYSTEM,
    user: `Container: ${containerTag}\nMemory id: ${memoryId}\nContent:\n${content}`,
  }).catch(() => ({ entities: [], edges: [] }) as ExtractorOut);

  const entities: Entity[] = (out.entities ?? []).map((e) => ({
    id: `ent_${containerTag}_${e.type}_${slug(e.normalized_name)}`,
    containerTag,
    type: e.type,
    name: e.name,
    normalizedName: e.normalized_name,
  }));
  const entityByNorm = new Map(entities.map((e) => [e.normalizedName, e]));
  const edges: Edge[] = (out.edges ?? [])
    .map((edge): Edge | null => {
      const src = entityByNorm.get(edge.source);
      const tgt = entityByNorm.get(edge.target);
      if (!src || !tgt) return null;
      return {
        id: `edg_${containerTag}_${src.id}_${edge.relation}_${tgt.id}`,
        containerTag,
        sourceEntity: src.id,
        targetEntity: tgt.id,
        relation: edge.relation,
        weight: edge.weight ?? 1,
        sourceMemoryId: memoryId,
      };
    })
    .filter((e): e is Edge => e !== null);
  return { entities, edges };
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
```

- [ ] **Step 2: Build to verify**

Run: `pnpm build`
Expected: succeeds.

---

## Task 5: Retriever

**Files:**
- Create: `src/lib/memory/retriever.ts`

- [ ] **Step 1: Write `src/lib/memory/retriever.ts`**

```ts
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { embedTexts, vectorLiteral } from "./embedder";
import type { RetrievalHit } from "./types";

type SearchOptions = {
  containerTag: string;
  query: string;
  k?: number;
  graphExpand?: boolean;
};

export async function searchMemory({ containerTag, query, k = 4, graphExpand = true }: SearchOptions): Promise<RetrievalHit[]> {
  const [embedding] = await embedTexts([query]).catch(() => [[] as number[]]);
  const vec = embedding.length ? vectorLiteral(embedding) : null;

  const vectorHits = vec
    ? await db.execute<{ content: string; memory_id: string; container_tag: string; distance: number }>(sql`
        SELECT content, memory_id, container_tag, (embedding <=> ${vec}::vector) AS distance
        FROM chunks
        WHERE container_tag = ${containerTag} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vec}::vector
        LIMIT ${k}
      `)
    : { rows: [] as { content: string; memory_id: string; container_tag: string; distance: number }[] };

  const lexicalHits = await db.execute<{ content: string; memory_id: string; container_tag: string; sim: number }>(sql`
      SELECT content, memory_id, container_tag, similarity(content, ${query}) AS sim
      FROM chunks
      WHERE container_tag = ${containerTag} AND content % ${query}
      ORDER BY sim DESC
      LIMIT ${k}
    `);

  const hits: RetrievalHit[] = [];
  for (const r of vectorHits.rows ?? []) {
    hits.push({ content: r.content, memoryId: r.memory_id, containerTag: r.container_tag, score: 1 - r.distance, source: "vector" });
  }
  for (const r of lexicalHits.rows ?? []) {
    hits.push({ content: r.content, memoryId: r.memory_id, containerTag: r.container_tag, score: r.sim, source: "lexical" });
  }

  if (graphExpand) {
    const expansion = await db.execute<{ content: string; memory_id: string; container_tag: string }>(sql`
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
      `);
    for (const r of expansion.rows ?? []) {
      hits.push({ content: r.content, memoryId: r.memory_id, containerTag: r.container_tag, score: 0.5, source: "graph" });
    }
  }

  return dedupe(hits).slice(0, k * 2);
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
```

- [ ] **Step 2: Build to verify**

Run: `pnpm build`
Expected: succeeds.

---

## Task 6: Public Interface

**Files:**
- Create: `src/lib/memory/index.ts`

- [ ] **Step 1: Write `src/lib/memory/index.ts`**

```ts
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
```

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: succeeds.

---

## Task 7: Shim and Import Sweep

**Files:**
- Modify: `src/lib/supermemory.ts`

- [ ] **Step 1: Replace `src/lib/supermemory.ts` entirely with a re-export shim**

```ts
export {
  containerForBuurt,
  seedNeighbourhoodProfile,
  queryNeighbourhood,
  writeOutcome,
} from "@/lib/memory";
```

This keeps `src/lib/agents/orchestrator.ts`, `src/lib/agents/outcome.ts`, and `scripts/seed-neighbourhoods.ts` working unmodified. The orchestrator's call sites use the same names with the same signatures — the orchestrator does `queryNeighbourhood(buurtCode, "demographic profile and risk factors").catch(() => [])`, and the new implementation returns `RetrievalHit[]` whose `.content` field the orchestrator already reads.

- [ ] **Step 2: Update the orchestrator's typed access**

`src/lib/agents/orchestrator.ts` currently casts query results with `(p: { content?: string }) => ...`. The new `RetrievalHit` has a guaranteed `content: string`, so the casts continue to work. **No changes required.** Verify by reading the orchestrator file and confirming the access pattern.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: succeeds; route table unchanged.

---

## Task 8: Verification

- [ ] **Step 1: `pnpm build`** — succeeds, route table unchanged.
- [ ] **Step 2: `pnpm exec tsc --noEmit -p scripts/tsconfig.json`** — zero errors (seed script still typechecks against the new shim).
- [ ] **Step 3: `pnpm lint`** — same baseline error count as before the swap (no new errors introduced).

---

## Self-Review

1. **Spec coverage:** every Supermemory call site (`seedNeighbourhoodProfile`, `queryNeighbourhood`, `writeOutcome`, `containerForBuurt`) is re-exported from `@/lib/memory`.
2. **No placeholders:** every step contains full runnable code.
3. **Type consistency:** `RetrievalHit.content` is non-optional; `Entity.type` matches the union in the extractor's allowed types; the `edges` table column names (`source_entity`, `target_entity`) match the Drizzle definition.
4. **Demo safety:** `embedTexts` and `extractGraph` each have `.catch()` paths so a failed OpenAI or Together call degrades to lexical-only search instead of crashing ingest.
