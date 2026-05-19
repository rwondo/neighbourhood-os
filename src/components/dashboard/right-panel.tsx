"use client";

import { useEffect, useMemo, useState } from "react";
import { AgentTrace } from "./agent-trace";
import { ActivitiesList } from "./activities-list";
import {
  ActivityApprovalDialog,
  type ApprovalResult,
} from "./activity-approval-dialog";
import { ChannelPreviews } from "./channel-previews";
import { CampaignMetricsPanel } from "./campaign-metrics-panel";
import { ImpactChart } from "./impact-chart";
import type { TraceStep } from "@/lib/hooks/use-intervention-stream";
import type {
  Channel,
  CityKey,
  ClusterMessage,
  CreativeStatus,
  InterventionStrategy,
  MCPCampaignStatus,
  RecommendedActivity,
} from "@/lib/types";

export type ChannelEnrichment = {
  creativeUrl: string | null;
  creativeStatus: CreativeStatus;
  qrCodeUrl: string | null;
  joinUrl: string | null;
  mcpStatus: MCPCampaignStatus;
  campaignId: string | null;
  adsManagerUrl: string | null;
  fallback: boolean;
};

export type EnrichmentState = Record<string, ChannelEnrichment>;

export function enrichmentKey(clusterId: string, channel: Channel): string {
  return `${clusterId}::${channel}`;
}

export function RightPanel({
  city,
  selectedName,
  focusedBuurt,
  running,
  steps,
  messages,
  strategy,
  error,
}: {
  city: CityKey;
  selectedName: string | null;
  focusedBuurt: string | null;
  running: boolean;
  steps: TraceStep[];
  messages: ClusterMessage[];
  strategy: InterventionStrategy | null;
  error: string | null;
}) {
  const completedSteps = steps.filter((s) => s.status === "completed").length;
  const activities = strategy?.activities ?? [];
  const clusters = strategy?.clusters ?? [];

  const [selected, setSelected] = useState<{ activity: RecommendedActivity; key: string } | null>(
    null,
  );
  const [approvedKeys, setApprovedKeys] = useState<Set<string>>(new Set());
  const [enrichments, setEnrichments] = useState<EnrichmentState>({});

  // Reset approvals when a new strategy lands (each borough gets its own approval state).
  const strategyId = strategy?.neighbourhoodId ?? null;
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setApprovedKeys(new Set());
    setSelected(null);
    setEnrichments({});
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [strategyId]);

  const dialogMessages = useMemo(() => {
    if (!selected) return messages;
    const targetIds = new Set(selected.activity.targetClusters ?? []);
    if (targetIds.size === 0) return messages;
    return messages.filter((m) => targetIds.has(m.clusterId));
  }, [messages, selected]);

  const handleApprovalResult = (result: ApprovalResult) => {
    if (!selected) return;
    setApprovedKeys((prev) => {
      const next = new Set(prev);
      next.add(selected.key);
      return next;
    });
    setEnrichments((prev) => {
      const next: EnrichmentState = { ...prev };
      const mcpByKey = new Map(
        result.mcpResults.map((m) => [enrichmentKey(m.clusterId, m.channel), m]),
      );
      for (const c of result.creatives) {
        const key = enrichmentKey(c.clusterId, c.channel);
        const mcp = mcpByKey.get(key);
        next[key] = {
          creativeUrl: c.creativeUrl,
          creativeStatus: c.creativeStatus,
          qrCodeUrl: c.qrCodeUrl,
          joinUrl: c.joinUrl,
          mcpStatus: mcp?.status ?? "idle",
          campaignId: mcp?.campaignId ?? null,
          adsManagerUrl: mcp?.adsManagerUrl ?? null,
          fallback: mcp?.fallback ?? false,
        };
      }
      // Any MCP-only entries (shouldn't happen, but safe)
      for (const m of result.mcpResults) {
        const key = enrichmentKey(m.clusterId, m.channel);
        if (!next[key]) {
          next[key] = {
            creativeUrl: null,
            creativeStatus: "pending",
            qrCodeUrl: null,
            joinUrl: null,
            mcpStatus: m.status,
            campaignId: m.campaignId,
            adsManagerUrl: m.adsManagerUrl,
            fallback: m.fallback,
          };
        }
      }
      return next;
    });
  };

  const showFocused =
    focusedBuurt && focusedBuurt.toLowerCase() !== (selectedName ?? "").toLowerCase();

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-hairline bg-panel">
      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Section
          title="Context"
          meta={selectedName ? (showFocused ? `${focusedBuurt} · worst CDI` : selectedName) : ""}
        >
          <ContextBlock
            selectedName={selectedName}
            focusedBuurt={focusedBuurt}
            running={running}
            error={error}
            strategy={strategy}
          />
        </Section>

        <Section title="Agent Trace" meta={`${completedSteps}/${steps.length} steps`}>
          <AgentTrace steps={steps} />
        </Section>

        <Section
          title="Activities"
          meta={
            activities.length > 0
              ? `${approvedKeys.size}/${activities.length} approved`
              : running
                ? "loading…"
                : ""
          }
        >
          <ActivitiesList
            activities={activities}
            clusters={clusters}
            running={running}
            approvedKeys={approvedKeys}
            onSelect={(activity, key) => setSelected({ activity, key })}
          />
        </Section>

        <Section title="Channel Previews" meta={`${messages.length || 0} variants`}>
          <ChannelPreviews
            messages={messages}
            running={running}
            enrichments={enrichments}
          />
        </Section>

        <Section
          title="Impact Projection"
          meta={
            strategy
              ? `+${strategy.predictedScoreGain} pts · 6w`
              : running
                ? "computing…"
                : ""
          }
        >
          <ImpactChart weeks={strategy?.weeks ?? null} />
        </Section>

        <Section title="Campaign Metrics" meta={selectedName ?? ""}>
          <CampaignMetricsPanel borough={selectedName} />
        </Section>
      </div>

      <ActivityApprovalDialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        activity={selected?.activity ?? null}
        clusters={clusters}
        messages={dialogMessages}
        borough={selectedName}
        city={city}
        alreadyApproved={selected ? approvedKeys.has(selected.key) : false}
        onApproved={handleApprovalResult}
      />
    </aside>
  );
}

