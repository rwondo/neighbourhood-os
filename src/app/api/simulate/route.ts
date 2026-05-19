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
