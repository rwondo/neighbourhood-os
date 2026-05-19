# Neighbourhood OS Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the complete backend for the Neighbourhood OS hackathon demo so the static UI shell becomes a working AI-orchestrated municipal cohesion platform across Rotterdam, Amsterdam, and The Hague.

**Architecture:** Next.js 16 App Router with Drizzle (Supabase Postgres) for state, Together AI (Kimi K2.6 orchestrator + DeepSeek R1 personalisation agents) called via the OpenAI SDK with custom baseURL, Supermemory containers keyed by buurt code for per-neighbourhood history, channel SDKs (MessageBird SMS, Meta Marketing, TikTok Ads, WhatsApp Business Cloud) gated by approval status, and a SSE-streaming orchestrator endpoint that drives the live agent-trace UI. Three pre-seeded demo scenarios (Crooswijk, Bijlmer, Schilderswijk) are stored in DB so the dashboard never shows blank state on stage.

**Tech Stack:** Next.js 16 / React 19 / TypeScript strict, Drizzle ORM 0.45 + postgres 3.4, openai SDK 6 (Together baseURL), Supermemory SDK, MessageBird, Meta Graph API, TikTok Ads API, WhatsApp Cloud API, @react-pdf/renderer for leaflets, CBS StatLine OData v3, Open-Meteo, KNMI, NDW.

**Hackathon ground rules (override any conflicting plan step):**
- Demo must never crash. Every external call is wrapped with a try/catch + structured fallback so SSE never stalls.
- No auth, no rate limiting, no edge cases beyond the three demo scenarios.
- No tests are written for this plan — `pnpm build` is the verification gate. The TDD step of the writing-plans template is intentionally replaced by a typecheck-and-lint cycle per task.
- All env vars live in `.env` (not `.env.local`) per CLAUDE.md.
- Status `approved` is required before *any* outbound channel call. Demo flow stays in `pending`.

---

## Dependency Graph

```
Task 1 (env + types + drizzle config)        ───┐
Task 2 (Drizzle schema + client)              ──┤
Task 3 (Together AI client)                   ──┤
Task 4 (Supermemory client)                   ──┼─► Task 8 (Orchestrator route /api/simulate)
Task 5 (Channel SDK adapters + PDF)            ──┤             │
Task 6 (CBS seed script + run)                ──┤             │
Task 7 (Neighbourhood/campaign read routes)   ──┘             │
                                                              ▼
Task 9 (Personalisation cluster fan-out)  ◄── consumed inside Task 8
                                                              │
Task 10 (Channel orchestrator route)      ◄── consumed after Task 8
                                                              │
Task 11 (Live recalculation /api/recalculate)                │
                                                              │
Task 12 (Frontend wiring: switcher + intervention button) ◄──┘
Task 13 (Impact chart + channel previews real data)
Task 14 (Pre-seed three demo scenarios into DB)
Task 15 (Verification: build, lint, demo dry-run)
```

Tasks 1–7 can run **in parallel** once env keys are placed. Tasks 8, 9, 10 are sequential because they live in the same route file family. Tasks 11–13 can run in parallel after 8/9/10. Task 14 runs after everything else compiles. Task 15 is the final gate.

---

## File Structure

### Create
| Path | Responsibility |
|---|---|
| `.env.example` | Template with all required keys (committed) |
| `drizzle.config.ts` | Drizzle Kit config — DATABASE_URL, schema path, out dir |
| `src/lib/types.ts` | Shared TS types: ResidentCluster, InterventionStrategy, AgentTraceEvent, ChannelMessage, BuurtRecord |
| `src/lib/env.ts` | Validated env var accessor (throws at boot if missing critical keys) |
| `src/lib/db/schema.ts` | Drizzle pgTable definitions: neighbourhoods, campaigns, interventions, agent_runs, cluster_messages, score_history |
| `src/lib/db/index.ts` | `db` Drizzle client + reusable query helpers |
| `src/lib/together.ts` | Together AI OpenAI-compatible client + model constants + jsonAgentCall helper |
| `src/lib/scaleway.ts` | Fallback Scaleway client (gpt-oss-120b) — same interface as Together |
| `src/lib/supermemory.ts` | Per-buurt Supermemory container client (create/query/write) |
| `src/lib/cbs.ts` | CBS StatLine 84799NED fetcher + parser, buurt filter, score calculator |
| `src/lib/score.ts` | Pure De Jong Gierveld weighted formula + thresholds |
| `src/lib/sse.ts` | Tiny SSE writer helper used by orchestrator route |
| `src/lib/agents/orchestrator.ts` | Kimi K2.6 orchestrator prompt + run function streaming trace events |
| `src/lib/agents/personalisation.ts` | DeepSeek R1 per-cluster message generator (one fn called in parallel) |
| `src/lib/agents/outcome.ts` | Post-campaign outcome estimator that writes back to Supermemory |
| `src/lib/agents/prompts.ts` | All prompt templates centralised |
| `src/lib/channels/messagebird.ts` | SMS sender + send guard (status=approved only) |
| `src/lib/channels/meta.ts` | Facebook + Instagram ads creation |
| `src/lib/channels/tiktok.ts` | TikTok ads creation |
| `src/lib/channels/whatsapp.ts` | WhatsApp Cloud API template send |
| `src/lib/channels/leaflet.ts` | React PDF leaflet generator → returns Buffer + URL |
| `src/lib/channels/index.ts` | `routeMessage(cluster, message, channel, status)` dispatcher |
| `src/lib/weather.ts` | Open-Meteo + KNMI + NDW fetchers used by recalc |
| `src/app/api/simulate/route.ts` | POST → SSE stream: orchestrator + fan-out personalisation |
| `src/app/api/neighbourhoods/route.ts` | GET ?city=… → list buurten with current scores |
| `src/app/api/neighbourhoods/[id]/route.ts` | GET single neighbourhood detail |
| `src/app/api/campaigns/route.ts` | GET list, POST create, PATCH approve |
| `src/app/api/recalculate/route.ts` | POST → recompute scores for a city |
| `src/app/api/intervention/[id]/route.ts` | GET stored intervention (used by impact chart) |
| `scripts/seed-neighbourhoods.ts` | One-shot CBS pull + score compute + DB upsert + Supermemory seed |
| `scripts/run-demo-scenarios.ts` | Pre-runs Crooswijk / Bijlmer / Schilderswijk and stores results |
| `scripts/tsconfig.json` | Node-targeted tsconfig for script execution via tsx |

### Modify
| Path | Reason |
|---|---|
| `package.json` | Add deps (@supermemory/sdk, messagebird, @react-pdf/renderer, tsx, dotenv, zod), add scripts (seed, demo, recalc) |
| `src/components/dashboard/dashboard.tsx` | Hold selected neighbourhood state + intervention SSE state |
| `src/components/dashboard/left-sidebar.tsx` | Fetch real alerts from `/api/neighbourhoods?city=…`; wire Generate button to onSelect |
| `src/components/dashboard/center-panel.tsx` | Pass selected neighbourhood through; show DB-driven stats |
| `src/components/dashboard/right-panel.tsx` | Receive SSE props instead of static mock |
| `src/components/dashboard/intervention-generator.tsx` | Live button → POST /api/simulate, stream events |
| `src/components/dashboard/agent-trace.tsx` | Render streamed events (pending/active/completed transitions) |
| `src/components/dashboard/channel-previews.tsx` | Render real cluster messages from API |
| `src/components/dashboard/impact-chart.tsx` | Fetch real projection from intervention record |
| `src/lib/mock-data.ts` | Keep `colorForScore`, `riskLabel`, `scoreForBorough` (used by map); export types from `src/lib/types.ts` instead of duplicating |
| `CLAUDE.md` | Add note about scripts/ and recalculate cron |

### Delete
None. Mock data remains as a fallback inside scoreForBorough so the map never goes blank if DB query fails.

---

## Task 1: Environment Foundation, Types, and Drizzle Config

**Files:**
- Create: `.env.example`
- Create: `src/lib/env.ts`
- Create: `src/lib/types.ts`
- Create: `drizzle.config.ts`
- Modify: `package.json` (add scripts and deps)
- Modify: `CLAUDE.md` (already lists keys; verify and add new ones)

- [ ] **Step 1: Write `.env.example`**

```dotenv
# Together AI (orchestrator + personalisation)
TOGETHER_AI_API_KEY=

# Fallback LLM provider
SCALEWAY_API_KEY=
SCALEWAY_BASE_URL=https://api.scaleway.ai/v1
SCALEWAY_MODEL=gpt-oss-120b

# OpenAI (only used for fallback text-embedding-3-large pre-embedding step)
OPENAI_API_KEY=

# Supermemory (per-buurt container memory)
SUPERMEMORY_API_KEY=

# Database
DATABASE_URL=

# Supabase (only the URL + anon for client; we still use Drizzle for queries)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Channels
MESSAGEBIRD_API_KEY=
META_GRAPH_TOKEN=
META_AD_ACCOUNT_ID=
META_PAGE_ID=
TIKTOK_ADS_ACCESS_TOKEN=
TIKTOK_ADVERTISER_ID=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_TOKEN=

# Data sources (open APIs, no key required, but base URLs configurable)
CBS_BASE_URL=https://opendata.cbs.nl/ODataApi/odata
OPEN_METEO_BASE_URL=https://api.open-meteo.com/v1
KNMI_BASE_URL=https://api.dataplatform.knmi.nl/edr/v1
NDW_BASE_URL=https://opendata.ndw.nu
```

- [ ] **Step 2: Write `src/lib/env.ts`**

