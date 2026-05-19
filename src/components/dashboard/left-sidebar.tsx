"use client";

import { cn } from "@/lib/utils";
import type { CityKey } from "@/lib/types";
import { CITY_BY_KEY } from "@/lib/mock-data";
import { Logo } from "./logo";
import { CityTabs } from "./city-tabs";
import { ScoreBadge } from "./score-badge";
import { ChannelBadge } from "./channel-icon";
import { useBoroughs } from "@/lib/hooks/use-boroughs";

const RISK_DOT: Record<"low" | "moderate" | "high" | "severe", string> = {
  severe: "bg-risk-red ring-2 ring-risk-red/20",
  high: "bg-risk-amber ring-2 ring-risk-amber/20",
  moderate: "bg-risk-amber ring-2 ring-risk-amber/20",
  low: "bg-risk-green ring-2 ring-risk-green/20",
};

export function LeftSidebar({
  city,
  onCityChange,
  onSelect,
}: {
  city: CityKey;
  onCityChange: (c: CityKey) => void;
  onSelect: (selection: { id: string; name: string }) => void;
}) {
  const profile = CITY_BY_KEY[city];
  const { ordered, loading } = useBoroughs(city);
  // Sidebar shows priority boroughs — top half by CDI (severe + high quartiles).
  const totalBoroughs = ordered.length;
  const priorityCount = Math.max(1, Math.round(totalBoroughs / 2));
  const alerts = ordered.slice(0, priorityCount);

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
            Priority Boroughs
          </h2>
          <span className="font-mono tabular text-[10px] text-muted-foreground">
            {alerts.length}/{totalBoroughs}
          </span>
        </div>
        <div className="scroll-fade-y scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-2">
          {loading ? (
            <p className="px-1 text-[11px] text-muted-foreground">Loading boroughs…</p>
          ) : (
            <ul className="space-y-1.5">
              {alerts.map((a) => (
                <li key={a.borough}>
                  <div className="group relative rounded-lg border border-hairline bg-panel p-2.5 transition-all hover:border-hairline-strong hover:bg-muted/20">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("size-1.5 shrink-0 rounded-full", RISK_DOT[a.riskLevel])} />
                          <span className="truncate text-[13px] font-semibold tracking-tight text-foreground">
                            {a.borough}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground">
                          {a.buurtCount} buurten · CDI {a.avgCdi.toFixed(0)}
                          {typeof a.avgV === "number" && typeof a.avgA === "number" && typeof a.avgS === "number" ? (
                            <> · V{a.avgV.toFixed(0)} A{a.avgA.toFixed(0)} S{a.avgS.toFixed(0)}</>
                          ) : null}
                        </p>
                      </div>
                      <ScoreBadge score={Math.round(a.avgScore)} size="sm" />
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelect({ id: a.borough, name: a.borough })}
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
