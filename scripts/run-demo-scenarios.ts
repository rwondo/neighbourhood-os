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