function ContextBlock({
  selectedName,
  focusedBuurt,
  running,
  error,
  strategy,
}: {
  selectedName: string | null;
  focusedBuurt: string | null;
  running: boolean;
  error: string | null;
  strategy: InterventionStrategy | null;
}) {
  if (!selectedName) {
    return (
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Click a borough on the map or open one from the sidebar to start. The dashboard will
        stream the orchestrator trace, demographic-matched activities, and per-cluster previews
        live.
      </p>
    );
  }

  const showFocused =
    focusedBuurt && focusedBuurt.toLowerCase() !== selectedName.toLowerCase();

  return (
    <div className="rounded-lg border border-hairline bg-panel p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="truncate text-[12.5px] font-semibold tracking-tight text-foreground">
          {selectedName}
        </h3>
        {strategy ? (
          <span className="shrink-0 font-mono tabular text-[10px] text-muted-foreground">
            +{strategy.predictedScoreGain} pts · 6w
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        {showFocused ? (
          <>
            Worst-CDI buurt:{" "}
            <span className="text-foreground/80">{focusedBuurt}</span>
          </>
        ) : running ? (
          "Streaming orchestrator output…"
        ) : strategy ? (
          <>
            {strategy.activities.length} activities ·{" "}
            {strategy.clusters.length} clusters · €
            <span className="text-foreground/80">
              {Math.round(strategy.costPerConnectionEUR)}
            </span>{" "}
            per connection
          </>
        ) : (
          "Awaiting orchestrator…"
        )}
      </p>
      {error ? (
        <p className="mt-1 text-[10.5px] text-risk-red">Error: {error}</p>
      ) : null}
    </div>
  );
}

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
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