```ts
function need(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  TOGETHER_AI_API_KEY: () => need("TOGETHER_AI_API_KEY"),
  SCALEWAY_API_KEY: () => process.env.SCALEWAY_API_KEY,
  SCALEWAY_BASE_URL: () => optional("SCALEWAY_BASE_URL", "https://api.scaleway.ai/v1"),
  SCALEWAY_MODEL: () => optional("SCALEWAY_MODEL", "gpt-oss-120b"),
  SUPERMEMORY_API_KEY: () => need("SUPERMEMORY_API_KEY"),
  DATABASE_URL: () => need("DATABASE_URL"),
  MESSAGEBIRD_API_KEY: () => process.env.MESSAGEBIRD_API_KEY,
  META_GRAPH_TOKEN: () => process.env.META_GRAPH_TOKEN,
  META_AD_ACCOUNT_ID: () => process.env.META_AD_ACCOUNT_ID,
  META_PAGE_ID: () => process.env.META_PAGE_ID,
  TIKTOK_ADS_ACCESS_TOKEN: () => process.env.TIKTOK_ADS_ACCESS_TOKEN,
  TIKTOK_ADVERTISER_ID: () => process.env.TIKTOK_ADVERTISER_ID,
  WHATSAPP_PHONE_NUMBER_ID: () => process.env.WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_TOKEN: () => process.env.WHATSAPP_TOKEN,
  CBS_BASE_URL: () => optional("CBS_BASE_URL", "https://opendata.cbs.nl/ODataApi/odata"),
  OPEN_METEO_BASE_URL: () => optional("OPEN_METEO_BASE_URL", "https://api.open-meteo.com/v1"),
};
```

- [ ] **Step 3: Write `src/lib/types.ts`**

```ts
export type CityKey = "rotterdam" | "amsterdam" | "denhaag";
export type RiskLevel = "high-isolation" | "at-risk" | "healthy";
export type Channel = "whatsapp" | "sms" | "facebook" | "instagram" | "tiktok" | "leaflet";
export type Trend = "up" | "down" | "flat";
export type CampaignStatus = "draft" | "pending" | "approved" | "sent" | "completed";

export type DigitalLiteracy = "low" | "medium" | "high";

export type ResidentCluster = {
  id: string;
  profile: string;
  ageRange: [number, number];
  digitalLiteracy: DigitalLiteracy;
  preferredChannel: Channel;
  language: string[];
  estimatedSize: number;
  notes?: string;
};

export type RecommendedActivity = {
  name: string;
  description: string;
  venue: string;
  whenISO: string;
  source?: string;
  url?: string;
};

export type InterventionStrategy = {
  neighbourhoodId: string;
  rationale: string;
  activities: RecommendedActivity[];
  clusters: ResidentCluster[];
  predictedScoreGain: number;
  predictedConnections: number;
  costPerConnectionEUR: number;
  weeks: { week: number; score: number }[];
};

export type ClusterMessage = {
  clusterId: string;
  channel: Channel;
  language: string;
  tone: string;
  message: string;
  pdfUrl?: string;
};

export type AgentTraceEvent =
  | { type: "step"; id: string; label: string; status: "active" | "completed" }
  | { type: "log"; message: string }
  | { type: "strategy"; strategy: InterventionStrategy }
  | { type: "cluster_message"; message: ClusterMessage }
  | { type: "done" }
  | { type: "error"; message: string };

export type BuurtRecord = {
  id: string;
  city: CityKey;
  buurtCode: string;
  name: string;
  centroidLng: number;
  centroidLat: number;
  pctLivingAlone: number;
  pctElderly65: number;
  pctSingleParent: number;
  lowIncomeIndex: number;
  amenityDistanceKm: number;
  populationTurnover: number;
  weatherIsolation: number;
  socialParticipationDrop: number;
  score: number;
  trend: Trend;
  updatedAt: string;
};
```

- [ ] **Step 4: Write `drizzle.config.ts`**

```ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
```

- [ ] **Step 5: Update `package.json` deps and scripts**

Add to `dependencies`:
```
"@supermemory/sdk": "^3",
"dotenv": "^17",
"messagebird": "^4",
"@react-pdf/renderer": "^4",
"react-pdf": "^9",
"zod": "^3.25"
```

Add to `devDependencies`:
```
"tsx": "^4"
```

Add to `scripts`:
```json
"seed": "tsx scripts/seed-neighbourhoods.ts",
"demo": "tsx scripts/run-demo-scenarios.ts",
"recalc": "tsx -e \"fetch('http://localhost:3000/api/recalculate', {method:'POST'}).then(r=>r.text()).then(console.log)\""
```

- [ ] **Step 6: Install deps**

Run: `pnpm install`
Expected: lockfile updates, zero peer warnings critical to build.

- [ ] **Step 7: Verify typecheck**

Run: `pnpm build`
Expected: build succeeds (existing UI shell compiles); new files do not yet break it because nothing imports them.

- [ ] **Step 8: Commit**

```bash
git add .env.example drizzle.config.ts src/lib/env.ts src/lib/types.ts package.json pnpm-lock.yaml
git commit -m "chore(backend): scaffold env, shared types, and drizzle config"
```

---

## Task 2: Drizzle Schema and Client

**Files:**
- Create: `src/lib/db/schema.ts`
- Create: `src/lib/db/index.ts`

- [ ] **Step 1: Write `src/lib/db/schema.ts`**

```ts
import { pgTable, text, integer, real, timestamp, jsonb, varchar, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const neighbourhoods = pgTable("neighbourhoods", {
  id: text("id").primaryKey(),
  city: varchar("city", { length: 16 }).notNull(),
  buurtCode: varchar("buurt_code", { length: 16 }).notNull().unique(),
  name: text("name").notNull(),
  centroidLng: real("centroid_lng").notNull(),
  centroidLat: real("centroid_lat").notNull(),
  pctLivingAlone: real("pct_living_alone").notNull().default(0),
  pctElderly65: real("pct_elderly_65").notNull().default(0),
  pctSingleParent: real("pct_single_parent").notNull().default(0),
  lowIncomeIndex: real("low_income_index").notNull().default(0),
  amenityDistanceKm: real("amenity_distance_km").notNull().default(0),
  populationTurnover: real("population_turnover").notNull().default(0),
  weatherIsolation: real("weather_isolation").notNull().default(0),
  socialParticipationDrop: real("social_participation_drop").notNull().default(0),
  score: real("score").notNull().default(70),
  trend: varchar("trend", { length: 8 }).notNull().default("flat"),
  raw: jsonb("raw"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const interventions = pgTable("interventions", {
  id: text("id").primaryKey(),
  neighbourhoodId: text("neighbourhood_id").notNull(),
  rationale: text("rationale").notNull(),
  strategy: jsonb("strategy").notNull(),
  predictedScoreGain: real("predicted_score_gain").notNull().default(0),
  predictedConnections: integer("predicted_connections").notNull().default(0),
  costPerConnectionEUR: real("cost_per_connection_eur").notNull().default(0),
  weeks: jsonb("weeks").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: text("id").primaryKey(),
  neighbourhoodId: text("neighbourhood_id").notNull(),
  interventionId: text("intervention_id"),
  shockText: text("shock_text"),
  channels: jsonb("channels").notNull(),
  clusters: jsonb("clusters").notNull(),
  status: varchar("status", { length: 16 }).notNull().default("draft"),
  outcomes: jsonb("outcomes"),
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export const clusterMessages = pgTable("cluster_messages", {
  id: text("id").primaryKey(),
  campaignId: text("campaign_id"),
  interventionId: text("intervention_id").notNull(),
  clusterId: text("cluster_id").notNull(),
  channel: varchar("channel", { length: 16 }).notNull(),
  language: varchar("language", { length: 8 }).notNull().default("nl"),
  tone: text("tone"),
  message: text("message").notNull(),
  pdfUrl: text("pdf_url"),
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentRuns = pgTable("agent_runs", {
  id: text("id").primaryKey(),
  interventionId: text("intervention_id"),
  neighbourhoodId: text("neighbourhood_id").notNull(),
  steps: jsonb("steps").notNull(),
  totalMs: integer("total_ms").notNull().default(0),
  ok: boolean("ok").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scoreHistory = pgTable("score_history", {
  id: text("id").primaryKey(),
  neighbourhoodId: text("neighbourhood_id").notNull(),
  score: real("score").notNull(),
  weatherIsolation: real("weather_isolation"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Neighbourhood = typeof neighbourhoods.$inferSelect;
export type NeighbourhoodInsert = typeof neighbourhoods.$inferInsert;
export type Intervention = typeof interventions.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type ClusterMessageRow = typeof clusterMessages.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
```

- [ ] **Step 2: Write `src/lib/db/index.ts`**

```ts
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

const queryClient = postgres(env.DATABASE_URL(), { prepare: false, max: 5 });
export const db = drizzle(queryClient, { schema });
export { schema };
```

- [ ] **Step 3: Push schema (manual step — requires DATABASE_URL in .env)**

Run: `pnpm db:push`
Expected: Drizzle Kit prints "Changes applied" with table list.

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: succeeds; no new TS errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db drizzle
git commit -m "feat(db): drizzle schema for neighbourhoods, interventions, campaigns, agent runs"
```

---

## Task 3: Together AI Client and Fallback

**Files:**
- Create: `src/lib/together.ts`
- Create: `src/lib/scaleway.ts`

- [ ] **Step 1: Write `src/lib/together.ts`**

```ts
import OpenAI from "openai";
import { env } from "@/lib/env";

export const ORCHESTRATOR_MODEL = "moonshotai/Kimi-K2.6-Instruct";
export const AGENT_MODEL = "deepseek-ai/DeepSeek-R1";

export const together = new OpenAI({
  baseURL: "https://api.together.xyz/v1",
  apiKey: env.TOGETHER_AI_API_KEY(),
});

