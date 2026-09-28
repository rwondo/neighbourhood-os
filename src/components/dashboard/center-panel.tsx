"use client";

import { useMemo } from "react";
import { CITY_BY_KEY, type CityKey } from "@/lib/mock-data";
import { useBoroughs } from "@/lib/hooks/use-boroughs";
import { CitySwitcherPill } from "./city-switcher-pill";
import { RegionMap } from "./region-map";
import { StatCard } from "./stat-card";

export function CenterPanel({
  city,
  onCityChange,
  onBoroughClick,
  staticMode,
  snapshotGeneratedAt,
}: {
  city: CityKey;
  onCityChange: (c: CityKey) => void;
  onBoroughClick?: (borough: string) => void;
  staticMode: boolean;
  snapshotGeneratedAt: string | null;
}) {
  const profile = CITY_BY_KEY[city];
  const { ordered: boroughs, loading } = useBoroughs(city);

  const stats = useMemo(() => {
    if (!boroughs.length) {
      return { total: 0, severe: 0, high: 0, medianCdi: 0 };
    }
    const severe = boroughs.filter((b) => b.riskLevel === "severe").length;
    const high = boroughs.filter((b) => b.riskLevel === "high").length;
    const sorted = [...boroughs].map((b) => b.avgCdi).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    return {
      total: boroughs.length,
      severe,
      high,
      medianCdi: Math.round(median),
    };
  }, [boroughs]);

  return (
    <section className="flex h-full min-w-0 flex-col bg-canvas">
      <header className="relative z-20 flex shrink-0 items-center justify-between gap-4 border-b border-hairline bg-panel/60 px-5 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <CitySwitcherPill value={city} onChange={onCityChange} />
          <div className="h-5 w-px bg-hairline" />
          <h1 className="truncate text-[13px] font-semibold tracking-tight text-foreground">
            <span className="text-foreground">{profile.label}</span>
            <span className="mx-1.5 text-muted-foreground/60">—</span>
            <span className="font-normal text-muted-foreground">Connection Desert Index</span>
          </h1>
        </div>
        <div className="flex items-center gap-3 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
          {staticMode ? (
            <span
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-teal/30 bg-teal-soft/40 px-2 py-0.5 font-semibold text-teal"
              title="No database or API keys: precomputed data, live AI runs disabled (see README)"
            >
              <span className="size-1.5 rounded-full bg-teal" />
              Static snapshot
              {snapshotGeneratedAt ? (
                <span className="font-mono font-normal normal-case tracking-normal text-foreground/70">
                  {new Date(snapshotGeneratedAt).toLocaleDateString("en-GB")}
                </span>
              ) : null}
            </span>
          ) : null}
          <span className="whitespace-nowrap font-mono normal-case tracking-normal">
            Data: <span className="text-foreground/70">CBS 2023 · OSM · GTFS</span>
          </span>
        </div>
      </header>

      <div className="min-h-0 flex-1 px-5 pb-3 pt-4">
        <RegionMap city={city} onBoroughClick={onBoroughClick} />
      </div>

      <div className="shrink-0 px-5 pb-4">
        <div className="grid grid-cols-4 gap-2.5">
          <StatCard label="Boroughs Scored" value={loading ? "—" : stats.total} hint="this city" />
          <StatCard
            label="Worst quartile"
            value={loading ? "—" : stats.severe}
            tone="red"
            hint="highest CDI in city"
          />
          <StatCard
            label="Second quartile"
            value={loading ? "—" : stats.high}
            tone="amber"
            hint="next 25% of boroughs"
          />
          <StatCard
            label="Median CDI"
            value={loading ? "—" : stats.medianCdi}
            tone="teal"
            hint="0 best · 100 worst"
          />
        </div>
      </div>
    </section>
  );
}
