"use client";

import { useEffect, useState } from "react";
import type { CityKey } from "@/lib/types";
import type { BoroughDetailResponse } from "@/app/api/boroughs/[borough]/route";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cdiColorHex } from "@/lib/cdi-colors";
import { cn } from "@/lib/utils";

const RISK_LABEL: Record<NonNullable<BoroughDetailResponse["riskLevel"]>, string> = {
  low: "Healthy",
  moderate: "Moderate",
  high: "At Risk",
  severe: "Connection Desert",
};

const CITY_LABEL: Record<CityKey, string> = {
  rotterdam: "Rotterdam",
  amsterdam: "Amsterdam",
  denhaag: "The Hague",
};

export function BoroughDetailDialog({
  open,
  onOpenChange,
  borough,
  city,
  onGenerate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  borough: string | null;
  city: CityKey;
  onGenerate: () => void;
}) {
  const [data, setData] = useState<BoroughDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !borough) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/boroughs/${encodeURIComponent(borough)}?city=${city}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<BoroughDetailResponse>;
      })
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load borough");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, borough, city]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate">{borough ?? "Borough"}</DialogTitle>
            <DialogDescription className="mt-0.5">
              {data ? (
                <>
                  {CITY_LABEL[city]} · rank{" "}
                  <span className="font-mono tabular text-foreground/70">
                    {data.rankInCity}/{data.totalBoroughs}
                  </span>{" "}
                  · <span className="font-mono tabular text-foreground/70">{data.buurtCount}</span>{" "}
                  buurten
                </>
              ) : loading ? (
                "Loading borough breakdown…"
              ) : error ? (
                <span className="text-risk-red">Error: {error}</span>
              ) : (
                CITY_LABEL[city]
              )}
            </DialogDescription>
          </div>
          {data ? <CdiPill cdi={data.avgCdi} risk={data.riskLevel} color={data.color} /> : null}
        </DialogHeader>

        <div className="scrollbar-thin max-h-[64vh] overflow-y-auto px-5 pb-3 pt-1">
          {loading ? <Skeleton /> : null}
          {!loading && data ? (
            <div className="space-y-4">
              <ComponentsBlock components={data.components} />
              <DemographicsBlock demographics={data.demographics} />
              <InfrastructureBlock infrastructure={data.infrastructure} />
              <TopBuurtenBlock buurten={data.topBuurten} />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-7 items-center justify-center rounded-md border border-hairline bg-panel px-3 text-[11.5px] font-medium text-foreground/80 transition-colors hover:bg-muted/40"
          >
            Close
          </button>
          <button
            type="button"
            disabled={!data}
            onClick={() => {
              onGenerate();
              onOpenChange(false);
            }}
            className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md bg-teal px-3 text-[11.5px] font-medium text-primary-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg viewBox="0 0 12 12" fill="currentColor" className="size-2.5" aria-hidden="true">
              <path d="M6 1l1.5 3.5L11 6l-3.5 1.5L6 11l-1.5-3.5L1 6l3.5-1.5L6 1z" />
            </svg>
            Generate Intervention
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CdiPill({
  cdi,
  risk,
  color,
}: {
  cdi: number;
  risk: BoroughDetailResponse["riskLevel"];
  color: BoroughDetailResponse["color"];
}) {
  return (
    <div
      className="flex shrink-0 flex-col items-end gap-0.5 rounded-md px-2.5 py-1 ring-1 ring-inset"
      style={{
        backgroundColor: `${cdiColorHex(color)}15`,
        color: cdiColorHex(color),
      }}
    >
      <div className="flex items-baseline gap-1">
        <span className="font-mono tabular text-[16px] font-semibold leading-none">{cdi}</span>
        <span className="text-[9.5px] uppercase tracking-[0.06em] opacity-80">CDI</span>
      </div>
      <span className="text-[9.5px] uppercase tracking-[0.08em] opacity-90">
        {RISK_LABEL[risk]}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
      {children}
    </h3>
  );
}

function ComponentsBlock({ components }: { components: BoroughDetailResponse["components"] }) {
  return (
    <section>
      <SectionLabel>Why this CDI · components</SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        <StatTile
          accent="red"
          weight="40%"
          name="V — Vulnerability"
          value={components.V}
          sub={
            <>
              E <Mono>{components.E}</Mono> · H <Mono>{components.H}</Mono>
            </>
          }
          hint="age 65+ share · living-alone share"
        />
        <StatTile
          accent="amber"
          weight="35%"
          name="A — Access Barrier"
          value={components.A}
          sub={
            <>
              PT <Mono>{components.PT}</Mono> · W <Mono>{components.W}</Mono> · D{" "}
              <Mono>{components.D}</Mono> · R <Mono>{components.R}</Mono>
            </>
          }
          hint="transit · walkability · distance · weather"
        />
        <StatTile
          accent="green"
          weight="25%"
          name="S — Social Infra"
          value={components.S}
          sub={<span className="opacity-70">higher = denser amenities</span>}
          hint="weighted POI density 0–100"
          inverse
        />
      </div>
    </section>
  );
}

function DemographicsBlock({
  demographics,
}: {
  demographics: BoroughDetailResponse["demographics"];
}) {
  return (
    <section>
      <SectionLabel>Demographics · borough average</SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        <FactCell label="Living alone" value={`${demographics.pctLivingAlone}%`} />
        <FactCell label="Age 65+" value={`${demographics.pctElderly65}%`} />
        <FactCell label="Single parent" value={`${demographics.pctSingleParent}%`} />
        <FactCell label="Low-income idx" value={demographics.lowIncomeIndex} />
        <FactCell label="Pop. turnover" value={`${demographics.populationTurnover}%`} />
        <FactCell label="Amenity dist." value={`${demographics.amenityDistanceKm} km`} />
      </div>
    </section>
  );
}

function InfrastructureBlock({
  infrastructure,
}: {
  infrastructure: BoroughDetailResponse["infrastructure"];
}) {
  return (
    <section>
      <SectionLabel>Social infrastructure · totals across buurten</SectionLabel>
      <div className="grid grid-cols-7 gap-1.5">
        <InfraCell label="Libraries" value={infrastructure.poiLibraries} />
        <InfraCell label="Comm. ctrs" value={infrastructure.poiCommunityCentres} />
        <InfraCell label="Parks" value={infrastructure.poiParks} />
        <InfraCell label="Cafés" value={infrastructure.poiCafes} />
        <InfraCell label="Sports" value={infrastructure.poiSports} />
        <InfraCell label="Benches" value={infrastructure.poiBenches} />
        <InfraCell label="Transit" value={infrastructure.transitStops500m} />
      </div>
    </section>
  );
}

function TopBuurtenBlock({ buurten }: { buurten: BoroughDetailResponse["topBuurten"] }) {
  if (!buurten.length) return null;
  return (
    <section>
      <SectionLabel>Worst-CDI buurten in this borough</SectionLabel>
      <ul className="divide-y divide-hairline overflow-hidden rounded-md border border-hairline">
        {buurten.map((b) => (
          <li
            key={b.buurtCode}
            className="flex items-center gap-2.5 bg-panel px-2.5 py-1.5 text-[11px] leading-snug"
          >
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{b.name}</span>
            <span className="font-mono tabular text-muted-foreground">
              alone <span className="text-foreground/70">{b.pctLivingAlone}%</span>
            </span>
            <span className="font-mono tabular text-muted-foreground">
              65+ <span className="text-foreground/70">{b.pctElderly65}%</span>
            </span>
            <span
              className={cn(
                "ml-1 inline-flex h-5 items-center rounded ring-1 ring-inset px-1.5 font-mono tabular text-[11px] font-semibold",
                b.cdi >= 70
                  ? "bg-risk-red-soft text-risk-red ring-risk-red/15"
                  : b.cdi >= 50
                    ? "bg-risk-amber-soft text-risk-amber ring-risk-amber/20"
                    : "bg-risk-green-soft text-risk-green ring-risk-green/20",
              )}
            >
              {b.cdi.toFixed(0)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatTile({
  name,
  value,
  sub,
  hint,
  weight,
  accent,
  inverse,
}: {
  name: string;
  value: number;
  sub: React.ReactNode;
  hint: string;
  weight: string;
  accent: "red" | "amber" | "green";
  inverse?: boolean;
}) {
  const tone =
    accent === "red"
      ? "border-risk-red/25 bg-risk-red-soft/40"
      : accent === "amber"
        ? "border-risk-amber/25 bg-risk-amber-soft/40"
        : "border-risk-green/25 bg-risk-green-soft/40";
  return (
    <div className={cn("rounded-md border px-2.5 py-2", tone)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-foreground/80">
          {name}
        </span>
        <span className="font-mono text-[9px] uppercase text-muted-foreground/70">{weight}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono tabular text-[20px] font-semibold leading-none text-foreground">
          {value.toFixed(1)}
        </span>
        <span className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground/70">
          {inverse ? "/ 100" : "/ 100"}
        </span>
      </div>
      <p className="mt-1 truncate text-[10.5px] text-foreground/75">{sub}</p>
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">{hint}</p>
    </div>
  );
}

function FactCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-hairline bg-panel px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono tabular text-[14px] font-medium leading-none text-foreground">
        {value}
      </div>
    </div>
  );
}

function InfraCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-hairline bg-panel px-1.5 py-1.5 text-center">
      <div className="font-mono tabular text-[14px] font-semibold leading-none text-foreground">
        {value}
      </div>
      <div className="mt-0.5 truncate text-[9px] uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono tabular text-foreground/75">{children}</span>;
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[88px] animate-pulse rounded-md border border-hairline bg-muted/30" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-md border border-hairline bg-muted/30" />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-md border border-hairline bg-muted/30" />
    </div>
  );
}