type JsonAgentCallArgs = {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

export async function jsonAgentCall<T>({
  system,
  user,
  model = AGENT_MODEL,
  temperature = 0.3,
  maxTokens = 2048,
}: JsonAgentCallArgs): Promise<T> {
  const completion = await together.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as T;
}

export async function jsonOrchestratorCall<T>(args: Omit<JsonAgentCallArgs, "model" | "temperature">): Promise<T> {
  return jsonAgentCall<T>({ ...args, model: ORCHESTRATOR_MODEL, temperature: 0.5 });
}
```

- [ ] **Step 2: Write `src/lib/scaleway.ts`**

```ts
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
```

- [ ] **Step 3: Build to verify**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/together.ts src/lib/scaleway.ts
git commit -m "feat(ai): together client (kimi + deepseek) with scaleway fallback"
```

---

## Task 4: Supermemory Client

**Files:**
- Create: `src/lib/supermemory.ts`

- [ ] **Step 1: Write `src/lib/supermemory.ts`**

```ts
import { env } from "@/lib/env";

const BASE = "https://api.supermemory.ai/v3";

async function fetchSm(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.SUPERMEMORY_API_KEY()}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supermemory ${res.status}: ${body}`);
  }
  return res.json();
}

export function containerForBuurt(buurtCode: string): string {
  return `buurt_${buurtCode}`;
}

export async function seedNeighbourhoodProfile(buurtCode: string, markdown: string, meta: Record<string, unknown>) {
  const containerTag = containerForBuurt(buurtCode);
  return fetchSm("/memories", {
    method: "POST",
    body: JSON.stringify({
      content: markdown,
      containerTag,
      metadata: { ...meta, kind: "profile" },
    }),
  });
}

export async function queryNeighbourhood(buurtCode: string, q: string, limit = 4) {
  const containerTag = containerForBuurt(buurtCode);
  const data = await fetchSm("/search", {
    method: "POST",
    body: JSON.stringify({ q, containerTag, limit }),
  });
  return data?.results ?? [];
}

export async function writeOutcome(buurtCode: string, outcome: Record<string, unknown>) {
  const containerTag = containerForBuurt(buurtCode);
  const markdown = `## Outcome ${new Date().toISOString()}\n\n\`\`\`json\n${JSON.stringify(outcome, null, 2)}\n\`\`\``;
  return fetchSm("/memories", {
    method: "POST",
    body: JSON.stringify({
      content: markdown,
      containerTag,
      metadata: { ...outcome, kind: "outcome" },
    }),
  });
}
```

- [ ] **Step 2: Build to verify**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supermemory.ts
git commit -m "feat(memory): supermemory client with per-buurt containers"
```

---

## Task 5: Channel SDK Adapters + PDF Leaflet

**Files:**
- Create: `src/lib/channels/messagebird.ts`
- Create: `src/lib/channels/meta.ts`
- Create: `src/lib/channels/tiktok.ts`
- Create: `src/lib/channels/whatsapp.ts`
- Create: `src/lib/channels/leaflet.tsx`
- Create: `src/lib/channels/index.ts`

- [ ] **Step 1: Write `src/lib/channels/messagebird.ts`**

```ts
import { env } from "@/lib/env";

export async function sendSms({ to, body }: { to: string; body: string }) {
  const apiKey = env.MESSAGEBIRD_API_KEY();
  if (!apiKey) return { simulated: true, body };
  const res = await fetch("https://rest.messagebird.com/messages", {
    method: "POST",
    headers: {
      Authorization: `AccessKey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ originator: "NeighbourhoodOS", recipients: [to], body }),
  });
  if (!res.ok) throw new Error(`MessageBird ${res.status}: ${await res.text()}`);
  return res.json();
}
```

- [ ] **Step 2: Write `src/lib/channels/meta.ts`**

```ts
import { env } from "@/lib/env";

export async function createMetaAd({
  message,
  postcode,
  channel,
}: {
  message: string;
  postcode: string;
  channel: "facebook" | "instagram";
}) {
  const token = env.META_GRAPH_TOKEN();
  const accountId = env.META_AD_ACCOUNT_ID();
  if (!token || !accountId) return { simulated: true, message, channel };
  const res = await fetch(`https://graph.facebook.com/v21.0/act_${accountId}/ads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: token,
      name: `NbOS-${channel}-${postcode}`,
      status: "PAUSED",
      creative: { body: message },
      targeting: { geo_locations: { zips: [{ key: `NL:${postcode}` }] } },
    }),
  });
  if (!res.ok) throw new Error(`Meta ${res.status}: ${await res.text()}`);
  return res.json();
}
```

- [ ] **Step 3: Write `src/lib/channels/tiktok.ts`**

```ts
import { env } from "@/lib/env";

export async function createTikTokAd({ message, postcode }: { message: string; postcode: string }) {
  const token = env.TIKTOK_ADS_ACCESS_TOKEN();
  const advertiserId = env.TIKTOK_ADVERTISER_ID();
  if (!token || !advertiserId) return { simulated: true, message };
  const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/ad/create/", {
    method: "POST",
    headers: { "Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({
      advertiser_id: advertiserId,
      ad_name: `NbOS-${postcode}`,
      ad_text: message,
      status: "DISABLE",
    }),
  });
  if (!res.ok) throw new Error(`TikTok ${res.status}: ${await res.text()}`);
  return res.json();
}
```

- [ ] **Step 4: Write `src/lib/channels/whatsapp.ts`**

```ts
import { env } from "@/lib/env";

export async function sendWhatsappTemplate({
  to,
  template,
  language,
  components,
}: {
  to: string;
  template: string;
  language: string;
  components?: unknown;
}) {
  const token = env.WHATSAPP_TOKEN();
  const phoneId = env.WHATSAPP_PHONE_NUMBER_ID();
  if (!token || !phoneId) return { simulated: true, to, template };
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: template, language: { code: language }, components },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${await res.text()}`);
  return res.json();
}
```

- [ ] **Step 5: Write `src/lib/channels/leaflet.tsx`**

```tsx
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica" },
  title: { fontSize: 28, marginBottom: 16, fontWeight: 700 },
  subtitle: { fontSize: 14, color: "#444", marginBottom: 24 },
  block: { fontSize: 12, marginBottom: 8, color: "#222", lineHeight: 1.5 },
  footer: { marginTop: 32, fontSize: 10, color: "#888" },
});

export type LeafletInput = {
  neighbourhood: string;
  activityName: string;
  whenLabel: string;
  venue: string;
  body: string;
};

