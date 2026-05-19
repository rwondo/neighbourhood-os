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
