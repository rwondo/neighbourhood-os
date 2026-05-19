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
import { cn } from "@/lib/utils";
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

  // Visual hierarchy: while running, Agent Trace is the star. Once a strategy
  // arrives with creatives approved, Channel Previews takes the spotlight.
  const hasApprovals = approvedKeys.size > 0;
  const traceIsStar = running && !hasApprovals;
  const previewsAreStar = hasApprovals;

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-hairline bg-panel">
      {/* Header bar replaces the redundant Context section */}
      <ContextHeader
        selectedName={selectedName}
        focusedBuurt={focusedBuurt}
        showFocused={Boolean(showFocused)}
        running={running}
        error={error}
        strategy={strategy}
      />

      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* AGENT TRACE — elevated visually while orchestrator is running */}
        <SectionHeader
          title="Agent Trace"
          tone={traceIsStar ? "live" : "muted"}
          meta={
            running ? (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] tabular text-teal">
                <span className="size-1.5 animate-blink-soft rounded-full bg-teal" />
                {completedSteps}/{steps.length} steps
              </span>
            ) : (
              <span className="font-mono text-[10px] tabular text-muted-foreground/70">
                {completedSteps}/{steps.length} steps
              </span>
            )
          }
        />
        <div
          className={cn(
            "px-4 transition-colors",
            traceIsStar
              ? "border-b border-hairline-strong bg-teal-soft/30 py-4"
              : "border-b border-hairline py-3",
          )}
        >
          <AgentTrace steps={steps} />
        </div>

        {/* ACTIVITIES */}
        <SectionHeader
          title="Recommended Activities"
          tone="default"
          meta={
            activities.length > 0 ? (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] tabular">
                <span
                  className={cn(
                    "tabular",
                    approvedKeys.size === activities.length
                      ? "text-risk-green"
                      : approvedKeys.size > 0
                        ? "text-teal"
                        : "text-muted-foreground/70",
                  )}
                >
                  {approvedKeys.size}
                </span>
                <span className="text-muted-foreground/50">/</span>
                <span className="text-muted-foreground/70">{activities.length}</span>
                <span className="ml-0.5 text-muted-foreground/60">approved</span>
              </span>
            ) : running ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
                <span className="size-1 animate-blink-soft rounded-full bg-muted-foreground/60" />
                generating
              </span>
            ) : null
          }
        />
        <div className="border-b border-hairline px-4 py-3">
          <ActivitiesList
            activities={activities}
            clusters={clusters}
            running={running}
            approvedKeys={approvedKeys}
            onSelect={(activity, key) => setSelected({ activity, key })}
          />
        </div>

        {/* CHANNEL PREVIEWS — becomes the star post-approval */}
        <SectionHeader
          title="Channel Previews"
          tone={previewsAreStar ? "spotlight" : "default"}
          meta={
            messages.length > 0 ? (
              <span className="font-mono text-[10px] tabular text-muted-foreground/70">
                {messages.length} {messages.length === 1 ? "variant" : "variants"}
              </span>
            ) : null
          }
        />
        <div
          className={cn(
            "border-b border-hairline px-4",
            previewsAreStar ? "bg-canvas/40 py-4" : "py-3",
          )}
        >
          <ChannelPreviews
            messages={messages}
            running={running}
            enrichments={enrichments}
          />
        </div>

        {/* CAMPAIGN METRICS — peer weight, distinct treatment */}
        <SectionHeader
          title="Campaign Metrics"
          tone="default"
          meta={
            selectedName ? (
              <span className="font-mono text-[10px] tabular text-muted-foreground/70">
                projected · 6w
              </span>
            ) : null
          }
        />
        <div className="px-4 py-3">
          <CampaignMetricsPanel borough={selectedName} />
        </div>
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