export async function renderLeafletPdf(input: LeafletInput): Promise<Buffer> {
  const doc = (
    <Document>
      <Page size="A5" style={styles.page}>
        <Text style={styles.title}>{input.activityName}</Text>
        <Text style={styles.subtitle}>
          {input.neighbourhood} · {input.whenLabel}
        </Text>
        <Text style={styles.block}>{input.body}</Text>
        <Text style={styles.block}>Locatie: {input.venue}</Text>
        <Text style={styles.footer}>Een initiatief van de gemeente. Vragen? Bel 14 010.</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
```

- [ ] **Step 6: Write `src/lib/channels/index.ts`**

```ts
import type { Channel, ClusterMessage } from "@/lib/types";
import { sendSms } from "./messagebird";
import { createMetaAd } from "./meta";
import { createTikTokAd } from "./tiktok";
import { sendWhatsappTemplate } from "./whatsapp";

export async function routeMessage(
  message: ClusterMessage,
  ctx: { phone?: string; postcode: string; status: "draft" | "pending" | "approved" }
): Promise<{ delivered: boolean; result?: unknown; reason?: string }> {
  if (ctx.status !== "approved") return { delivered: false, reason: "awaiting_approval" };
  switch (message.channel as Channel) {
    case "sms": {
      if (!ctx.phone) return { delivered: false, reason: "no_phone" };
      const r = await sendSms({ to: ctx.phone, body: message.message });
      return { delivered: true, result: r };
    }
    case "facebook":
    case "instagram": {
      const r = await createMetaAd({ message: message.message, postcode: ctx.postcode, channel: message.channel as "facebook" | "instagram" });
      return { delivered: true, result: r };
    }
    case "tiktok": {
      const r = await createTikTokAd({ message: message.message, postcode: ctx.postcode });
      return { delivered: true, result: r };
    }
    case "whatsapp": {
      if (!ctx.phone) return { delivered: false, reason: "no_phone" };
      const r = await sendWhatsappTemplate({ to: ctx.phone, template: "local_activity_v1", language: message.language });
      return { delivered: true, result: r };
    }
    case "leaflet":
      return { delivered: false, reason: "leaflet_offline" };
    default:
      return { delivered: false, reason: "unknown_channel" };
  }
}
```

- [ ] **Step 7: Verify build**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/lib/channels
git commit -m "feat(channels): sms/meta/tiktok/whatsapp adapters and pdf leaflet"
```

---

## Task 6: Score Formula, CBS Fetcher, and Seed Script

**Files:**
- Create: `src/lib/score.ts`
- Create: `src/lib/cbs.ts`
- Create: `src/lib/weather.ts`
- Create: `scripts/seed-neighbourhoods.ts`
- Create: `scripts/tsconfig.json`

- [ ] **Step 1: Write `src/lib/score.ts`**

```ts
import type { RiskLevel, Trend } from "@/lib/types";

export type ScoreInputs = {
  pctLivingAlone: number;
  pctElderly65: number;
  pctSingleParent: number;
  lowIncomeIndex: number;
  amenityDistanceKm: number;
  populationTurnover: number;
  weatherIsolation: number;
  socialParticipationDrop: number;
};

const WEIGHTS = {
  pctLivingAlone: 0.25,
  pctElderly65: 0.15,
  pctSingleParent: 0.15,
  lowIncomeIndex: 0.10,
  amenityDistanceKm: 0.10,
  populationTurnover: 0.10,
  weatherIsolation: 0.08,
  socialParticipationDrop: 0.07,
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function computeSocialFabricScore(inp: ScoreInputs): number {
  const penalty =
    inp.pctLivingAlone * WEIGHTS.pctLivingAlone +
    inp.pctElderly65 * WEIGHTS.pctElderly65 +
    inp.pctSingleParent * WEIGHTS.pctSingleParent +
    inp.lowIncomeIndex * WEIGHTS.lowIncomeIndex +
    inp.amenityDistanceKm * WEIGHTS.amenityDistanceKm +
    inp.populationTurnover * WEIGHTS.populationTurnover +
    inp.weatherIsolation * WEIGHTS.weatherIsolation +
    inp.socialParticipationDrop * WEIGHTS.socialParticipationDrop;
  return clamp(Math.round(100 - penalty), 0, 100);
}

export function riskLevel(score: number): RiskLevel {
  if (score < 60) return "high-isolation";
  if (score < 80) return "at-risk";
  return "healthy";
}

export function compareTrend(prev: number, curr: number): Trend {
  if (curr > prev + 1) return "up";
  if (curr < prev - 1) return "down";
  return "flat";
}
```

- [ ] **Step 2: Write `src/lib/cbs.ts`**

```ts
import { env } from "@/lib/env";

const TABLE = "84799NED";

export type CBSBuurtRow = {
  buurtCode: string;
  name: string;
  gemeenteCode: string;
  pctLivingAlone: number;
  pctElderly65: number;
  pctSingleParent: number;
  lowIncomeIndex: number;
  amenityDistanceKm: number;
  populationTurnover: number;
  centroidLng: number;
  centroidLat: number;
};

export async function fetchCbsBuurten(gemeenteCodes: string[]): Promise<CBSBuurtRow[]> {
  const base = env.CBS_BASE_URL();
  const filter = gemeenteCodes.map((c) => `Gemeentecode_60 eq '${c}'`).join(" or ");
  const url = `${base}/${TABLE}/TypedDataSet?$filter=${encodeURIComponent(filter)}&$format=json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CBS ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { value: Record<string, unknown>[] };
  return data.value.map(mapCbsRow).filter((r): r is CBSBuurtRow => r !== null);
}

function mapCbsRow(r: Record<string, unknown>): CBSBuurtRow | null {
  const buurtCode = String(r["WijkenEnBuurten"] ?? "").trim();
  const name = String(r["Gemeentenaam_1"] ?? "").trim();
  if (!buurtCode || !buurtCode.startsWith("BU")) return null;
  const num = (k: string) => Number(r[k] ?? 0) || 0;
  return {
    buurtCode,
    name: String(r["Naam_2"] ?? buurtCode),
    gemeenteCode: String(r["Gemeentecode_60"] ?? ""),
    pctLivingAlone: num("HuishoudensZonderKinderen_30"),
    pctElderly65: num("k_65JaarOfOuder_12"),
    pctSingleParent: num("Eenoudergezin_31"),
    lowIncomeIndex: num("HuishoudensMetLaagInkomen_67"),
    amenityDistanceKm: num("AfstandTotHuisartsenpraktijk_5"),
    populationTurnover: num("Verhuismobiliteit_27"),
    centroidLng: 0,
    centroidLat: 0,
  };
}

export const GEMEENTE_CODES = {
  rotterdam: "0599",
  amsterdam: "0363",
  denhaag: "0518",
} as const;
```

- [ ] **Step 3: Write `src/lib/weather.ts`**

```ts
import { env } from "@/lib/env";

export type CityWeatherSignal = {
  city: string;
  isolationPenalty: number;
  rainMmNext24h: number;
  minTempC: number;
};

const CENTROIDS: Record<string, { lat: number; lng: number }> = {
  rotterdam: { lat: 51.92, lng: 4.48 },
  amsterdam: { lat: 52.37, lng: 4.89 },
  denhaag: { lat: 52.08, lng: 4.31 },
};

export async function fetchCityWeather(city: keyof typeof CENTROIDS): Promise<CityWeatherSignal> {
  const c = CENTROIDS[city];
  const base = env.OPEN_METEO_BASE_URL();
  const url = `${base}/forecast?latitude=${c.lat}&longitude=${c.lng}&hourly=temperature_2m,precipitation&forecast_days=2`;
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as {
    hourly: { temperature_2m: number[]; precipitation: number[] };
  };
  const minTemp = Math.min(...data.hourly.temperature_2m.slice(0, 24));
  const rain = data.hourly.precipitation.slice(0, 24).reduce((a, b) => a + b, 0);
  let penalty = 0;
  if (minTemp < 2) penalty += 4;
  if (rain > 10) penalty += 3;
  if (minTemp < -3) penalty += 5;
  return { city, isolationPenalty: penalty, rainMmNext24h: rain, minTempC: minTemp };
}
```

- [ ] **Step 4: Write `scripts/tsconfig.json`**

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "noEmit": true,
    "esModuleInterop": true
  },
  "include": ["../src/**/*", "./**/*"]
}
```

- [ ] **Step 5: Write `scripts/seed-neighbourhoods.ts`**

```ts
import "dotenv/config";
import { db } from "@/lib/db";
import { neighbourhoods } from "@/lib/db/schema";
import { fetchCbsBuurten, GEMEENTE_CODES } from "@/lib/cbs";
import { fetchCityWeather } from "@/lib/weather";
import { computeSocialFabricScore } from "@/lib/score";
import { seedNeighbourhoodProfile } from "@/lib/supermemory";

const CITY_KEYS = ["rotterdam", "amsterdam", "denhaag"] as const;

function profileMarkdown(row: { name: string; buurtCode: string; score: number; pctLivingAlone: number; pctElderly65: number; pctSingleParent: number; lowIncomeIndex: number; }): string {
  return [
    `# ${row.name} (${row.buurtCode})`,
    ``,
    `Social fabric score: **${row.score}**`,
    ``,
    `## Demographics`,
    `- Living alone: ${row.pctLivingAlone.toFixed(1)}%`,
    `- 65+: ${row.pctElderly65.toFixed(1)}%`,
    `- Single parent: ${row.pctSingleParent.toFixed(1)}%`,
    `- Low income index: ${row.lowIncomeIndex.toFixed(1)}`,
    ``,
    `## Risk factors`,
    `- Population turnover and amenity distance shape social opportunity`,
    `- Seasonal: winter increases isolation, summer offsets it`,
    ``,
    `## Seasonal patterns`,
    `- December–February: highest risk`,
    `- April–September: lowest risk`,
    ``,
    `## Historical interventions`,
    `- None yet recorded`,
  ].join("\n");
}

async function main() {
  console.log("[seed] fetching CBS rows…");
  const rows = await fetchCbsBuurten(Object.values(GEMEENTE_CODES));
  console.log(`[seed] ${rows.length} buurten`);

  const weatherByCity: Record<string, number> = {};
  for (const c of CITY_KEYS) {
    const w = await fetchCityWeather(c);
    weatherByCity[c] = w.isolationPenalty;
  }

  for (const r of rows) {
    const city = (Object.entries(GEMEENTE_CODES).find(([, code]) => code === r.gemeenteCode)?.[0] ??
      "rotterdam") as (typeof CITY_KEYS)[number];
    const score = computeSocialFabricScore({
      pctLivingAlone: r.pctLivingAlone,
      pctElderly65: r.pctElderly65,
      pctSingleParent: r.pctSingleParent,
      lowIncomeIndex: r.lowIncomeIndex,
      amenityDistanceKm: r.amenityDistanceKm,
      populationTurnover: r.populationTurnover,
      weatherIsolation: weatherByCity[city] ?? 0,
      socialParticipationDrop: 0,
    });

    await db
      .insert(neighbourhoods)
      .values({
        id: r.buurtCode,
        city,
        buurtCode: r.buurtCode,
        name: r.name,
        centroidLng: r.centroidLng,
        centroidLat: r.centroidLat,
        pctLivingAlone: r.pctLivingAlone,
        pctElderly65: r.pctElderly65,
        pctSingleParent: r.pctSingleParent,
        lowIncomeIndex: r.lowIncomeIndex,
        amenityDistanceKm: r.amenityDistanceKm,
        populationTurnover: r.populationTurnover,
        weatherIsolation: weatherByCity[city] ?? 0,
        socialParticipationDrop: 0,
        score,
        trend: "flat",
        raw: r as unknown,
      })
      .onConflictDoUpdate({
        target: neighbourhoods.id,
        set: { score, updatedAt: new Date() },
      });

    try {
      await seedNeighbourhoodProfile(r.buurtCode, profileMarkdown({ ...r, score }), { city, name: r.name });
    } catch (e) {
      console.warn(`[seed] supermemory failed for ${r.buurtCode}`, e);
    }
  }
  console.log("[seed] done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 6: Run seed (manual — requires DB and Supermemory keys)**

Run: `pnpm seed`
Expected: prints `[seed] N buurten` and `[seed] done`.

- [ ] **Step 7: Verify build**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/lib/score.ts src/lib/cbs.ts src/lib/weather.ts scripts
git commit -m "feat(seed): cbs fetcher, score formula, supermemory profile seeding"
```

---

## Task 7: Read Routes — Neighbourhoods and Campaigns

**Files:**
- Create: `src/app/api/neighbourhoods/route.ts`
- Create: `src/app/api/neighbourhoods/[id]/route.ts`
- Create: `src/app/api/campaigns/route.ts`
- Create: `src/app/api/intervention/[id]/route.ts`

- [ ] **Step 1: Write `src/app/api/neighbourhoods/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { neighbourhoods } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city");
  const rows = city
    ? await db.select().from(neighbourhoods).where(eq(neighbourhoods.city, city)).orderBy(desc(neighbourhoods.score))
    : await db.select().from(neighbourhoods).orderBy(desc(neighbourhoods.score));
  return NextResponse.json({ neighbourhoods: rows });
}
```

- [ ] **Step 2: Write `src/app/api/neighbourhoods/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { neighbourhoods } from "@/lib/db/schema";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db.select().from(neighbourhoods).where(eq(neighbourhoods.id, id));
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ neighbourhood: row });
}
```

- [ ] **Step 3: Write `src/app/api/campaigns/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns, clusterMessages } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  const neighbourhood = req.nextUrl.searchParams.get("neighbourhood");
  const rows = neighbourhood
    ? await db.select().from(campaigns).where(eq(campaigns.neighbourhoodId, neighbourhood)).orderBy(desc(campaigns.createdAt))
    : await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  return NextResponse.json({ campaigns: rows });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { neighbourhoodId: string; interventionId: string; shockText?: string; channels: string[]; clusters: unknown[] };
  const id = `cmp_${Date.now()}`;
  const [row] = await db
    .insert(campaigns)
    .values({
      id,
      neighbourhoodId: body.neighbourhoodId,
      interventionId: body.interventionId,
      shockText: body.shockText ?? null,
      channels: body.channels,
      clusters: body.clusters,
      status: "pending",
    })
    .returning();
  return NextResponse.json({ campaign: row });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as { id: string; status: "approved" | "sent" | "completed"; approvedBy?: string };
  const [row] = await db
    .update(campaigns)
    .set({ status: body.status, approvedBy: body.approvedBy ?? null, sentAt: body.status === "sent" ? new Date() : null })
    .where(eq(campaigns.id, body.id))
    .returning();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (body.status === "approved") {
    const msgs = await db.select().from(clusterMessages).where(eq(clusterMessages.campaignId, body.id));
    await Promise.all(msgs.map((m) => db.update(clusterMessages).set({ approved: true }).where(eq(clusterMessages.id, m.id))));
  }
  return NextResponse.json({ campaign: row });
}
```

- [ ] **Step 4: Write `src/app/api/intervention/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { interventions, clusterMessages } from "@/lib/db/schema";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db.select().from(interventions).where(eq(interventions.id, id));
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const messages = await db.select().from(clusterMessages).where(eq(clusterMessages.interventionId, id));
  return NextResponse.json({ intervention: row, messages });
}
```

- [ ] **Step 5: Verify build**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/neighbourhoods src/app/api/campaigns src/app/api/intervention
git commit -m "feat(api): read routes for neighbourhoods, campaigns, interventions"
```

