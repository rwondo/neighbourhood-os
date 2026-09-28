"use client";

import { useEffect, useState } from "react";
import { getDemoSnapshot, staticRunNotice } from "@/lib/demo-data";
import type { BoroughDetailResponse, CityKey } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

// Tailwind palette tied to the CDI color tokens (Tailwind, not inline).
const CDI_TONE: Record<
  NonNullable<BoroughDetailResponse["color"]>,
  { wrap: string; text: string; accent: string }
> = {
  green: {
    wrap: "bg-risk-green-soft ring-risk-green/25",
    text: "text-risk-green",
    accent: "bg-risk-green",
  },
  yellow: {
    wrap: "bg-risk-amber-soft ring-risk-amber/25",
    text: "text-risk-amber",
    accent: "bg-risk-amber",
  },
  orange: {
    wrap: "bg-risk-amber-soft ring-risk-amber/30",
    text: "text-risk-amber",
    accent: "bg-risk-amber",
  },
  red: {
    wrap: "bg-risk-red-soft ring-risk-red/25",
    text: "text-risk-red",
    accent: "bg-risk-red",
  },
};

export function BoroughDetailDialog({
  open,
  onOpenChange,
  borough,
  city,
  onGenerate,
  staticMode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  borough: string | null;
  city: CityKey;
  onGenerate: () => void;
  staticMode: boolean;
}) {
  // In static mode only boroughs with a sample run can "generate" (a replay).
  const hasSample = getDemoSnapshot(borough, city) !== null;
  const generateBlocked = staticMode && !hasSample;
  const [data, setData] = useState<BoroughDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !borough) return;
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(null);
    setData(null);
    /* eslint-enable react-hooks/set-state-in-effect */
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
      <DialogContent className="max-w-[680px]">
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
                "Loading borough breakdown..."
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
              <ComponentsBlock components={data.components} color={data.color} />
              <DemographicsBlock demographics={data.demographics} />
              <InfrastructureBlock infrastructure={data.infrastructure} />
              <TopBuurtenBlock buurten={data.topBuurten} />
            </div>
          ) : null}
          {!loading && !data && error ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-risk-red/30 bg-risk-red-soft/20 px-4 py-8 text-center">
              <svg
                viewBox="0 0 14 14"
                className="size-4 text-risk-red"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M7 1.5L13 12.5H1L7 1.5Z" />
                <path d="M7 6v2.5" />
                <path d="M7 10.5v.01" />
              </svg>
              <p className="text-[12px] font-medium text-foreground">
                Couldn&apos;t load borough breakdown
              </p>
              <p className="text-[11px] text-muted-foreground">{error}</p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-hairline bg-canvas/40">
          <div className="flex w-full items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-8 items-center justify-center rounded-md border border-hairline bg-panel px-3 text-[11.5px] font-medium text-foreground/80 transition-colors hover:bg-muted/40"
            >
              Close
            </button>
            {generateBlocked ? (
              <span className="min-w-0 flex-1 text-right text-[10.5px] leading-snug text-muted-foreground">
                {staticRunNotice()}
              </span>
            ) : null}
            <button
              type="button"
              disabled={!data || generateBlocked}
              onClick={() => {
                onGenerate();
                onOpenChange(false);
              }}
              className="group inline-flex h-8 items-center justify-center gap-2 rounded-md bg-teal px-4 text-[12px] font-semibold tracking-tight text-primary-foreground shadow-[0_1px_0_oklch(0.4_0.08_186)] transition-all hover:translate-y-px hover:shadow-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <svg
                viewBox="0 0 12 12"
                fill="currentColor"
                className="size-3 transition-transform group-hover:rotate-12"
                aria-hidden="true"
              >
                <path d="M6 1l1.5 3.5L11 6l-3.5 1.5L6 11l-1.5-3.5L1 6l3.5-1.5L6 1z" />
              </svg>
              {staticMode ? "Replay sample run" : "Generate Intervention"}
              <svg
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-3 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              >
                <path d="M3 6h6" />
                <path d="M6.5 3.5L9 6L6.5 8.5" />
              </svg>
            </button>
          </div>
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
  const tone = CDI_TONE[color];
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1 ring-1 ring-inset",
        tone.wrap,
      )}
    >
      <div className="flex items-baseline gap-1">
        <span className={cn("font-mono tabular text-[17px] font-semibold leading-none", tone.text)}>
          {cdi}
        </span>
        <span className={cn("text-[9.5px] uppercase tracking-[0.06em] opacity-75", tone.text)}>
          CDI
        </span>
      </div>
      <span className="h-3 w-px bg-current opacity-30" />
      <span className={cn("text-[9.5px] font-semibold uppercase tracking-[0.08em]", tone.text)}>
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

// V/A/S components — asymmetric layout to escape the homework-grid trap.
// V dominates (40% weight), A is medium (35%), S is the inverse counterweight (25%).
function ComponentsBlock({
  components,
  color,
}: {
  components: BoroughDetailResponse["components"];
  color: BoroughDetailResponse["color"];
}) {
  const dominantTone = CDI_TONE[color];
  return (
    <section>
      <SectionLabel>Why this CDI · component breakdown</SectionLabel>
      <div className="grid grid-cols-5 gap-2">
        {/* V — dominant tile (3/5 width) */}
        <ComponentTileLarge
          name="V — Vulnerability"
          value={components.V}
          weight="40%"
          accent="red"
          sub={
            <>
              <SubChip label="65+ share" value={components.E} />
              <SubChip label="living alone" value={components.H} />
            </>
          }
          dominantTone={dominantTone}
        />
        {/* A — medium tile (2/5 width) */}
        <ComponentTileSmall
          name="A — Access"
          value={components.A}
          weight="35%"
          accent="amber"
          inline={
            <>
              <MicroStat label="PT" value={components.PT} />
              <MicroStat label="W" value={components.W} />
              <MicroStat label="D" value={components.D} />
              <MicroStat label="R" value={components.R} />
            </>
          }
        />
        {/* S — inverse counterweight (full row, distinctive treatment) */}
        <ComponentBarS value={components.S} weight="25%" />
      </div>
    </section>
  );
}

