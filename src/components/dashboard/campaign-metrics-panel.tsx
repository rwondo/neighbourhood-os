"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
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

const TONE_COLORS: Record<Tone, { fg: string; bg: string; dot: string }> = {
  green: {
    fg: "text-risk-green",
    bg: "bg-risk-green-soft/40",
    dot: "bg-risk-green",
  },
  amber: {
    fg: "text-risk-amber",
    bg: "bg-risk-amber-soft/50",
    dot: "bg-risk-amber",
  },
  red: { fg: "text-risk-red", bg: "bg-risk-red-soft/40", dot: "bg-risk-red" },
};

const CHANNEL_HEX: Record<string, string> = {
  WhatsApp: "oklch(0.65 0.13 150)",
  SMS: "oklch(0.62 0.1 220)",
  Leaflet: "oklch(0.7 0.12 70)",
  Meta: "oklch(0.55 0.16 250)",
  TikTok: "oklch(0.65 0.16 320)",
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
    { label: "Ad clicks → opt-in page", value: 1_124, vsPrevious: 0.082, trend: "up", tone: "green" },
    { label: "WhatsApp opt-ins", value: 612, vsPrevious: 0.31, trend: "up", tone: "green" },
    { label: "WhatsApp reads (EN/NL)", value: 558, vsPrevious: 0.91, trend: "up", tone: "green" },
    { label: "Event RSVPs", value: 188, vsPrevious: 0.52, trend: "up", tone: "amber" },
    { label: "Estimated attendance", value: 152, vsPrevious: 0.81, trend: "up", tone: "green" },
    { label: "Return visit (week 2)", value: 94, vsPrevious: 0.62, trend: "up", tone: "green" },
    { label: "Connections formed", value: 54, vsPrevious: 0.48, trend: "up", tone: "green" },
    { label: "Cost per connection", value: 380, unit: "€", vsPrevious: -0.934, trend: "down", tone: "green" },
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
    { label: "Event RSVPs", value: 168, vsPrevious: 0.40, trend: "up", tone: "amber" },
    { label: "Estimated attendance", value: 132, vsPrevious: 0.79, trend: "up", tone: "green" },
    { label: "Return visit (week 2)", value: 84, vsPrevious: 0.64, trend: "up", tone: "green" },
    { label: "Connections formed", value: 47, vsPrevious: 0.51, trend: "up", tone: "green" },
    { label: "Cost per connection", value: 465, unit: "€", vsPrevious: -0.92, trend: "down", tone: "green" },
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
    Math.max(1, Math.round(n * (1 + (((seed % 1000) / 1000 - 0.5) * range))));
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
      { label: "QR scans / ad opt-ins", value: wobble(base.optIns, 0.22), vsPrevious: 0.13, trend: "up", tone: "green" },
      { label: "WhatsApp opt-ins", value: wobble(base.waOpt, 0.22), vsPrevious: 0.46, trend: "up", tone: "green" },
      { label: "WhatsApp reads", value: wobble(base.waReads, 0.22), vsPrevious: 0.91, trend: "up", tone: "green" },
      { label: "Event RSVPs", value: wobble(base.rsvps, 0.22), vsPrevious: 0.42, trend: "up", tone: "amber" },
      { label: "Estimated attendance", value: wobble(base.attend, 0.22), vsPrevious: 0.78, trend: "up", tone: "green" },
      { label: "Return visit (week 2)", value: wobble(base.return, 0.22), vsPrevious: 0.61, trend: "up", tone: "green" },
      { label: "Connections formed", value: wobble(base.conns, 0.22), vsPrevious: 0.5, trend: "up", tone: "green" },
      { label: "Cost per connection", value: wobble(base.cost, 0.15), unit: "€", vsPrevious: -0.92, trend: "down", tone: "green" },
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

export function CampaignMetricsPanel({ borough }: { borough: string | null }) {
  const [open, setOpen] = useState(true);
  const data = useMemo(() => metricsForBorough(borough), [borough]);

  if (!borough || !data) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Select a borough to see live campaign metrics.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md border border-hairline bg-panel px-2.5 py-1.5 text-left transition-colors hover:bg-muted/30"
      >
        <span className="text-[11px] font-semibold tracking-tight text-foreground">
          Full funnel · {borough}
        </span>
        <span className="font-mono text-[10px] tabular text-muted-foreground">
          €{data.costPerConnectionEUR}/conn · {open ? "−" : "+"}
        </span>
      </button>

      {open ? (
        <>
          <ol className="space-y-1">
            {data.funnel.map((row) => {
              const tone = TONE_COLORS[row.tone];
              return (
                <li
                  key={row.label}
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-hairline px-2 py-1.5",
                    tone.bg,
                  )}
                >
                  <span className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} />
                  <span className="min-w-0 flex-1 truncate text-[11px] leading-tight text-foreground/85">
                    {row.label}
                  </span>
                  <span className={cn("shrink-0 font-mono text-[12px] tabular font-medium", tone.fg)}>
                    {formatNumber(row.value, row.unit)}
                  </span>
                  {row.vsPrevious !== undefined ? (
                    <span
                      className={cn(
                        "inline-flex w-12 shrink-0 items-center justify-end gap-0.5 font-mono text-[10px] tabular",
                        row.trend === "down" && row.tone === "green"
                          ? "text-risk-green"
                          : row.trend === "up"
                            ? "text-foreground/70"
                            : "text-muted-foreground",
                      )}
                    >
                      <span aria-hidden>
                        {row.trend === "up" ? "↑" : row.trend === "down" ? "↓" : "—"}
                      </span>
                      {formatPct(row.vsPrevious)}
                    </span>
                  ) : (
                    <span className="w-12 shrink-0" />
                  )}
                </li>
              );
            })}
          </ol>

          <div className="rounded-md border border-hairline bg-panel p-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Connections per week
              </h4>
              <span className="font-mono text-[10px] tabular text-foreground/70">
                Σ {data.weeklyConnections.reduce((s, w) => s + w.connections, 0)}
              </span>
            </div>
            <div className="mt-1 h-[88px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.weeklyConnections}
                  margin={{ top: 8, right: 4, bottom: 0, left: -22 }}
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
                    fill="oklch(0.55 0.105 186)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-md border border-hairline bg-panel p-2">
            <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Opt-ins by channel
            </h4>
            <div className="mt-1 h-[88px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.perChannel}
                  layout="vertical"
                  margin={{ top: 0, right: 6, bottom: 0, left: 0 }}
                >
                  <CartesianGrid
                    stroke="oklch(0.93 0.004 250)"
                    strokeDasharray="2 3"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 9, fill: "oklch(0.55 0.01 250)" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="channel"
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tick={{ fontSize: 9.5, fill: "oklch(0.4 0.01 250)" }}
                  />
                  <Bar dataKey="optIns" radius={[0, 3, 3, 0]}>
                    {data.perChannel.map((entry) => (
                      <Cell
                        key={entry.channel}
                        fill={CHANNEL_HEX[entry.channel] ?? "oklch(0.55 0.105 186)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