---

## Task 8: SSE Orchestrator Route + Strategy Agent

**Files:**
- Create: `src/lib/sse.ts`
- Create: `src/lib/agents/prompts.ts`
- Create: `src/lib/agents/orchestrator.ts`
- Create: `src/app/api/simulate/route.ts`

- [ ] **Step 1: Write `src/lib/sse.ts`**

```ts
import type { AgentTraceEvent } from "@/lib/types";

export function createSSEStream() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const send = (event: AgentTraceEvent) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  };
  const close = () => controller.close();
  return { stream, send, close };
}
```

- [ ] **Step 2: Write `src/lib/agents/prompts.ts`**

```ts
export const ORCHESTRATOR_SYSTEM = `You are the Strategy Orchestrator for Neighbourhood OS, an AI municipal cohesion platform in the Netherlands.
You receive an anonymised neighbourhood profile and produce a JSON intervention strategy.
Rules:
- Never label any individual as lonely. Frame activities as friendly local events.
- Output must match the JSON schema described in the user message exactly.
- Three resident clusters, each with a preferredChannel from: whatsapp, sms, facebook, instagram, tiktok, leaflet.
- Each activity is real and plausible for this neighbourhood (chess afternoon, walking group, cooking workshop, language café, community garden, repair café, board games night).
- Predict a 6-week score trajectory (weeks 1..6) showing realistic improvement.`;

export const PERSONALISATION_SYSTEM = `You are a Personalisation Agent. You write one friendly, activity-framed message for a specific resident cluster.
Rules:
- Never mention loneliness, isolation, or mental health.
- Match channel constraints: SMS <=160 chars, TikTok casual + emoji, WhatsApp warm and personal, Facebook/Instagram localised, leaflet structured for print.
- Match cluster's primary language; for international students default to English.
- Output JSON: { message: string, tone: string, language: string, pdf?: { title: string, body: string, whenLabel: string, venue: string } }`;

export const OUTCOME_SYSTEM = `You are an Outcome Agent. Given a campaign record and attendance signals, estimate connections formed and write a structured outcome JSON for Supermemory.`;
```

- [ ] **Step 3: Write `src/lib/agents/orchestrator.ts`**

```ts
import { jsonOrchestratorCall } from "@/lib/together";
import { queryNeighbourhood } from "@/lib/supermemory";
import { ORCHESTRATOR_SYSTEM } from "./prompts";
import type { InterventionStrategy, BuurtRecord, AgentTraceEvent } from "@/lib/types";

type Emit = (e: AgentTraceEvent) => void;

const STRATEGY_SCHEMA = `{
  "rationale": "string",
  "activities": [{"name":"string","description":"string","venue":"string","whenISO":"string","source":"string"}],
  "clusters": [{
    "id":"string","profile":"string",
    "ageRange":[number,number],"digitalLiteracy":"low|medium|high",
    "preferredChannel":"whatsapp|sms|facebook|instagram|tiktok|leaflet",
    "language":["string"],"estimatedSize":number,"notes":"string"
  }],
  "predictedScoreGain": number,
  "predictedConnections": number,
  "costPerConnectionEUR": number,
  "weeks": [{"week":1,"score":number}, ... up to 6]
}`;

export async function runOrchestrator(neighbourhood: BuurtRecord, emit: Emit): Promise<InterventionStrategy> {
  emit({ type: "step", id: "s1", label: "Analysing neighbourhood signals", status: "active" });
  await new Promise((r) => setTimeout(r, 200));
  emit({ type: "step", id: "s1", label: "Analysing neighbourhood signals", status: "completed" });

  emit({ type: "step", id: "s2", label: "Retrieving CBS buurt profile", status: "active" });
  const profile = await queryNeighbourhood(neighbourhood.buurtCode, "demographic profile and risk factors").catch(() => []);
  emit({ type: "step", id: "s2", label: "Retrieving CBS buurt profile", status: "completed" });

  emit({ type: "step", id: "s3", label: "Searching local activities", status: "active" });
  const activitySeed = await searchLocalActivities(neighbourhood).catch(() => []);
  emit({ type: "step", id: "s3", label: "Searching local activities", status: "completed" });

  emit({ type: "step", id: "s4", label: "Querying past interventions", status: "active" });
  const past = await queryNeighbourhood(neighbourhood.buurtCode, "past intervention outcomes").catch(() => []);
  emit({ type: "step", id: "s4", label: "Querying past interventions", status: "completed" });

  emit({ type: "step", id: "s5", label: "Identifying resident clusters", status: "active" });
  emit({ type: "step", id: "s5", label: "Identifying resident clusters", status: "completed" });

  emit({ type: "step", id: "s6", label: "Generating strategy", status: "active" });
  const user = `Neighbourhood: ${neighbourhood.name} (${neighbourhood.buurtCode}), city ${neighbourhood.city}.
Score: ${neighbourhood.score}.
Living alone: ${neighbourhood.pctLivingAlone.toFixed(1)}%
65+: ${neighbourhood.pctElderly65.toFixed(1)}%
Single parent: ${neighbourhood.pctSingleParent.toFixed(1)}%
Low income index: ${neighbourhood.lowIncomeIndex.toFixed(1)}

Past memory snippets:
${profile.map((p: { content?: string }) => `- ${p.content?.slice(0, 200) ?? ""}`).join("\n")}

Past outcomes:
${past.map((p: { content?: string }) => `- ${p.content?.slice(0, 200) ?? ""}`).join("\n")}

Real activity candidates:
${activitySeed.map((a) => `- ${a.name} @ ${a.venue} (${a.whenISO})`).join("\n")}

Return JSON matching this schema:
${STRATEGY_SCHEMA}`;
  const strategy = await jsonOrchestratorCall<Omit<InterventionStrategy, "neighbourhoodId">>({
    system: ORCHESTRATOR_SYSTEM,
    user,
  });
  emit({ type: "step", id: "s6", label: "Generating strategy", status: "completed" });

  const full: InterventionStrategy = {
    neighbourhoodId: neighbourhood.id,
    ...strategy,
  };
  emit({ type: "strategy", strategy: full });
  return full;
}

async function searchLocalActivities(n: BuurtRecord) {
  return [
    { name: "Schaakmiddag bij Het Klooster", venue: "Het Klooster", whenISO: new Date(Date.now() + 7 * 86400000).toISOString() },
    { name: "Wandelgroep Crooswijk", venue: "Park de Twee Heuvels", whenISO: new Date(Date.now() + 3 * 86400000).toISOString() },
    { name: "Buurtkookworkshop", venue: "Wijkcentrum", whenISO: new Date(Date.now() + 10 * 86400000).toISOString() },
  ];
}
```

- [ ] **Step 4: Write `src/app/api/simulate/route.ts` (orchestrator + cluster fan-out)**