function ContextHeader({
  selectedName,
  focusedBuurt,
  showFocused,
  running,
  error,
  strategy,
}: {
  selectedName: string | null;
  focusedBuurt: string | null;
  showFocused: boolean;
  running: boolean;
  error: string | null;
  strategy: InterventionStrategy | null;
}) {
  if (!selectedName) {
    return (
      <div className="shrink-0 border-b border-hairline bg-canvas/30 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-hairline bg-panel text-muted-foreground/70">
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="size-3" aria-hidden="true">
              <path d="M7 1.5C4.5 1.5 2.5 3.5 2.5 6c0 3 4.5 6.5 4.5 6.5s4.5-3.5 4.5-6.5c0-2.5-2-4.5-4.5-4.5z" />
              <circle cx="7" cy="6" r="1.5" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-medium leading-tight text-foreground">
              Select a borough to begin
            </p>
            <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">
              Click the map or pick from the sidebar. The orchestrator trace, demographic clusters,
              and per-cluster previews stream live.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Status badge tone
  const statusTone: "live" | "ready" | "idle" | "error" = error
    ? "error"
    : running
      ? "live"
      : strategy
        ? "ready"
        : "idle";

  const statusDot =
    statusTone === "live"
      ? "bg-teal animate-blink-soft"
      : statusTone === "ready"
        ? "bg-risk-green"
        : statusTone === "error"
          ? "bg-risk-red"
          : "bg-muted-foreground/40";

  const statusLabel =
    statusTone === "live"
      ? "Streaming"
      : statusTone === "ready"
        ? "Ready"
        : statusTone === "error"
          ? "Error"
          : "Idle";

  return (
    <div className="shrink-0 border-b border-hairline bg-canvas/40 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex h-4 items-center gap-1 rounded-full bg-panel px-1.5 text-[9px] font-semibold uppercase tracking-[0.06em] ring-1 ring-inset",
                statusTone === "live" && "text-teal ring-teal/25",
                statusTone === "ready" && "text-risk-green ring-risk-green/25",
                statusTone === "error" && "text-risk-red ring-risk-red/25",
                statusTone === "idle" && "text-muted-foreground ring-hairline-strong",
              )}
            >
              <span className={cn("size-1 rounded-full", statusDot)} />
              {statusLabel}
            </span>
            <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground/70">
              Intervention
            </span>
          </div>
          <h2 className="mt-1 truncate text-[15px] font-semibold tracking-tight text-foreground">
            {selectedName}
          </h2>
          {showFocused && focusedBuurt ? (
            <p className="mt-0.5 truncate text-[10.5px] leading-snug text-muted-foreground">
              Worst-CDI buurt: <span className="text-foreground/80">{focusedBuurt}</span>
            </p>
          ) : null}
        </div>

        {strategy ? (
          <div className="flex shrink-0 items-stretch gap-0 overflow-hidden rounded-md border border-hairline bg-panel">
            <Stat
              value={`+${strategy.predictedScoreGain}`}
              unit="pts"
              label="CDI 6w"
              accent="green"
            />
            <span className="w-px self-stretch bg-hairline" aria-hidden="true" />
            <Stat
              value={`€${Math.round(strategy.costPerConnectionEUR)}`}
              label="per conn."
              accent="default"
            />
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-md border border-risk-red/25 bg-risk-red-soft/40 px-2 py-1 text-[10.5px] leading-snug text-risk-red">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" className="mt-0.5 size-2.5 shrink-0" aria-hidden="true">
            <circle cx="6" cy="6" r="4.5" />
            <path d="M6 4v2.5" />
            <path d="M6 8v.01" />
          </svg>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

function Stat({
  value,
  unit,
  label,
  accent,
}: {
  value: string;
  unit?: string;
  label: string;
  accent: "default" | "green";
}) {
  return (
    <div className="flex flex-col items-end justify-center gap-0.5 px-2.5 py-1">
      <div className="flex items-baseline gap-0.5 leading-none">
        <span
          className={cn(
            "font-mono tabular text-[14px] font-semibold",
            accent === "green" ? "text-risk-green" : "text-foreground",
          )}
        >
          {value}
        </span>
        {unit ? (
          <span className="font-mono text-[9px] tabular text-muted-foreground/80">
            {unit}
          </span>
        ) : null}
      </div>
      <span className="text-[9px] uppercase tracking-[0.07em] text-muted-foreground/70">
        {label}
      </span>
    </div>
  );
}

function SectionHeader({
  title,
  meta,
  tone,
}: {
  title: string;
  meta?: React.ReactNode;
  tone: "default" | "live" | "spotlight" | "muted";
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-[1] flex items-center justify-between gap-2 px-4 py-1.5",
        tone === "live" && "border-b border-teal/25 bg-teal-soft/50 backdrop-blur-[2px]",
        tone === "spotlight" && "border-b border-hairline bg-canvas/60",
        tone === "default" && "border-b border-hairline bg-panel/80 backdrop-blur-[1px]",
        tone === "muted" && "border-b border-hairline bg-panel/80",
      )}
    >
      <div className="flex items-center gap-1.5">
        {tone === "live" ? (
          <span className="size-1 shrink-0 animate-blink-soft rounded-full bg-teal" />
        ) : null}
        <h2
          className={cn(
            "text-[10.5px] font-semibold uppercase tracking-[0.09em]",
            tone === "live" ? "text-teal" : "text-muted-foreground",
          )}
        >
          {title}
        </h2>
      </div>
      {meta ?? null}
    </header>
  );
}
