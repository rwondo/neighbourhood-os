"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

type Tone = "green" | "amber" | "red";

type FunnelRow = {
  label: string;
  value: number;
  unit?: string;
  vsPrevious?: number; // percentage 0..1
  trend?: "up" | "down" | "flat";
  tone: Tone;
};

type ChannelRow = { channel: string; optIns: number };

type CampaignMetrics = {
  funnel: FunnelRow[];
  weeklyConnections: { week: number; connections: number }[];
  perChannel: ChannelRow[];
  costPerConnectionEUR: number;
};

function hashBorough(borough: string): number {
  let h = 0;
  for (let i = 0; i < borough.length; i++) {
    h = (h * 31 + borough.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const CROOSWIJK: CampaignMetrics = {
  funnel: [
    { label: "Leaflets distributed", value: 4200, tone: "green" },
    {
      label: "QR scans / SMS opt-ins",
      value: 612,
      vsPrevious: 0.146,
      trend: "up",
      tone: "green",
    },
    {
      label: "WhatsApp opt-ins",
      value: 358,
      vsPrevious: 0.585,
      trend: "up",
      tone: "green",
    },
    {
      label: "WhatsApp reads",
      value: 328,
      vsPrevious: 0.916,
      trend: "up",
      tone: "green",
    },
    {
      label: "Event RSVPs",
      value: 142,
      vsPrevious: 0.433,
      trend: "up",
      tone: "amber",
    },
    {
      label: "Estimated attendance",
      value: 114,
      vsPrevious: 0.803,
      trend: "up",
      tone: "green",
    },
    {
      label: "Return visit (week 2)",
      value: 76,
      vsPrevious: 0.667,
      trend: "up",
      tone: "green",
    },
    {
      label: "Connections formed",
      value: 41,
      vsPrevious: 0.539,
      trend: "up",
      tone: "green",
    },
    {
      label: "Cost per connection",
      value: 420,
      unit: "€",
      vsPrevious: -0.928,
      trend: "down",
      tone: "green",
    },
  ],
  weeklyConnections: [
    { week: 1, connections: 4 },
    { week: 2, connections: 9 },
    { week: 3, connections: 14 },
    { week: 4, connections: 22 },
    { week: 5, connections: 32 },
    { week: 6, connections: 41 },
  ],
  perChannel: [
    { channel: "WhatsApp", optIns: 358 },
    { channel: "SMS", optIns: 174 },
    { channel: "Leaflet", optIns: 102 },
    { channel: "Meta", optIns: 86 },
    { channel: "TikTok", optIns: 39 },
  ],
  costPerConnectionEUR: 420,
};

const CHANNEL_HEX: Record<string, string> = {
  WhatsApp: "oklch(0.69 0.16 150)",
  SMS: "oklch(0.62 0.1 220)",
  Leaflet: "oklch(0.68 0.16 65)",
  Meta: "oklch(0.5 0.18 260)",
  TikTok: "oklch(0.6 0.2 20)",
};

function formatNumber(n: number, unit?: string): string {
  if (unit === "€") return `€${Math.round(n).toLocaleString("en-GB")}`;
  if (n >= 1000) return n.toLocaleString("en-GB");
  return String(Math.round(n));
}

function formatPct(p: number): string {
  const pct = Math.round(p * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

const BIJLMER: CampaignMetrics = {
  funnel: [
    { label: "Instagram + TikTok impressions", value: 38_400, tone: "green" },
    {
      label: "Ad clicks to opt-in page",
      value: 1_124,
      vsPrevious: 0.082,
      trend: "up",
      tone: "green",
    },
    { label: "WhatsApp opt-ins", value: 612, vsPrevious: 0.31, trend: "up", tone: "green" },
    { label: "WhatsApp reads (EN/NL)", value: 558, vsPrevious: 0.91, trend: "up", tone: "green" },
    { label: "Event RSVPs", value: 188, vsPrevious: 0.52, trend: "up", tone: "amber" },
    { label: "Estimated attendance", value: 152, vsPrevious: 0.81, trend: "up", tone: "green" },
    { label: "Return visit (week 2)", value: 94, vsPrevious: 0.62, trend: "up", tone: "green" },
    { label: "Connections formed", value: 54, vsPrevious: 0.48, trend: "up", tone: "green" },
    {
      label: "Cost per connection",
      value: 380,
      unit: "€",
      vsPrevious: -0.934,
      trend: "down",
      tone: "green",
    },
  ],
  weeklyConnections: [
    { week: 1, connections: 5 },
    { week: 2, connections: 12 },
    { week: 3, connections: 19 },
    { week: 4, connections: 29 },
    { week: 5, connections: 42 },
    { week: 6, connections: 54 },
  ],
  perChannel: [
    { channel: "WhatsApp", optIns: 612 },
    { channel: "Meta", optIns: 244 },
    { channel: "TikTok", optIns: 188 },
    { channel: "SMS", optIns: 64 },
    { channel: "Leaflet", optIns: 28 },
  ],
  costPerConnectionEUR: 380,
};

const SCHILDERSWIJK: CampaignMetrics = {
  funnel: [
    { label: "Leaflets distributed", value: 6_800, tone: "green" },
    { label: "QR scans / SMS opt-ins", value: 742, vsPrevious: 0.118, trend: "up", tone: "green" },
    { label: "WhatsApp opt-ins", value: 426, vsPrevious: 0.49, trend: "up", tone: "green" },
    { label: "WhatsApp reads", value: 394, vsPrevious: 0.92, trend: "up", tone: "green" },
    { label: "Event RSVPs", value: 168, vsPrevious: 0.4, trend: "up", tone: "amber" },
    { label: "Estimated attendance", value: 132, vsPrevious: 0.79, trend: "up", tone: "green" },
    { label: "Return visit (week 2)", value: 84, vsPrevious: 0.64, trend: "up", tone: "green" },
    { label: "Connections formed", value: 47, vsPrevious: 0.51, trend: "up", tone: "green" },
    {
      label: "Cost per connection",
      value: 465,
      unit: "€",
      vsPrevious: -0.92,
      trend: "down",
      tone: "green",
    },
  ],
  weeklyConnections: [
    { week: 1, connections: 4 },
    { week: 2, connections: 10 },
    { week: 3, connections: 17 },
    { week: 4, connections: 26 },
    { week: 5, connections: 36 },
    { week: 6, connections: 47 },
  ],
  perChannel: [
    { channel: "WhatsApp", optIns: 426 },
    { channel: "SMS", optIns: 218 },
    { channel: "Leaflet", optIns: 134 },
    { channel: "Meta", optIns: 78 },
    { channel: "TikTok", optIns: 42 },
  ],
  costPerConnectionEUR: 465,
};

// Deterministic synthetic metrics so no borough card ever shows blank state.
// Scaled from a baseline using a stable hash of the borough name.
function syntheticMetrics(borough: string): CampaignMetrics {
  const seed = hashBorough(borough);
  const wobble = (n: number, range: number) =>
    Math.max(1, Math.round(n * (1 + ((seed % 1000) / 1000 - 0.5) * range)));
  const base = {
    leaflets: 3800,
    optIns: 540,
    waOpt: 312,
    waReads: 286,
    rsvps: 124,
    attend: 100,
    return: 64,
    conns: 36,
    cost: 440,
  };
  return {
    funnel: [
      { label: "Leaflets + ad impressions", value: wobble(base.leaflets, 0.35), tone: "green" },
      {
        label: "QR scans / ad opt-ins",
        value: wobble(base.optIns, 0.22),
        vsPrevious: 0.13,
        trend: "up",
        tone: "green",
      },
      {
        label: "WhatsApp opt-ins",
        value: wobble(base.waOpt, 0.22),
        vsPrevious: 0.46,
        trend: "up",
        tone: "green",
      },
      {
        label: "WhatsApp reads",
        value: wobble(base.waReads, 0.22),
        vsPrevious: 0.91,
        trend: "up",
        tone: "green",
      },
      {
        label: "Event RSVPs",
        value: wobble(base.rsvps, 0.22),
        vsPrevious: 0.42,
        trend: "up",
        tone: "amber",
      },
      {
        label: "Estimated attendance",
        value: wobble(base.attend, 0.22),
        vsPrevious: 0.78,
        trend: "up",
        tone: "green",
      },
      {
        label: "Return visit (week 2)",
        value: wobble(base.return, 0.22),
        vsPrevious: 0.61,
        trend: "up",
        tone: "green",
      },
      {
        label: "Connections formed",
        value: wobble(base.conns, 0.22),
        vsPrevious: 0.5,
        trend: "up",
        tone: "green",
      },
      {
        label: "Cost per connection",
        value: wobble(base.cost, 0.15),
        unit: "€",
        vsPrevious: -0.92,
        trend: "down",
        tone: "green",
      },
    ],
    weeklyConnections: [
      { week: 1, connections: wobble(4, 0.25) },
      { week: 2, connections: wobble(9, 0.25) },
      { week: 3, connections: wobble(14, 0.25) },
      { week: 4, connections: wobble(21, 0.25) },
      { week: 5, connections: wobble(30, 0.25) },
      { week: 6, connections: wobble(base.conns, 0.2) },
    ],
    perChannel: [
      { channel: "WhatsApp", optIns: wobble(base.waOpt, 0.2) },
      { channel: "SMS", optIns: wobble(160, 0.3) },
      { channel: "Leaflet", optIns: wobble(96, 0.3) },
      { channel: "Meta", optIns: wobble(80, 0.3) },
      { channel: "TikTok", optIns: wobble(36, 0.3) },
    ],
    costPerConnectionEUR: wobble(base.cost, 0.12),
  };
}

function metricsForBorough(borough: string | null): CampaignMetrics | null {
  if (!borough) return null;
  if (/crooswijk/i.test(borough)) return CROOSWIJK;
  if (/bijlmer|zuidoost/i.test(borough)) return BIJLMER;
  if (/schilderswijk|laak/i.test(borough)) return SCHILDERSWIJK;
  return syntheticMetrics(borough);
}

type StageKey = "distribution" | "engagement" | "conversion";

const STAGE_META: Record<
  StageKey,
  { label: string; caption: string; accent: string; chip: string; ringChip: string }
> = {
  distribution: {
    label: "Stage 1 · Distribution",
    caption: "Reach into the buurt",
    accent: "bg-muted-foreground/40",
    chip: "text-muted-foreground bg-panel",
    ringChip: "ring-hairline-strong",
  },
  engagement: {
    label: "Stage 2 · Engagement",
    caption: "Opt-ins and reads",
    accent: "bg-teal",
    chip: "text-teal bg-teal-soft/60",
    ringChip: "ring-teal/30",
  },
  conversion: {
    label: "Stage 3 · Conversion",
    caption: "Show-up and return",
    accent: "bg-risk-green",
    chip: "text-risk-green bg-risk-green-soft/60",
    ringChip: "ring-risk-green/30",
  },
};

export function CampaignMetricsPanel({ borough }: { borough: string | null }) {
  const [open, setOpen] = useState(true);
  const data = useMemo(() => metricsForBorough(borough), [borough]);

  if (!borough || !data) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Select a borough to see an example campaign funnel.
      </p>
    );
  }

  // Slice the 9-row funnel into 3 narrative stages + the punchline.
  // Indexes 0..1 distribution, 2..3 engagement, 4..7 conversion, 8 is cost (the punchline).
  const distribution = data.funnel.slice(0, 2);
  const engagement = data.funnel.slice(2, 4);
  const conversion = data.funnel.slice(4, 8);
  const punchline = data.funnel[8];

  const connectionsTotal = data.weeklyConnections.reduce((s, w) => s + w.connections, 0);
  const maxOptIns = Math.max(...data.perChannel.map((c) => c.optIns));

  return (
    <div className="space-y-2.5">
      <p className="rounded-md border border-hairline bg-muted/30 px-2.5 py-1.5 text-[10.5px] leading-snug text-muted-foreground">
        Illustrative numbers. No campaign has been run: these are fixed example values, not
        measurements.
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="group flex w-full items-center justify-between gap-2 rounded-md border border-hairline bg-panel px-2.5 py-1.5 text-left ring-1 ring-inset ring-transparent transition-all duration-150 ease-out hover:border-hairline-strong hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-teal/30"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm bg-muted/50 text-muted-foreground transition-colors group-hover:bg-teal-soft/60 group-hover:text-teal">
            <svg
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(
                "size-2.5 transition-transform duration-200 ease-out",
                open ? "rotate-90" : "rotate-0",
              )}
              aria-hidden="true"
            >
              <path d="M3.5 2L6.5 5L3.5 8" />
            </svg>
          </span>
          <span className="truncate text-[11px] font-semibold tracking-tight text-foreground">
            Full funnel
          </span>
          <span className="truncate text-[10.5px] text-muted-foreground/80">{borough}</span>
        </span>
        <span className="inline-flex shrink-0 items-baseline gap-1">
          <span className="font-mono text-[11px] tabular font-semibold text-risk-green">
            €{data.costPerConnectionEUR}
          </span>
          <span className="text-[9.5px] uppercase tracking-[0.07em] text-muted-foreground/70">
            / conn
          </span>
        </span>
      </button>

      {open ? (
        <div className="space-y-3">
          {/* STAGE 1 · DISTRIBUTION — single-line emphasis, no rhythm yet */}
          <StageGroup stage="distribution" rows={distribution} previousValue={null} />

          {/* STAGE 2 · ENGAGEMENT — opt-ins start to bloom */}
          <StageGroup
            stage="engagement"
            rows={engagement}
            previousValue={distribution[distribution.length - 1]?.value ?? null}
          />

          {/* STAGE 3 · CONVERSION — denser, taller rows; this is where attendance happens */}
          <StageGroup
            stage="conversion"
            rows={conversion}
            previousValue={engagement[engagement.length - 1]?.value ?? null}
          />

          {/* Cost per connection, pulled out of the row list. */}
          {punchline ? (
            <CostPunchline
              value={punchline.value}
              connections={conversion[conversion.length - 1]?.value ?? 0}
            />
          ) : null}

          {/* Connections per week + opt-ins per channel share one frame */}
          <div className="overflow-hidden rounded-md border border-hairline bg-panel">
            <div className="flex items-center justify-between border-b border-hairline bg-canvas/40 px-2.5 py-1.5">
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                Channel mix
              </h4>
              <span className="text-[9.5px] uppercase tracking-[0.07em] text-muted-foreground/70">
                what drove the funnel
              </span>
            </div>

            <div className="grid grid-cols-2 divide-x divide-hairline">
              {/* Velocity (vertical) */}
              <div className="px-2.5 py-2">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[10px] font-medium tracking-tight text-foreground/80">
                    Connections / week
                  </span>
                  <span className="inline-flex items-baseline gap-0.5">
                    <span className="font-mono text-[11px] tabular font-semibold text-risk-green">
                      {connectionsTotal}
                    </span>
                    <span className="text-[9px] uppercase tracking-[0.07em] text-muted-foreground/70">
                      total
                    </span>
                  </span>
                </div>
                <div className="mt-1 h-[84px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.weeklyConnections}
                      margin={{ top: 6, right: 4, bottom: 0, left: -24 }}
                    >
                      <CartesianGrid
                        stroke="oklch(0.93 0.004 250)"
                        strokeDasharray="2 3"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="week"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 9, fill: "oklch(0.55 0.01 250)" }}
                        tickFormatter={(v) => `w${v}`}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={28}
                        tick={{ fontSize: 9, fill: "oklch(0.55 0.01 250)" }}
                      />
                      <Bar
                        dataKey="connections"
                        radius={[3, 3, 0, 0]}
                        fill="oklch(0.61 0.13 162)"
                        isAnimationActive
                        animationDuration={560}
                        animationEasing="ease-out"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Composition (horizontal) — bespoke rows so colors lock to channel + breathe */}
              <div className="px-2.5 py-2">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-[10px] font-medium tracking-tight text-foreground/80">
                    Opt-ins by channel
                  </span>
                  <span className="font-mono text-[9.5px] tabular text-muted-foreground/70">
                    {data.perChannel.length} channels
                  </span>
                </div>
                <ul className="mt-1.5 space-y-1">
                  {data.perChannel.map((row) => {
                    const pct = (row.optIns / maxOptIns) * 100;
                    const color = CHANNEL_HEX[row.channel] ?? "oklch(0.55 0.105 186)";
                    return (
                      <li
                        key={row.channel}
                        className="grid grid-cols-[44px_1fr_34px] items-center gap-1.5"
                      >
                        <span className="truncate text-[9.5px] font-medium tracking-tight text-foreground/80">
                          {row.channel}
                        </span>
                        <span className="relative h-2 overflow-hidden rounded-full bg-muted/40">
                          <span
                            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: color,
                            }}
                          />
                        </span>
                        <span className="text-right font-mono text-[10px] tabular font-medium text-foreground">
                          {formatNumber(row.optIns)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StageGroup({
  stage,
  rows,
  previousValue,
}: {
  stage: StageKey;
  rows: FunnelRow[];
  previousValue: number | null;
}) {
  const meta = STAGE_META[stage];
  if (rows.length === 0) return null;

  // Survival rate: how many of the previous stage's last metric made it into this stage's first.
  const survival = previousValue && previousValue > 0 ? rows[0].value / previousValue : null;

  // Conversion stage uses larger, denser rows; engagement is mid; distribution is minimal.
  const density: "tight" | "comfy" | "dense" =
    stage === "distribution" ? "tight" : stage === "engagement" ? "comfy" : "dense";

  return (
    <section className="space-y-1">
      <header className="flex items-center gap-2">
        <span className={cn("h-3 w-0.5 shrink-0 rounded-full", meta.accent)} aria-hidden="true" />
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.09em] text-foreground/80">
          {meta.label}
        </h4>
        <span className="text-[10px] text-muted-foreground/70">{meta.caption}</span>
        {survival !== null ? (
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-[9.5px] tabular font-medium ring-1 ring-inset",
              meta.chip,
              meta.ringChip,
            )}
            title="Carried over from previous stage"
          >
            <span className="text-[8.5px]" aria-hidden="true">
              {"→"}
            </span>
            {Math.round(survival * 100)}% carry
          </span>
        ) : null}
      </header>

      <ol className="space-y-1">
        {rows.map((row) => (
          <FunnelLine key={row.label} row={row} density={density} />
        ))}
      </ol>
    </section>
  );
}

function FunnelLine({ row, density }: { row: FunnelRow; density: "tight" | "comfy" | "dense" }) {
  const valueSize =
    density === "dense" ? "text-[13px]" : density === "comfy" ? "text-[12.5px]" : "text-[12px]";

  const padding =
    density === "dense" ? "px-2.5 py-2" : density === "comfy" ? "px-2.5 py-1.5" : "px-2 py-1.5";

  // Density also dictates ink: conversion rows get a denser ring, distribution stays flat.
  const ring =
    density === "dense"
      ? "ring-1 ring-inset ring-hairline-strong"
      : density === "comfy"
        ? "ring-1 ring-inset ring-hairline"
        : "ring-1 ring-inset ring-transparent border border-hairline";

  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-md bg-panel transition-colors duration-150 ease-out hover:bg-muted/25",
        padding,
        ring,
      )}
    >
      <span className="min-w-0 flex-1 truncate text-[11px] leading-tight text-foreground/85">
        {row.label}
      </span>
      <span className={cn("shrink-0 font-mono tabular font-semibold text-foreground", valueSize)}>
        {formatNumber(row.value, row.unit)}
      </span>
      <span className="inline-flex w-12 shrink-0 items-center justify-end font-mono text-[10px] tabular">
        {row.vsPrevious !== undefined ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5",
              row.trend === "up" ? "text-foreground/65" : "text-muted-foreground/70",
            )}
          >
            <span className="text-[9px]" aria-hidden="true">
              {row.trend === "up" ? "↑" : row.trend === "down" ? "↓" : "–"}
            </span>
            {formatPct(row.vsPrevious)}
          </span>
        ) : (
          <span className="text-muted-foreground/50">{"–"}</span>
        )}
      </span>
    </li>
  );
}

function CostPunchline({ value, connections }: { value: number; connections: number }) {
  return (
    <section className="relative overflow-hidden rounded-md border border-risk-green/30 bg-risk-green-soft/35 px-3 py-2.5 ring-1 ring-inset ring-risk-green/20">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-risk-green">
            Example · cost per connection
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-foreground/70">
            {connections} connections at{" "}
            <span className="font-mono tabular text-foreground/85">
              €{value.toLocaleString("en-GB")}
            </span>{" "}
            each.
          </p>
        </div>
      </div>
    </section>
  );
}