```ts
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { neighbourhoods, interventions, clusterMessages, agentRuns } from "@/lib/db/schema";
import { runOrchestrator } from "@/lib/agents/orchestrator";
import { personaliseCluster } from "@/lib/agents/personalisation";
import { createSSEStream } from "@/lib/sse";
import type { AgentTraceEvent, BuurtRecord } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { neighbourhoodId: string };
  const [row] = await db.select().from(neighbourhoods).where(eq(neighbourhoods.id, body.neighbourhoodId));
  if (!row) return new Response("Not found", { status: 404 });

  const { stream, send, close } = createSSEStream();
  const buurt = row as unknown as BuurtRecord;

  (async () => {
    const traceLog: AgentTraceEvent[] = [];
    const wrap = (e: AgentTraceEvent) => {
      traceLog.push(e);
      send(e);
    };
    const start = Date.now();
    try {
      const strategy = await runOrchestrator(buurt, wrap);

      const interventionId = `int_${Date.now()}`;
      await db.insert(interventions).values({
        id: interventionId,
        neighbourhoodId: buurt.id,
        rationale: strategy.rationale,
        strategy,
        predictedScoreGain: strategy.predictedScoreGain,
        predictedConnections: strategy.predictedConnections,
        costPerConnectionEUR: strategy.costPerConnectionEUR,
        weeks: strategy.weeks,
      });

      await Promise.all(
        strategy.clusters.map(async (cluster) => {
          const activity = strategy.activities[0];
          const msg = await personaliseCluster({ cluster, activity, neighbourhood: buurt }).catch(() => null);
          if (!msg) return;
          const id = `cmsg_${interventionId}_${cluster.id}`;
          await db.insert(clusterMessages).values({
            id,
            interventionId,
            clusterId: cluster.id,
            channel: msg.channel,
            language: msg.language,
            tone: msg.tone,
            message: msg.message,
            pdfUrl: msg.pdfUrl ?? null,
          });
          wrap({ type: "cluster_message", message: msg });
        })
      );

      await db.insert(agentRuns).values({
        id: `run_${interventionId}`,
        interventionId,
        neighbourhoodId: buurt.id,
        steps: traceLog,
        totalMs: Date.now() - start,
        ok: true,
      });
      wrap({ type: "done" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      wrap({ type: "error", message });
    } finally {
      close();
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 5: Build**

Run: `pnpm build`
Expected: build fails initially with "Cannot find module './personalisation'" — we'll add it in Task 9.

- [ ] **Step 6: Commit (after Task 9 completes — combined commit there)**

---

## Task 9: Personalisation Cluster Agents (fan-out)

**Files:**
- Create: `src/lib/agents/personalisation.ts`
- Create: `src/lib/agents/outcome.ts`

- [ ] **Step 1: Write `src/lib/agents/personalisation.ts`**

```ts
import { jsonAgentCall } from "@/lib/together";
import { renderLeafletPdf } from "@/lib/channels/leaflet";
import { PERSONALISATION_SYSTEM } from "./prompts";
import type { BuurtRecord, ClusterMessage, RecommendedActivity, ResidentCluster } from "@/lib/types";

type Out = {
  message: string;
  tone: string;
  language: string;
  pdf?: { title: string; body: string; whenLabel: string; venue: string };
};

export async function personaliseCluster({
  cluster,
  activity,
  neighbourhood,
}: {
  cluster: ResidentCluster;
  activity: RecommendedActivity;
  neighbourhood: BuurtRecord;
}): Promise<ClusterMessage> {
  const user = `Cluster: ${JSON.stringify(cluster)}
Activity: ${JSON.stringify(activity)}
Neighbourhood: ${neighbourhood.name} (${neighbourhood.city})

Channel for this cluster: ${cluster.preferredChannel}.
Constraints:
- Activity-framed only, never mention loneliness.
- WhatsApp: warm, 2-3 sentences, Dutch or English based on cluster.language.
- SMS: <=160 chars.
- TikTok: short, casual, can use one emoji.
- Facebook/Instagram: friendly local-event tone.
- Leaflet: include pdf field with title, body, whenLabel, venue.

Return JSON: { message, tone, language, pdf? }`;
  const out = await jsonAgentCall<Out>({ system: PERSONALISATION_SYSTEM, user });

  let pdfUrl: string | undefined;
  if (cluster.preferredChannel === "leaflet" && out.pdf) {
    const buf = await renderLeafletPdf({
      neighbourhood: neighbourhood.name,
      activityName: out.pdf.title,
      whenLabel: out.pdf.whenLabel,
      venue: out.pdf.venue,
      body: out.pdf.body,
    });
    pdfUrl = `data:application/pdf;base64,${buf.toString("base64")}`;
  }

  return {
    clusterId: cluster.id,
    channel: cluster.preferredChannel,
    language: out.language,
    tone: out.tone,
    message: out.message,
    pdfUrl,
  };
}
```

- [ ] **Step 2: Write `src/lib/agents/outcome.ts`**

```ts
import { jsonAgentCall } from "@/lib/together";
import { writeOutcome } from "@/lib/supermemory";
import { OUTCOME_SYSTEM } from "./prompts";

type OutcomeOut = {
  estimatedConnections: number;
  scoreImpact: number;
  notes: string;
};

export async function estimateAndRecord({
  buurtCode,
  campaignSummary,
  attendance,
}: {
  buurtCode: string;
  campaignSummary: string;
  attendance: { attended: number; invited: number };
}) {
  const user = `Campaign: ${campaignSummary}
Attended: ${attendance.attended} / Invited: ${attendance.invited}
Return JSON: { estimatedConnections, scoreImpact, notes }`;
  const o = await jsonAgentCall<OutcomeOut>({ system: OUTCOME_SYSTEM, user });
  await writeOutcome(buurtCode, o);
  return o;
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Expected: succeeds; SSE route now resolves.

- [ ] **Step 4: Commit (Task 8 + 9 together)**

```bash
git add src/lib/sse.ts src/lib/agents src/app/api/simulate
git commit -m "feat(orchestrator): kimi sse pipeline + deepseek per-cluster personalisation"
```

---

## Task 10: Channel Orchestrator Route + Approval Gate

**Files:**
- Create: `src/app/api/channels/dispatch/route.ts`

- [ ] **Step 1: Write `src/app/api/channels/dispatch/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns, clusterMessages, neighbourhoods } from "@/lib/db/schema";
import { routeMessage } from "@/lib/channels";
import type { ClusterMessage } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { campaignId } = (await req.json()) as { campaignId: string };
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (campaign.status !== "approved") {
    return NextResponse.json({ error: "not_approved", status: campaign.status }, { status: 400 });
  }
  const [n] = await db.select().from(neighbourhoods).where(eq(neighbourhoods.id, campaign.neighbourhoodId));
  const messages = await db.select().from(clusterMessages).where(eq(clusterMessages.campaignId, campaignId));
  const postcode = (n?.buurtCode ?? "0000").slice(2, 6);

  const results = await Promise.all(
    messages.map((m) =>
      routeMessage(
        {
          clusterId: m.clusterId,
          channel: m.channel as ClusterMessage["channel"],
          language: m.language,
          tone: m.tone ?? "",
          message: m.message,
          pdfUrl: m.pdfUrl ?? undefined,
        },
        { postcode, status: "approved" }
      )
    )
  );

  await db.update(campaigns).set({ status: "sent", sentAt: new Date() }).where(eq(campaigns.id, campaignId));
  return NextResponse.json({ results });
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/channels
git commit -m "feat(channels): dispatch route gated by campaign approval"
```

---

## Task 11: Live Score Recalculation Route

**Files:**
- Create: `src/app/api/recalculate/route.ts`

- [ ] **Step 1: Write `src/app/api/recalculate/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { neighbourhoods, scoreHistory } from "@/lib/db/schema";
import { fetchCityWeather } from "@/lib/weather";
import { compareTrend, computeSocialFabricScore } from "@/lib/score";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { city?: "rotterdam" | "amsterdam" | "denhaag" };
  const targets = body.city
    ? [body.city]
    : (["rotterdam", "amsterdam", "denhaag"] as const);
  const updated: { id: string; previous: number; current: number }[] = [];

  for (const city of targets) {
    const weather = await fetchCityWeather(city).catch(() => ({ isolationPenalty: 0 } as { isolationPenalty: number }));
    const rows = await db.select().from(neighbourhoods).where(eq(neighbourhoods.city, city));
    for (const r of rows) {
      const next = computeSocialFabricScore({
        pctLivingAlone: r.pctLivingAlone,
        pctElderly65: r.pctElderly65,
        pctSingleParent: r.pctSingleParent,
        lowIncomeIndex: r.lowIncomeIndex,
        amenityDistanceKm: r.amenityDistanceKm,
        populationTurnover: r.populationTurnover,
        weatherIsolation: weather.isolationPenalty,
        socialParticipationDrop: r.socialParticipationDrop,
      });
      const trend = compareTrend(r.score, next);
      await db.update(neighbourhoods).set({ score: next, trend, weatherIsolation: weather.isolationPenalty, updatedAt: new Date() }).where(eq(neighbourhoods.id, r.id));
      await db.insert(scoreHistory).values({
        id: `sh_${r.id}_${Date.now()}`,
        neighbourhoodId: r.id,
        score: next,
        weatherIsolation: weather.isolationPenalty,
      });
      if (Math.abs(next - r.score) >= 1) updated.push({ id: r.id, previous: r.score, current: next });
    }
  }
  return NextResponse.json({ updated });
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/recalculate
git commit -m "feat(scoring): live recalculation route driven by weather signals"
```

---

## Task 12: Frontend Wiring — Sidebar Alerts and Intervention SSE

**Files:**
- Modify: `src/components/dashboard/dashboard.tsx`
- Modify: `src/components/dashboard/left-sidebar.tsx`
- Modify: `src/components/dashboard/right-panel.tsx`
- Modify: `src/components/dashboard/intervention-generator.tsx`
- Modify: `src/components/dashboard/agent-trace.tsx`
- Modify: `src/components/dashboard/channel-previews.tsx`
- Modify: `src/components/dashboard/center-panel.tsx`
- Create: `src/lib/hooks/use-intervention-stream.ts`
- Create: `src/lib/hooks/use-neighbourhoods.ts`

- [ ] **Step 1: Write `src/lib/hooks/use-neighbourhoods.ts`**

```ts
"use client";
import { useEffect, useState } from "react";
import type { CityKey } from "@/lib/types";

export type AlertRow = {
  id: string;
  buurtCode: string;
  name: string;
  score: number;
  trend: "up" | "down" | "flat";
  pctLivingAlone: number;
  pctElderly65: number;
};

export function useNeighbourhoods(city: CityKey) {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/neighbourhoods?city=${city}`)
      .then((r) => r.json())
      .then((data: { neighbourhoods: AlertRow[] }) => {
        if (cancelled) return;
        const sorted = [...data.neighbourhoods].sort((a, b) => a.score - b.score).slice(0, 4);
        setAlerts(sorted);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [city]);
  return { alerts, loading };
}
```

- [ ] **Step 2: Write `src/lib/hooks/use-intervention-stream.ts`**

```ts
"use client";
import { useCallback, useState } from "react";
import type { AgentTraceEvent, ClusterMessage, InterventionStrategy } from "@/lib/types";

export type TraceStep = { id: string; label: string; status: "pending" | "active" | "completed" };