function ComponentTileLarge({
  name,
  value,
  weight,
  accent,
  sub,
  dominantTone,
}: {
  name: string;
  value: number;
  weight: string;
  accent: "red" | "amber";
  sub: React.ReactNode;
  dominantTone: { wrap: string; text: string; accent: string };
}) {
  const tone =
    accent === "red"
      ? "border-risk-red/25 bg-risk-red-soft/40"
      : "border-risk-amber/25 bg-risk-amber-soft/40";
  return (
    <div className={cn("col-span-3 rounded-md border px-3 py-2.5", tone)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-foreground">
          {name}
        </span>
        <span className="font-mono text-[9.5px] uppercase text-muted-foreground/80">
          weight {weight}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-mono tabular text-[28px] font-semibold leading-none text-foreground">
          {value.toFixed(1)}
        </span>
        <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground/70">
          / 100
        </span>
        <div className="ml-auto h-1.5 w-20 overflow-hidden rounded-full bg-panel ring-1 ring-inset ring-hairline">
          <div
            className={cn("h-full rounded-full", dominantTone.accent)}
            style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">{sub}</div>
    </div>
  );
}

function ComponentTileSmall({
  name,
  value,
  weight,
  accent,
  inline,
}: {
  name: string;
  value: number;
  weight: string;
  accent: "amber";
  inline: React.ReactNode;
}) {
  const tone =
    accent === "amber"
      ? "border-risk-amber/25 bg-risk-amber-soft/40"
      : "border-risk-red/25 bg-risk-red-soft/40";
  return (
    <div className={cn("col-span-2 rounded-md border px-2.5 py-2", tone)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-foreground">
          {name}
        </span>
        <span className="font-mono text-[9.5px] uppercase text-muted-foreground/80">{weight}</span>
      </div>
      <div className="mt-1.5 font-mono tabular text-[22px] font-semibold leading-none text-foreground">
        {value.toFixed(1)}
        <span className="ml-1 text-[9.5px] uppercase tracking-[0.07em] text-muted-foreground/70">
          / 100
        </span>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1">{inline}</div>
    </div>
  );
}

function ComponentBarS({ value, weight }: { value: number; weight: string }) {
  return (
    <div className="col-span-5 rounded-md border border-risk-green/25 bg-risk-green-soft/40 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-foreground">
            S — Social Infra
          </span>
          <span className="font-mono text-[9.5px] uppercase text-muted-foreground/80">
            {weight} · inverse
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-mono tabular text-[20px] font-semibold leading-none text-foreground">
            {value.toFixed(1)}
          </span>
          <span className="text-[9.5px] uppercase tracking-[0.07em] text-muted-foreground/70">
            / 100
          </span>
        </div>
      </div>
      <div className="mt-1.5 relative h-1.5 overflow-hidden rounded-full bg-panel ring-1 ring-inset ring-hairline">
        <div
          className="h-full rounded-full bg-risk-green"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
        Weighted count of libraries, community centres, parks, sports centres, cafés and benches
        within 500 m. Higher = denser amenity network.
      </p>
    </div>
  );
}

function SubChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-panel/80 px-1.5 py-0.5">
      <span className="text-[9.5px] uppercase tracking-[0.05em] text-muted-foreground/80">
        {label}
      </span>
      <span className="font-mono tabular text-[11px] font-medium text-foreground">
        {value.toFixed(1)}
      </span>
    </span>
  );
}

function MicroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-sm bg-panel/70 px-1 py-0.5 text-center ring-1 ring-inset ring-hairline">
      <div className="font-mono text-[8.5px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-mono tabular text-[10.5px] font-semibold text-foreground">
        {value.toFixed(0)}
      </div>
    </div>
  );
}

const NOT_PUBLISHED = "Not published by CBS at buurt level";

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
        {/* CBS no longer publishes these two at buurt level; the pipeline stores 0. */}
        <FactCell label="Single parent" value="n/a" title={NOT_PUBLISHED} />
        <FactCell label="Low-income idx" value={demographics.lowIncomeIndex} />
        <FactCell label="Pop. turnover" value="n/a" title={NOT_PUBLISHED} />
        <FactCell label="GP distance" value={`${demographics.amenityDistanceKm} km`} />
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

function FactCell({
  label,
  value,
  title,
}: {
  label: string;
  value: string | number;
  title?: string;
}) {
  return (
    <div className="rounded-md border border-hairline bg-panel px-2.5 py-1.5" title={title}>
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

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-3 h-[110px] animate-pulse rounded-md border border-hairline bg-muted/30" />
        <div className="col-span-2 h-[110px] animate-pulse rounded-md border border-hairline bg-muted/30" />
        <div className="col-span-5 h-12 animate-pulse rounded-md border border-hairline bg-muted/30" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-md border border-hairline bg-muted/30"
          />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-md border border-hairline bg-muted/30" />
    </div>
  );
}
