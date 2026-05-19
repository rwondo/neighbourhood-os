"use client";

import { CITY_BY_KEY, type CityKey } from "@/lib/mock-data";
import { CitySwitcherPill } from "./city-switcher-pill";
import { RegionMap } from "./region-map";
import { StatCard } from "./stat-card";

export function CenterPanel({
  city,
  onCityChange,
}: {
  city: CityKey;
  onCityChange: (c: CityKey) => void;
}) {
  const profile = CITY_BY_KEY[city];
  return (
    <section className="flex h-full min-w-0 flex-col bg-canvas">
      <header className="relative z-20 flex shrink-0 items-center justify-between gap-4 border-b border-hairline bg-panel/60 px-5 py-3 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <CitySwitcherPill value={city} onChange={onCityChange} />
          <div className="h-5 w-px bg-hairline" />
          <h1 className="truncate text-[13px] font-semibold tracking-tight text-foreground">
            <span className="text-foreground">{profile.label}</span>
            <span className="mx-1.5 text-muted-foreground/60">—</span>
            <span className="font-normal text-muted-foreground">Social Fabric Map</span>
          </h1>
        </div>
        <div className="flex items-center gap-3 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal opacity-50" />
              <span className="relative inline-flex size-1.5 rounded-full bg-teal" />
            </span>
            <span>Live</span>
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="font-mono normal-case tracking-normal">
            Last updated:{" "}
            <span className="text-foreground/70">{profile.lastUpdatedLabel}</span>
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="font-mono normal-case tracking-normal">
            <span className="text-foreground/70 tabular">{profile.totalBuurten}</span>{" "}
            <span>buurten monitored</span>
          </span>
        </div>
      </header>

      <div className="min-h-0 flex-1 px-5 pb-3 pt-4">
        <RegionMap city={city} />
      </div>

      <div className="shrink-0 px-5 pb-4">
        <div className="grid grid-cols-4 gap-2.5">
          <StatCard
            label="Buurten Monitored"
            value={profile.stats.buurtenMonitored}
            hint="total"
          />
          <StatCard
            label="At Risk"
            value={profile.stats.atRisk}
            tone="amber"
            hint="60–79"
          />
          <StatCard
            label="High Isolation"
            value={profile.stats.highIsolation}
            tone="red"
            hint="<60"
          />
          <StatCard
            label="Active Interventions"
            value={profile.stats.activeInterventions}
            tone="teal"
            hint="now"
          />
        </div>
      </div>
    </section>
  );
}