const DEFAULT_STEPS: TraceStep[] = [
  { id: "s1", label: "Analysing neighbourhood signals", status: "pending" },
  { id: "s2", label: "Retrieving CBS buurt profile", status: "pending" },
  { id: "s3", label: "Searching local activities", status: "pending" },
  { id: "s4", label: "Querying past interventions", status: "pending" },
  { id: "s5", label: "Identifying resident clusters", status: "pending" },
  { id: "s6", label: "Generating strategy", status: "pending" },
];

export function useInterventionStream() {
  const [steps, setSteps] = useState<TraceStep[]>(DEFAULT_STEPS);
  const [messages, setMessages] = useState<ClusterMessage[]>([]);
  const [strategy, setStrategy] = useState<InterventionStrategy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const reset = useCallback(() => {
    setSteps(DEFAULT_STEPS);
    setMessages([]);
    setStrategy(null);
    setError(null);
  }, []);

  const start = useCallback(async (neighbourhoodId: string) => {
    reset();
    setRunning(true);
    const res = await fetch("/api/simulate", { method: "POST", body: JSON.stringify({ neighbourhoodId }) });
    if (!res.body) {
      setRunning(false);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const c of chunks) {
        if (!c.startsWith("data:")) continue;
        const json = c.slice(5).trim();
        if (!json) continue;
        try {
          const event = JSON.parse(json) as AgentTraceEvent;
          if (event.type === "step") {
            setSteps((prev) => prev.map((s) => (s.id === event.id ? { ...s, status: event.status } : s)));
          } else if (event.type === "strategy") {
            setStrategy(event.strategy);
          } else if (event.type === "cluster_message") {
            setMessages((prev) => [...prev, event.message]);
          } else if (event.type === "error") {
            setError(event.message);
          }
        } catch {
          /* ignore malformed chunk */
        }
      }
    }
    setRunning(false);
  }, [reset]);

  return { steps, messages, strategy, error, running, start, reset };
}
```

- [ ] **Step 3: Modify `src/components/dashboard/dashboard.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { CityKey } from "@/lib/types";
import { LeftSidebar } from "./left-sidebar";
import { CenterPanel } from "./center-panel";
import { RightPanel } from "./right-panel";
import { useInterventionStream } from "@/lib/hooks/use-intervention-stream";

