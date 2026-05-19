import { NextRequest } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { neighbourhoods, interventions, clusterMessages, agentRuns } from "@/lib/db/schema";
import { runOrchestrator, type Emit } from "@/lib/agents/orchestrator";
import { personaliseCluster } from "@/lib/agents/personalisation";
import { createSSEStream } from "@/lib/sse";
import { makeLogger } from "@/lib/log";
import type { AgentTraceEvent, BuurtRecord, CityKey, ClusterMessage } from "@/lib/types";

const log = makeLogger("api:simulate");

export const runtime = "nodejs";

type SimulatePayload = {
  neighbourhoodId?: string;
  borough?: string;
  city?: CityKey;
};

async function resolveBuurt(p: SimulatePayload): Promise<BuurtRecord | null> {
  if (p.neighbourhoodId) {
    const [row] = await db.select().from(neighbourhoods).where(eq(neighbourhoods.id, p.neighbourhoodId));
    if (row) {
      log.info("resolved buurt by neighbourhoodId", {
        id: row.id,
        name: row.name,
        buurtCode: row.buurtCode,
      });
      return row as unknown as BuurtRecord;
    }
    log.warn("neighbourhoodId not found", { neighbourhoodId: p.neighbourhoodId });
  }
  if (p.borough) {
    const cityFilter = p.city ? eq(neighbourhoods.city, p.city) : undefined;
    const boroughFilter = sql`${neighbourhoods.borough} = ${p.borough}`;
    const where = cityFilter ? and(cityFilter, boroughFilter) : boroughFilter;
    const rows = await db
      .select()
      .from(neighbourhoods)
      .where(where)
      .orderBy(sql`${neighbourhoods.cdi} DESC NULLS LAST`)
      .limit(1);
    if (rows[0]) {
      log.info("resolved buurt by borough (worst CDI)", {
        borough: p.borough,
        city: p.city,
        chosen: { id: rows[0].id, name: rows[0].name, buurtCode: rows[0].buurtCode, cdi: rows[0].cdi },
      });
      return rows[0] as unknown as BuurtRecord;
    }
    log.warn("borough has no buurten", { borough: p.borough, city: p.city });
  }
  return null;
}

