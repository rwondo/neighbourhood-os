import { jsonOrchestratorCall } from "@/lib/together";
import { queryNeighbourhood } from "@/lib/memory";
import { makeLogger } from "@/lib/log";
import { ORCHESTRATOR_SYSTEM } from "./prompts";
import { searchLocalActivities } from "./web-search";
import { identifyClusters } from "./clusters";
import type {
  AgentTraceEvent,
  BuurtRecord,
  InterventionStrategy,
  RecommendedActivity,
  ResidentCluster,
  StepStatus,
} from "@/lib/types";
import type { RetrievalHit } from "@/lib/memory/types";

const log = makeLogger("agent:orchestrator");

export type Emit = (event: AgentTraceEvent) => void;

export type OrchestratorPlan = {
  strategy: InterventionStrategy;
  clusters: ResidentCluster[];
  activities: RecommendedActivity[];
};

const STRATEGY_SCHEMA = `{
  "rationale": "string — 2-3 sentences citing the dominant numeric signals (e.g. living-alone %, 65+ %, low-income index)",
  "activities": [{
    "name":"string","description":"string","venue":"string","whenISO":"string","source":"string",
    "targetClusters":["string — cluster ids from the input list, 1-2 per activity"]
  }],
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

function emitStep(
  emit: Emit,
  id: string,
  label: string,
  status: StepStatus,
  detail?: string,
): void {
  const evt: AgentTraceEvent = detail
    ? { type: "step", id, label, status, detail }
    : { type: "step", id, label, status };
  emit(evt);
}

// Steps 1 and 3 finish near-instantly on the happy path (cold memory,
// deterministic cluster identification). Add a small floor so the agent trace
// reads as a sequence of work rather than a flicker.
async function withMinDuration<T>(minMs: number, fn: () => Promise<T> | T): Promise<T> {
  const startedAt = Date.now();
  const result = await fn();
  const elapsed = Date.now() - startedAt;
  if (elapsed < minMs) await new Promise((r) => setTimeout(r, minMs - elapsed));
  return result;
}

function memorySnippet(hits: RetrievalHit[]): string {
  if (!hits.length) return "(no prior memory for this neighbourhood)";
  return hits
    .map((h) => `- [${h.source}] ${h.content.replace(/\s+/g, " ").slice(0, 220)}`)
    .join("\n");
}

function isoInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(15, 30, 0, 0);
  return d.toISOString();
}

function isHttpUrl(s: unknown): s is string {
  if (typeof s !== "string" || !s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function normaliseActivities(
  activities: RecommendedActivity[],
  clusters: ResidentCluster[],
): RecommendedActivity[] {
  const now = Date.now();
  // Stagger fallback dates so the UI doesn't show three identical timestamps
  // when the LLM hands back a date in the past or unparseable form.
  const fallbackOffsets = [3, 6, 9, 12];
  const clusterIds = clusters.map((c) => c.id);
  const out: RecommendedActivity[] = [];
  activities.forEach((a, i) => {
    // URL: required. If `url` is missing/invalid but `source` is a valid URL,
    // promote source → url so we keep the activity. Drop activities that
    // have neither (we refuse to show fabricated events).
    const sourceIsUrl = isHttpUrl(a.source);
    const url = isHttpUrl(a.url) ? a.url : sourceIsUrl ? a.source : null;
    if (!url) return;
    const source = sourceIsUrl
      ? new URL(a.source as string).hostname.replace(/^www\./, "")
      : (a.source ?? "");

    // Date: must parse and be strictly in the future.
    let when = a.whenISO;
    const parsed = Date.parse(when ?? "");
    if (!Number.isFinite(parsed) || parsed <= now) {
      when = isoInDays(fallbackOffsets[i] ?? 3 + i);
    }

    // Target clusters: 1-2 valid cluster IDs. Filter junk from LLM output;
    // if empty, assign one cluster round-robin so every cluster is covered.
    const provided = Array.isArray(a.targetClusters) ? a.targetClusters : [];
    const valid = provided.filter((id) => clusterIds.includes(id));
    const targetClusters = valid.length
      ? valid.slice(0, 2)
      : clusterIds.length
        ? [clusterIds[i % clusterIds.length]]
        : [];

    out.push({ ...a, whenISO: when, url, source, targetClusters });
  });
  return out;
}

function ensureClusterCoverage(
  activities: RecommendedActivity[],
  clusters: ResidentCluster[],
): RecommendedActivity[] {
  if (!activities.length || !clusters.length) return activities;
  const covered = new Set<string>();
  for (const a of activities) for (const id of a.targetClusters ?? []) covered.add(id);
  const missing = clusters.map((c) => c.id).filter((id) => !covered.has(id));
  if (missing.length === 0) return activities;
  // Append missing cluster IDs to activities round-robin so every cluster has at least one match.
  const out = activities.map((a) => ({ ...a, targetClusters: [...(a.targetClusters ?? [])] }));
  missing.forEach((id, i) => {
    const target = out[i % out.length];
    if (!target.targetClusters!.includes(id)) target.targetClusters!.push(id);
  });
  return out;
}

function buildWeeks(start: number, gain: number): { week: number; score: number }[] {
  const safeGain = Math.max(2, Math.min(25, Math.round(gain)));
  const weeks: { week: number; score: number }[] = [];
  for (let w = 1; w <= 6; w++) {
    // Sigmoid-ish ramp from start → start+gain over 6 weeks
    const t = (w - 1) / 5;
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    weeks.push({ week: w, score: Math.round(start + safeGain * eased) });
  }
  return weeks;
}

function fallbackStrategy(
  neighbourhood: BuurtRecord,
  activities: RecommendedActivity[],
  clusters: ResidentCluster[],
): InterventionStrategy {
  const start = Math.round(neighbourhood.score);
  const normalisedActivities = ensureClusterCoverage(
    normaliseActivities(activities.slice(0, 3), clusters),
    clusters,
  );
  return {
    neighbourhoodId: neighbourhood.id,
    rationale: `${neighbourhood.name} is flagged because ${neighbourhood.pctLivingAlone.toFixed(0)}% of residents live alone and ${neighbourhood.pctElderly65.toFixed(0)}% are 65+. Three resident clusters identified; a low-friction local activity programme can lift social fabric over six weeks.`,
    activities: normalisedActivities,
    clusters,
    predictedScoreGain: 12,
    predictedConnections: clusters.reduce((s, c) => s + Math.round(c.estimatedSize * 0.04), 8),
    costPerConnectionEUR: 420,
    weeks: buildWeeks(start, 12),
  };
}

export async function runOrchestrator(
  neighbourhood: BuurtRecord,
  emit: Emit,
): Promise<OrchestratorPlan> {
  log.info("pipeline start", {
    buurt: neighbourhood.name,
    buurtCode: neighbourhood.buurtCode,
    city: neighbourhood.city,
    score: neighbourhood.score,
  });

  // ── Step 1: neighbourhood memory ────────────────────────────────────────
  emitStep(emit, "s1", "Retrieving neighbourhood memory", "active");
  let profileHits: RetrievalHit[] = [];
  let outcomeHits: RetrievalHit[] = [];
  const t1 = Date.now();
  const memoryScope = { borough: neighbourhood.borough, city: neighbourhood.city };
  try {
    const [p, o] = await withMinDuration(1400, () =>
      Promise.all([
        queryNeighbourhood(
          neighbourhood.buurtCode,
          "demographic profile and risk factors",
          memoryScope,
        ).catch((err) => {
          log.warn("memory.profile query failed", err);
          return [] as RetrievalHit[];
        }),
        queryNeighbourhood(
          neighbourhood.buurtCode,
          "past intervention outcomes and attendance",
          memoryScope,
        ).catch((err) => {
          log.warn("memory.outcome query failed", err);
          return [] as RetrievalHit[];
        }),
      ]),
    );
    profileHits = p;
    outcomeHits = o;
    log.info("memory hits", {
      buurtCode: neighbourhood.buurtCode,
      profileHits: profileHits.length,
      outcomeHits: outcomeHits.length,
      sources: [...profileHits, ...outcomeHits].map((h) => h.source),
      ms: Date.now() - t1,
    });
    if (profileHits.length === 0 && outcomeHits.length === 0) {
      const probedTags = neighbourhood.borough
        ? `buurt_${neighbourhood.buurtCode} or borough_${neighbourhood.city}_${neighbourhood.borough}`
        : `buurt_${neighbourhood.buurtCode}`;
      emitStep(
        emit,
        "s1",
        "Retrieving neighbourhood memory",
        "skipped",
        `no memory found (${probedTags}) — run \`pnpm seed:memory\``,
      );
    } else {
      emitStep(
        emit,
        "s1",
        "Retrieving neighbourhood memory",
        "completed",
        `${profileHits.length + outcomeHits.length} memory hits`,
      );
    }
  } catch (err) {
    log.error("memory unavailable", err);
    emitStep(emit, "s1", "Retrieving neighbourhood memory", "skipped", "memory unavailable");
  }

  // ── Step 2: Web search for local activities ───────────────────────────
  const boroughScope = neighbourhood.borough;
  const stepLabel = boroughScope
    ? `Scraping live events in ${boroughScope}`
    : "Scraping live events on the web";
  emitStep(emit, "s2", stepLabel, "active");
  const search = await searchLocalActivities(neighbourhood, boroughScope);
  log.info("web search result", {
    source: search.source,
    count: search.activities.length,
    borough: boroughScope,
  });
  const stepStatus: "completed" | "skipped" =
    search.activities.length > 0 ? "completed" : "skipped";
  const scopeLabel =
    search.source === "borough"
      ? `in ${boroughScope}`
      : search.source === "borough+city"
        ? `in ${boroughScope} + city-wide top-up`
        : search.source === "city"
          ? `city-wide (borough sparse)`
          : "no real events found";
  const stepDetail =
    search.activities.length > 0
      ? `${search.activities.length} URL-backed events · ${scopeLabel}`
      : `no real events found ${boroughScope ? `in ${boroughScope}` : ""} — orchestrator will skip activity matching`.trim();
  emitStep(emit, "s2", stepLabel, stepStatus, stepDetail);

  // ── Step 3: Identify 3 resident clusters ──────────────────────────────
  emitStep(emit, "s3", "Identifying resident clusters", "active");
  const clusters = await withMinDuration(1600, () => identifyClusters(neighbourhood));
  log.info("clusters identified", {
    count: clusters.length,
    clusters: clusters.map((c) => ({
      id: c.id,
      profile: c.profile,
      channel: c.preferredChannel,
      size: c.estimatedSize,
    })),
  });
  emitStep(
    emit,
    "s3",
    "Identifying resident clusters",
    "completed",
    clusters.map((c) => c.profile.split(",")[0]).join(" · "),
  );

  // ── Step 4: Generate strategy ─────────────────────────────────────────
  emitStep(emit, "s4", "Generating bespoke intervention strategy", "active");
  const cityLabelMap = {
    rotterdam: "Rotterdam",
    amsterdam: "Amsterdam",
    denhaag: "Den Haag",
  } as const;
  const city = cityLabelMap[neighbourhood.city] ?? neighbourhood.city;
  const today = new Date().toISOString().slice(0, 10);
  const candidateBlock = search.activities.length
    ? search.activities
        .map(
          (a, i) =>
            `${i + 1}. name="${a.name}" | venue="${a.venue}" | whenISO="${a.whenISO}" | url="${a.url ?? ""}" | source="${a.source ?? ""}"`,
        )
        .join("\n")
    : "(none — web search returned 0 URL-backed events for this borough)";
  const user = `Neighbourhood: ${neighbourhood.name} (buurt ${neighbourhood.buurtCode}), borough ${neighbourhood.borough ?? "unknown"}, ${city}.
Current social fabric score: ${neighbourhood.score} (lower = worse).
Today is ${today}. All activity whenISO values must be strictly after this date.

Demographic signals (% unless noted):
- Living alone: ${neighbourhood.pctLivingAlone.toFixed(1)}%
- 65+: ${neighbourhood.pctElderly65.toFixed(1)}%
- Single parent: ${neighbourhood.pctSingleParent.toFixed(1)}%
- Low-income index: ${neighbourhood.lowIncomeIndex.toFixed(1)}
- Amenity distance: ${neighbourhood.amenityDistanceKm.toFixed(2)} km
- Population turnover: ${neighbourhood.populationTurnover.toFixed(1)}%

Past memory (profile):
${memorySnippet(profileHits)}

Past memory (outcomes):
${memorySnippet(outcomeHits)}

Identified resident clusters (use these exact 3, do not invent new ones):
${JSON.stringify(clusters, null, 2)}

REAL activity candidates from web search (already filtered to URL-backed events in this borough):
${candidateBlock}

Return JSON matching this schema EXACTLY:
${STRATEGY_SCHEMA}

Rules:
- Pick UP TO ${Math.min(8, Math.max(0, search.activities.length))} activities, ALL from the candidate list above. Do NOT invent activities. Do NOT make up new venues or events. Copy each activity's name, venue, whenISO, url, and source verbatim. You may polish the description into one clear sentence.
- Prefer keeping as many real events as fit the demographic mix — variety helps cover clusters with different interests. Drop a candidate only if it duplicates another or genuinely fits none of the 3 clusters.
- If the candidate list is empty, return "activities": [] and proceed with rationale + clusters + weeks only.
- Echo the 3 clusters above unchanged (keep id, profile, ageRange, digitalLiteracy, preferredChannel, language, estimatedSize, notes).
- Each picked activity MUST include "targetClusters": an array of 1-2 cluster ids from the list above that the activity genuinely fits (match by ageRange, digital literacy, language, lifestyle). Do not assign an activity to a cluster whose age range or language wouldn't realistically attend.
- Across the activities you pick, every cluster id should appear in at least one targetClusters list when possible.
- Every "whenISO" must be a valid ISO 8601 datetime strictly after ${today}.
- "weeks" must have 6 entries, week 1..6, monotonically non-decreasing, starting near ${neighbourhood.score}.
- predictedScoreGain should be between 6 and 18.
- costPerConnectionEUR should be 250-650.`;

  let strategyCore: Omit<InterventionStrategy, "neighbourhoodId">;
  try {
    strategyCore = await jsonOrchestratorCall<Omit<InterventionStrategy, "neighbourhoodId">>({
      system: ORCHESTRATOR_SYSTEM,
      user,
      label: "strategy-gen",
    });
    if (
      !strategyCore ||
      !Array.isArray(strategyCore.activities) ||
      !Array.isArray(strategyCore.weeks)
    ) {
      throw new Error("orchestrator returned malformed strategy");
    }
    log.info("strategy generated", {
      activities: strategyCore.activities.length,
      clusters: Array.isArray(strategyCore.clusters) ? strategyCore.clusters.length : 0,
      weeks: strategyCore.weeks.length,
      predictedScoreGain: strategyCore.predictedScoreGain,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("strategy generation failed — using deterministic fallback", { message });
    emitStep(
      emit,
      "s4",
      "Generating bespoke intervention strategy",
      "skipped",
      `LLM unavailable — using deterministic fallback (${message})`,
    );
    const strategy = fallbackStrategy(neighbourhood, search.activities, clusters);
    emit({ type: "strategy", strategy });
    return { strategy, clusters, activities: strategy.activities };
  }

  // Ensure cluster identity and weeks. Keep up to 8 activities so under-served
  // boroughs still show real options when search returns lots of variety.
  // Any throw inside normalisation here would leave s4 stuck on "active" — wrap and degrade.
  try {
    const rawActivities =
      Array.isArray(strategyCore.activities) && strategyCore.activities.length > 0
        ? strategyCore.activities.slice(0, 8)
        : search.activities.slice(0, 8);
    const safeActivities = ensureClusterCoverage(
      normaliseActivities(rawActivities, clusters),
      clusters,
    );
    const safeWeeks =
      Array.isArray(strategyCore.weeks) && strategyCore.weeks.length === 6
        ? strategyCore.weeks
        : buildWeeks(neighbourhood.score, strategyCore.predictedScoreGain ?? 12);
    const strategy: InterventionStrategy = {
      neighbourhoodId: neighbourhood.id,
      rationale: strategyCore.rationale ?? `${neighbourhood.name} flagged by sensing layer.`,
      activities: safeActivities,
      clusters,
      predictedScoreGain: Math.max(4, Math.min(22, strategyCore.predictedScoreGain ?? 12)),
      predictedConnections: Math.max(4, Math.round(strategyCore.predictedConnections ?? 18)),
      costPerConnectionEUR: Math.max(180, Math.round(strategyCore.costPerConnectionEUR ?? 420)),
      weeks: safeWeeks,
    };
    const baseScore = Math.round(neighbourhood.score);
    const projectedScore = Math.round(neighbourhood.score + strategy.predictedScoreGain);
    emitStep(
      emit,
      "s4",
      "Generating bespoke intervention strategy",
      "completed",
      `${safeActivities.length} activities · +${strategy.predictedScoreGain} social-fabric points (${baseScore} → ${projectedScore} by week 6)`,
    );
    emit({ type: "strategy", strategy });
    return { strategy, clusters, activities: strategy.activities };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("strategy normalisation failed — using deterministic fallback", { message });
    emitStep(
      emit,
      "s4",
      "Generating bespoke intervention strategy",
      "skipped",
      `normalisation error — using deterministic fallback (${message})`,
    );
    const strategy = fallbackStrategy(neighbourhood, search.activities, clusters);
    emit({ type: "strategy", strategy });
    return { strategy, clusters, activities: strategy.activities };
  }
}