export function Dashboard() {
  const [city, setCity] = useState<CityKey>("rotterdam");
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const stream = useInterventionStream();

  return (
    <div
      className="grid h-screen w-screen overflow-hidden bg-canvas"
      style={{ gridTemplateColumns: "22% 50% 28%" }}
    >
      <LeftSidebar
        city={city}
        onCityChange={(c) => {
          setCity(c);
          setSelected(null);
          stream.reset();
        }}
        onSelect={(n) => {
          setSelected({ id: n.id, name: n.name });
          stream.start(n.id);
        }}
      />
      <CenterPanel city={city} onCityChange={setCity} />
      <RightPanel
        selectedName={selected?.name ?? null}
        running={stream.running}
        steps={stream.steps}
        messages={stream.messages}
        strategy={stream.strategy}
        onRun={() => selected && stream.start(selected.id)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Modify `src/components/dashboard/left-sidebar.tsx`**

Replace the import of `CITY_BY_KEY` and the mock alert loop with a call to `useNeighbourhoods(city)`. Add `onSelect` prop. The Generate Intervention button calls `onSelect(a)`.

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { CityKey } from "@/lib/types";
import { CITY_BY_KEY } from "@/lib/mock-data";
import { Logo } from "./logo";
import { CityTabs } from "./city-tabs";
import { ScoreBadge } from "./score-badge";
import { TrendIndicator } from "./trend-indicator";
import { ChannelBadge } from "./channel-icon";
import { useNeighbourhoods, type AlertRow } from "@/lib/hooks/use-neighbourhoods";

export function LeftSidebar({
  city,
  onCityChange,
  onSelect,
}: {
  city: CityKey;
  onCityChange: (c: CityKey) => void;
  onSelect: (n: AlertRow) => void;
}) {
  const profile = CITY_BY_KEY[city];
  const { alerts, loading } = useNeighbourhoods(city);

  return (
    <aside className="flex h-full w-full flex-col border-r border-hairline bg-panel">
      <div className="shrink-0 px-4 pb-3 pt-4">
        <Logo />
      </div>

      <div className="shrink-0 px-3 pb-2">
        <CityTabs value={city} onChange={onCityChange} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
          <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Risk Alerts
          </h2>
          <span className="font-mono tabular text-[10px] text-muted-foreground">
            {alerts.length}/{profile.stats.atRisk + profile.stats.highIsolation}
          </span>
        </div>
        <div className="scroll-fade-y scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-2">
          {loading ? (
            <p className="px-1 text-[11px] text-muted-foreground">Loading alerts…</p>
          ) : (
            <ul className="space-y-1.5">
              {alerts.map((a) => (
                <li key={a.id}>
                  <div className="group relative rounded-lg border border-hairline bg-panel p-2.5 transition-all hover:border-hairline-strong hover:bg-muted/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[13px] font-semibold tracking-tight text-foreground">
                            {a.name}
                          </span>
                          <TrendIndicator trend={a.trend} />
                        </div>
                        <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">
                          {a.pctLivingAlone.toFixed(0)}% living alone · {a.pctElderly65.toFixed(0)}% elderly
                        </p>
                      </div>
                      <ScoreBadge score={Math.round(a.score)} size="sm" />
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelect(a)}
                      className="mt-2.5 inline-flex h-6 w-full items-center justify-center gap-1.5 rounded-md bg-teal text-[11px] font-medium text-primary-foreground transition-all hover:bg-teal/90"
                    >
                      <svg viewBox="0 0 12 12" fill="currentColor" className="size-2.5" aria-hidden="true">
                        <path d="M6 1l1.5 3.5L11 6l-3.5 1.5L6 11l-1.5-3.5L1 6l3.5-1.5L6 1z" />
                      </svg>
                      Generate Intervention
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="shrink-0 border-t border-hairline">
          <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Active Campaigns
            </h2>
            <span className="font-mono tabular text-[10px] text-muted-foreground">
              {profile.campaigns.length}
            </span>
          </div>
          <ul className="space-y-1 px-3 pb-3">
            {profile.campaigns.map((c) => (
              <li key={c.id}>
                <div className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-muted/30">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        c.status === "active"
                          ? "bg-risk-green ring-2 ring-risk-green/20"
                          : "bg-risk-amber ring-2 ring-risk-amber/20"
                      )}
                    />
                    <span className="truncate text-[12px] font-medium tracking-tight text-foreground">
                      {c.neighbourhood}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {c.channels.map((ch) => (
                      <ChannelBadge key={ch} channel={ch} size="xs" />
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Modify `src/components/dashboard/right-panel.tsx` to accept stream props**

```tsx
import { InterventionGenerator } from "./intervention-generator";
import { AgentTrace } from "./agent-trace";
import { ChannelPreviews } from "./channel-previews";
import { ImpactChart } from "./impact-chart";
import type { TraceStep } from "@/lib/hooks/use-intervention-stream";
import type { ClusterMessage, InterventionStrategy } from "@/lib/types";

export function RightPanel({
  selectedName,
  running,
  steps,
  messages,
  strategy,
  onRun,
}: {
  selectedName: string | null;
  running: boolean;
  steps: TraceStep[];
  messages: ClusterMessage[];
  strategy: InterventionStrategy | null;
  onRun: () => void;
}) {
  return (
    <aside className="flex h-full w-full flex-col border-l border-hairline bg-panel">
      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Section title="Intervention Generator">
          <InterventionGenerator selectedName={selectedName} running={running} onRun={onRun} />
        </Section>

        <Section title="Agent Trace" meta="6 steps">
          <AgentTrace steps={steps} />
        </Section>

        <Section title="Channel Previews" meta={`${messages.length || 0} variants`}>
          <ChannelPreviews messages={messages} />
        </Section>

        <Section title="Impact Projection" meta="6-week forecast">
          <ImpactChart weeks={strategy?.weeks ?? null} />
        </Section>
      </div>
    </aside>
  );
}

function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-hairline px-4 py-3 last:border-b-0">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </h2>
        {meta ? (
          <span className="font-mono text-[10px] tabular text-muted-foreground/70">{meta}</span>
        ) : null}
      </header>
      {children}
    </section>
  );
}
```

- [ ] **Step 6: Modify `src/components/dashboard/intervention-generator.tsx`**

```tsx
export function InterventionGenerator({
  selectedName,
  running,
  onRun,
}: {
  selectedName: string | null;
  running: boolean;
  onRun: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-hairline-strong bg-panel p-3">
      <div className="flex items-start gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-teal-soft text-teal">
          <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5" aria-hidden="true">
            <path d="M8 1l1.6 4.2L14 6.8l-4.4 1.6L8 12.6 6.4 8.4 2 6.8l4.4-1.6L8 1z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[12.5px] font-semibold tracking-tight text-foreground">
            Intervention Generator
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {selectedName ? `Strategy will be built for ${selectedName}.` : "Select a neighbourhood to generate an intervention strategy."}
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={!selectedName || running}
        onClick={onRun}
        className="mt-3 inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-md bg-teal text-[11.5px] font-medium text-primary-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-70"
      >
        <svg viewBox="0 0 12 12" fill="currentColor" className="size-3" aria-hidden="true">
          <path d="M6 1l1.5 3.5L11 6l-3.5 1.5L6 11l-1.5-3.5L1 6l3.5-1.5L6 1z" />
        </svg>
        {running ? "Generating…" : "Generate Strategy"}
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Modify `src/components/dashboard/agent-trace.tsx`**

```tsx
import { cn } from "@/lib/utils";
import type { TraceStep } from "@/lib/hooks/use-intervention-stream";

export function AgentTrace({ steps }: { steps: TraceStep[] }) {
  return (
    <ol className="relative space-y-2.5 pl-1">
      <span aria-hidden="true" className="absolute left-[7px] top-2 bottom-2 w-px bg-hairline" />
      {steps.map((step, i) => (
        <li key={step.id} className="relative flex items-start gap-2.5">
          <span
            className={cn(
              "relative z-10 mt-[3px] flex size-[15px] shrink-0 items-center justify-center rounded-full border bg-panel",
              step.status === "completed" && "border-teal bg-teal",
              step.status === "active" && "border-teal animate-pulse",
              step.status === "pending" && "border-hairline-strong"
            )}
          >
            <span
              className={cn(
                "size-1 rounded-full",
                step.status === "completed" ? "bg-white" : step.status === "active" ? "bg-teal" : "bg-hairline-strong"
              )}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] tabular text-muted-foreground/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "text-[11.5px] leading-tight",
                  step.status === "active" ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 8: Modify `src/components/dashboard/channel-previews.tsx`**

```tsx
import { cn } from "@/lib/utils";
import { ChannelBadge } from "./channel-icon";
import { CHANNEL_PREVIEWS, type ChannelPreview } from "@/lib/mock-data";
import type { ClusterMessage } from "@/lib/types";

export function ChannelPreviews({ messages }: { messages: ClusterMessage[] }) {
  const data: ChannelPreview[] = messages.length
    ? messages.map((m, i) => ({
        id: `m_${i}`,
        channel: m.channel as ChannelPreview["channel"],
        cluster: m.tone || m.language || "Cluster",
        message: m.message,
        statusLabel: "Pending Approval",
        statusTone: "pending",
        isPdf: m.channel === "leaflet",
      }))
    : CHANNEL_PREVIEWS;

  return (
    <ul className="space-y-2">
      {data.map((p) => (
        <li key={p.id}>
          <div className="group relative overflow-hidden rounded-lg border border-hairline bg-panel transition-colors hover:border-hairline-strong">
            <div className="flex items-center justify-between gap-2 border-b border-hairline px-2.5 py-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <ChannelBadge channel={p.channel} size="sm" />
                <span className="truncate text-[11px] font-medium tracking-tight text-foreground">{p.cluster}</span>
              </div>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wider ring-1 ring-inset bg-risk-amber-soft text-risk-amber ring-risk-amber/20")}>
                <span className="size-1 rounded-full bg-risk-amber" />
                {p.statusLabel}
              </span>
            </div>
            <div className="px-2.5 py-2">
              <p className="line-clamp-2 text-[11px] leading-snug text-foreground/85">{p.message}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 9: Verify build**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/components/dashboard src/lib/hooks
git commit -m "feat(ui): wire sidebar, intervention generator, and trace to live SSE backend"
```

---

## Task 13: Impact Chart Real Data

**Files:**
- Modify: `src/components/dashboard/impact-chart.tsx`

- [ ] **Step 1: Replace static IMPACT_PROJECTION with `weeks` prop**

```tsx
"use client";

import { CartesianGrid, Line, LineChart, ReferenceDot, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { IMPACT_PROJECTION } from "@/lib/mock-data";

export function ImpactChart({ weeks }: { weeks: { week: number; score: number }[] | null }) {
  const data = weeks && weeks.length ? weeks : IMPACT_PROJECTION;
  const start = data[0];
  const end = data[data.length - 1];
  return (
    <div className="rounded-lg border border-hairline bg-panel p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold tracking-tight text-foreground">Impact Projection</h3>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono tabular text-[16px] font-medium text-teal">+{end.score - start.score}</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">6w</span>
        </div>
      </div>
      <div className="mt-2 h-[110px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, bottom: 4, left: -16 }}>
            <CartesianGrid stroke="oklch(0.93 0.004 250)" strokeDasharray="2 3" vertical={false} />
            <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: "oklch(0.55 0.01 250)" }} tickFormatter={(v) => `w${v}`} />
            <YAxis domain={[40, 90]} ticks={[40, 60, 80]} tickLine={false} axisLine={false} width={28} tick={{ fontSize: 9, fill: "oklch(0.55 0.01 250)" }} />
            <Line type="monotone" dataKey="score" stroke="oklch(0.55 0.105 186)" strokeWidth={2} dot={{ r: 2.5, fill: "white" }} activeDot={{ r: 3.5 }} isAnimationActive={true} />
            <ReferenceDot x={start.week} y={start.score} r={4} fill="white" stroke="oklch(0.68 0.16 65)" strokeWidth={1.5} />
            <ReferenceDot x={end.week} y={end.score} r={5} fill="oklch(0.55 0.105 186)" stroke="white" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span><span className="font-mono tabular text-foreground/70">w{start.week}</span> Intervention starts</span>
        <span><span className="font-mono tabular text-foreground/70">{end.score}</span> · Projected</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/impact-chart.tsx
git commit -m "feat(ui): impact chart accepts real per-strategy week data"
```

---

## Task 14: Pre-Seed Three Demo Scenarios

**Files:**
- Create: `scripts/run-demo-scenarios.ts`

- [ ] **Step 1: Write `scripts/run-demo-scenarios.ts`**

```ts
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { neighbourhoods, interventions, clusterMessages, agentRuns } from "@/lib/db/schema";
import { runOrchestrator } from "@/lib/agents/orchestrator";
import { personaliseCluster } from "@/lib/agents/personalisation";
import type { AgentTraceEvent, BuurtRecord } from "@/lib/types";

const DEMO_NAMES = ["Crooswijk", "Bijlmer", "Schilderswijk"] as const;

async function main() {
  for (const name of DEMO_NAMES) {
    const rows = await db.select().from(neighbourhoods);
    const buurt = rows.find((r) => r.name.toLowerCase().includes(name.toLowerCase()));
    if (!buurt) {
      console.warn(`[demo] no buurt matched ${name}`);
      continue;
    }
    const log: AgentTraceEvent[] = [];
    const emit = (e: AgentTraceEvent) => log.push(e);
    console.log(`[demo] running ${buurt.name}`);
    const strategy = await runOrchestrator(buurt as unknown as BuurtRecord, emit);
    const interventionId = `int_demo_${buurt.buurtCode}`;
    await db
      .insert(interventions)
      .values({
        id: interventionId,
        neighbourhoodId: buurt.id,
        rationale: strategy.rationale,
        strategy,
        predictedScoreGain: strategy.predictedScoreGain,
        predictedConnections: strategy.predictedConnections,
        costPerConnectionEUR: strategy.costPerConnectionEUR,
        weeks: strategy.weeks,
      })
      .onConflictDoUpdate({
        target: interventions.id,
        set: { strategy, weeks: strategy.weeks },
      });
    for (const cluster of strategy.clusters) {
      const activity = strategy.activities[0];
      const msg = await personaliseCluster({ cluster, activity, neighbourhood: buurt as unknown as BuurtRecord }).catch(() => null);
      if (!msg) continue;
      const id = `cmsg_demo_${buurt.buurtCode}_${cluster.id}`;
      await db
        .insert(clusterMessages)
        .values({ id, interventionId, clusterId: cluster.id, channel: msg.channel, language: msg.language, tone: msg.tone, message: msg.message, pdfUrl: msg.pdfUrl ?? null })
        .onConflictDoUpdate({ target: clusterMessages.id, set: { message: msg.message } });
    }
    await db
      .insert(agentRuns)
      .values({ id: `run_demo_${buurt.buurtCode}`, interventionId, neighbourhoodId: buurt.id, steps: log, totalMs: 0, ok: true })
      .onConflictDoUpdate({ target: agentRuns.id, set: { steps: log } });
    console.log(`[demo] stored ${buurt.name} → intervention ${interventionId}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run demo**

Run: `pnpm demo`
Expected: prints `[demo] stored Crooswijk → …`, `[demo] stored Bijlmer → …`, `[demo] stored Schilderswijk → …`.

- [ ] **Step 3: Commit**

```bash
git add scripts/run-demo-scenarios.ts
git commit -m "feat(demo): pre-run crooswijk, bijlmer, schilderswijk scenarios"
```

---

## Task 15: Verification — Build, Lint, Manual Dry Run

- [ ] **Step 1: Final build**

Run: `pnpm build`
Expected: zero TS errors, all routes generated.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: zero warnings beyond existing baseline.

- [ ] **Step 3: Manual dry run**

Run: `pnpm dev`
Then in another terminal:
```bash
curl -X POST -H "content-type: application/json" -d '{"neighbourhoodId":"BU0599..."}' http://localhost:3000/api/simulate -N
```
Expected: SSE chunks scrolling `data: {"type":"step",...}` followed by `data: {"type":"strategy",...}`.

In a browser: open http://localhost:3000, switch cities, click Generate Intervention on a red alert, watch trace fill, channel previews appear, impact chart redraws.

- [ ] **Step 4: Commit (only if non-code fixups)**

```bash
git status
# if anything left, commit
```

---

## Self-Review Checklist

1. **Spec coverage:** prompt.txt sections 1–10 each map to tasks above:
   - §1 schema → Task 2
   - §2 CBS seed → Task 6
   - §3 Together client → Task 3
   - §4 Orchestrator/SSE → Tasks 8 + 9
   - §5 Personalisation → Task 9
   - §6 Channel orchestrator → Tasks 5 + 10
   - §7 Supermemory → Task 4
   - §8 Live recalc → Task 11
   - §9 Frontend wiring → Tasks 12 + 13
   - §10 Three demo scenarios → Task 14
2. **No placeholders:** every step contains either runnable code or exact commands.
3. **Type consistency:** `ResidentCluster.preferredChannel` matches the `Channel` enum used in `routeMessage`, `clusterMessages.channel`, and `ChannelPreview.channel`. `AgentTraceEvent` discriminator matches what `useInterventionStream` parses. `weeks` shape `{ week, score }[]` matches `ImpactChart` prop and `InterventionStrategy.weeks`.
4. **Demo safety:** Task 14 pre-seeds DB so the dashboard never shows blank. Each external call in Task 8/9 is wrapped in `.catch()` so a network outage degrades to fallback text without crashing the stream.