export async function POST(req: NextRequest) {
  let payload: SimulatePayload;
  try {
    payload = (await req.json()) as SimulatePayload;
  } catch {
    log.warn("invalid JSON body");
    return new Response("Invalid JSON body", { status: 400 });
  }
  log.info("POST /api/simulate", payload);

  const buurt = await resolveBuurt(payload).catch((err) => {
    log.error("resolveBuurt threw", err);
    return null;
  });
  if (!buurt) {
    log.warn("simulate aborted — no buurt resolved", payload);
    return new Response("Neighbourhood not found", { status: 404 });
  }

  const { stream, send, close } = createSSEStream();
  const traceLog: AgentTraceEvent[] = [];
  const emit: Emit = (event) => {
    traceLog.push(event);
    if (event.type === "step") {
      log.info(`SSE step ${event.id} ${event.status}`, { label: event.label, detail: event.detail });
    } else if (event.type === "error") {
      log.error("SSE error event", { message: event.message });
    }
    send(event);
  };

  (async () => {
    const startedAt = Date.now();
    let interventionId: string | null = null;
    let pipelineOk = true;

    try {
      emit({ type: "info", key: "buurt", value: buurt.name });
      emit({ type: "info", key: "buurtCode", value: buurt.buurtCode });

      // ── Steps 1-4 (Supermemory → web search → clusters → strategy) ─────
      const plan = await runOrchestrator(buurt, emit);

      // ── Step 5: parallel personalisation, stream each as it lands ─────
      interventionId = `int_${buurt.buurtCode}_${Date.now()}`;
      let messages: ClusterMessage[] = [];
      if (plan.activities.length === 0) {
        emit({
          type: "step",
          id: "s5",
          label: "Personalising messages per cluster",
          status: "skipped",
          detail: "no real events found — nothing to personalise",
        });
      } else {
        emit({ type: "step", id: "s5", label: "Personalising messages per cluster", status: "active" });
        const primaryActivity = plan.activities[0];
        messages = await Promise.all(
          plan.clusters.map(async (cluster, idx) => {
            const matched = plan.activities.find((a) => (a.targetClusters ?? []).includes(cluster.id));
            const activity = matched ?? plan.activities[idx % plan.activities.length] ?? primaryActivity;
            try {
              const msg = await personaliseCluster({ cluster, activity, neighbourhood: buurt });
              emit({ type: "cluster_message", message: msg });
              return msg;
            } catch (err) {
              const note = err instanceof Error ? err.message : "unknown agent failure";
              const degraded: ClusterMessage = {
                clusterId: cluster.id,
                channel: cluster.preferredChannel,
                language: cluster.language[0] ?? "nl",
                tone: `${cluster.profile} (degraded)`,
                message: `(${cluster.profile}) Activity-framed invitation for ${activity.name} could not be generated — agent error: ${note}.`,
              };
              emit({ type: "cluster_message", message: degraded });
              return degraded;
            }
          }),
        );
        emit({
          type: "step",
          id: "s5",
          label: "Personalising messages per cluster",
          status: "completed",
          detail: `${messages.length} variants generated`,
        });
      }

      // ── Step 6: persist strategy + messages ───────────────────────────
      emit({ type: "step", id: "s6", label: "Storing strategy and messages", status: "active" });
      try {
        await db.insert(interventions).values({
          id: interventionId,
          neighbourhoodId: buurt.id,
          rationale: plan.strategy.rationale,
          strategy: plan.strategy,
          predictedScoreGain: plan.strategy.predictedScoreGain,
          predictedConnections: plan.strategy.predictedConnections,
          costPerConnectionEUR: plan.strategy.costPerConnectionEUR,
          weeks: plan.strategy.weeks,
        });

        await Promise.all(
          messages.map((msg, i) =>
            db.insert(clusterMessages).values({
              id: `cmsg_${interventionId}_${msg.clusterId}_${i}`,
              interventionId: interventionId!,
              clusterId: msg.clusterId,
              channel: msg.channel,
              language: msg.language,
              tone: msg.tone,
              message: msg.message,
              pdfUrl: msg.pdfUrl ?? null,
            }),
          ),
        );
        emit({
          type: "step",
          id: "s6",
          label: "Storing strategy and messages",
          status: "completed",
          detail: `Strategy and ${messages.length} message variants saved`,
        });
      } catch (err) {
        pipelineOk = false;
        const note = err instanceof Error ? err.message : "db error";
        emit({ type: "step", id: "s6", label: "Storing strategy and messages", status: "error", detail: note });
      }

      // ── Step 7: stream final ready signal ─────────────────────────────
      emit({ type: "step", id: "s7", label: "Streaming results to dashboard", status: "active" });
      emit({ type: "step", id: "s7", label: "Streaming results to dashboard", status: "completed", detail: `${messages.length} previews on screen` });

      try {
        await db.insert(agentRuns).values({
          id: `run_${interventionId ?? Date.now()}`,
          interventionId: interventionId ?? null,
          neighbourhoodId: buurt.id,
          steps: traceLog,
          totalMs: Date.now() - startedAt,
          ok: pipelineOk,
        });
      } catch {
        /* never let agent_runs failure crash the demo */
      }

      log.info("pipeline complete", {
        buurt: buurt.name,
        interventionId,
        ms: Date.now() - startedAt,
        ok: pipelineOk,
      });
      emit({ type: "done" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error("pipeline crashed", err);
      emit({ type: "error", message });
      try {
        await db.insert(agentRuns).values({
          id: `run_err_${Date.now()}`,
          interventionId: interventionId ?? null,
          neighbourhoodId: buurt.id,
          steps: traceLog,
          totalMs: Date.now() - startedAt,
          ok: false,
        });
      } catch {
        /* swallow */
      }
    } finally {
      close();
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
