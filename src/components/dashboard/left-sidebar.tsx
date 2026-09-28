"use client";

import { cn } from "@/lib/utils";
import type { CityKey } from "@/lib/types";
import { Logo } from "./logo";
import { CityTabs } from "./city-tabs";
import { ScoreBadge } from "./score-badge";
import { useBoroughs } from "@/lib/hooks/use-boroughs";
import { useRecentInterventions } from "@/lib/hooks/use-recent-interventions";

type RiskKey = "low" | "moderate" | "high" | "severe";

// CDI risk semantics, aligned across map / sidebar list / dialog pill.
const RISK_TONE: Record<
  RiskKey,
  {
    dot: string;
    pulse: string;
    rank: string;
    surface: string;
    surfaceHover: string;
    ring: string;
    chip: string;
    label: string;
  }
> = {
  severe: {
    dot: "bg-risk-red",
    pulse: "bg-risk-red/30",
    rank: "text-risk-red",
    surface: "bg-risk-red-soft/55",
    surfaceHover: "hover:bg-risk-red-soft/75",
    ring: "ring-risk-red/25",
    chip: "text-risk-red bg-risk-red-soft ring-risk-red/20",
    label: "Connection Desert",
  },
  high: {
    dot: "bg-risk-amber",
    pulse: "bg-risk-amber/30",
    rank: "text-risk-amber",
    surface: "bg-risk-amber-soft/45",
    surfaceHover: "hover:bg-risk-amber-soft/65",
    ring: "ring-risk-amber/25",
    chip: "text-risk-amber bg-risk-amber-soft ring-risk-amber/25",
    label: "At Risk",
  },
  moderate: {
    dot: "bg-risk-amber/85",
    pulse: "bg-risk-amber/20",
    rank: "text-risk-amber",
    surface: "bg-panel",
    surfaceHover: "hover:bg-canvas/60",
    ring: "ring-hairline",
    chip: "text-risk-amber bg-risk-amber-soft/70 ring-risk-amber/20",
    label: "Moderate",
  },
  low: {
    dot: "bg-risk-green",
    pulse: "bg-risk-green/25",
    rank: "text-risk-green",
    surface: "bg-panel",
    surfaceHover: "hover:bg-canvas/60",
    ring: "ring-hairline",
    chip: "text-risk-green bg-risk-green-soft ring-risk-green/25",
    label: "Healthy",
  },
};

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return iso.slice(0, 10);
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  return `${days}d ago`;
}

export function LeftSidebar({
  city,
  onCityChange,
  onSelect,
}: {
  city: CityKey;
  onCityChange: (c: CityKey) => void;
  onSelect: (selection: { id: string; name: string }) => void;
}) {
  const { ordered, loading } = useBoroughs(city);
  const { interventions, loading: interventionsLoading } = useRecentInterventions(city);

  const totalBoroughs = ordered.length;
  const priorityCount = Math.max(1, Math.round(totalBoroughs / 2));
  const alerts = ordered.slice(0, priorityCount);

  return (
    <aside className="flex h-full w-full flex-col border-r border-hairline bg-panel">
      {/* Brand anchor */}
      <div className="shrink-0 px-4 pb-3 pt-4">
        <Logo />
      </div>

      {/* City tab strip */}
      <div className="shrink-0 px-3 pb-1">
        <CityTabs value={city} onChange={onCityChange} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {/* PRIORITY BOROUGHS - the primary call-to-action surface */}
        <SidebarSectionHeader
          title="Priority Boroughs"
          live={!loading && alerts.length > 0}
          meta={
            !loading && totalBoroughs > 0 ? (
              <span className="font-mono tabular text-[10px] text-muted-foreground/80">
                <span className="text-foreground/80">{alerts.length}</span>
                <span className="text-muted-foreground/45">/</span>
                {totalBoroughs}
              </span>
            ) : null
          }
        />

        <div className="scroll-fade-y scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-2">
          {loading ? (
            <BoroughListSkeleton />
          ) : alerts.length === 0 ? (
            <EmptyState
              icon={
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4"
                  aria-hidden="true"
                >
                  <path d="M8 1.5C5 1.5 2.5 4 2.5 7c0 4 5.5 7.5 5.5 7.5s5.5-3.5 5.5-7.5c0-3-2.5-5.5-5.5-5.5z" />
                  <circle cx="8" cy="7" r="1.8" />
                </svg>
              }
              title="No borough aggregates yet"
              body="Seed CBS buurt data, then refresh to populate this list."
            />
          ) : (
            <ul className="space-y-1.5">
              {alerts.map((a, idx) => {
                const tone = RISK_TONE[a.riskLevel];
                const rank = idx + 1;
                const isTop = rank === 1;
                return (
                  <li key={a.borough}>
                    <button
                      type="button"
                      onClick={() => onSelect({ id: a.borough, name: a.borough })}
                      className={cn(
                        "group/row relative w-full overflow-hidden rounded-lg p-2.5 text-left",
                        "ring-1 ring-inset transition-all duration-200 ease-out",
                        tone.surface,
                        tone.surfaceHover,
                        tone.ring,
                        isTop &&
                          "shadow-[0_1px_0_oklch(0.93_0.004_250_/_0.8),0_4px_12px_-6px_oklch(0.18_0.01_250_/_0.08)]",
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Rank gutter - quiet ordinal that scales the eye down the list */}
                        <div className="flex shrink-0 flex-col items-center pt-0.5">
                          <span
                            className={cn(
                              "font-mono tabular text-[10px] font-semibold leading-none",
                              isTop ? tone.rank : "text-muted-foreground/55",
                            )}
                          >
                            {String(rank).padStart(2, "0")}
                          </span>
                          <span className="relative mt-1 inline-flex">
                            {isTop ? (
                              <span
                                aria-hidden="true"
                                className={cn(
                                  "absolute inset-0 -m-[3px] animate-blink-soft rounded-full",
                                  tone.pulse,
                                )}
                              />
                            ) : null}
                            <span className={cn("relative size-1.5 rounded-full", tone.dot)} />
                          </span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span
                              className={cn(
                                "truncate tracking-tight text-foreground",
                                isTop ? "text-[13.5px] font-semibold" : "text-[12.5px] font-medium",
                              )}
                            >
                              {a.borough}
                            </span>
                            <ScoreBadge score={Math.round(a.avgScore)} size="sm" />
                          </div>

                          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span
                              className={cn(
                                "inline-flex h-[14px] items-center rounded px-1 font-mono tabular text-[9.5px] font-semibold uppercase tracking-[0.05em] ring-1 ring-inset",
                                tone.chip,
                              )}
                            >
                              CDI {a.avgCdi.toFixed(0)}
                            </span>
                            <span className="font-mono tabular text-muted-foreground/80">
                              {a.buurtCount}
                              <span className="ml-0.5 text-muted-foreground/55">buurten</span>
                            </span>
                            {typeof a.avgV === "number" &&
                            typeof a.avgA === "number" &&
                            typeof a.avgS === "number" ? (
                              <span className="ml-auto flex items-center gap-1 font-mono tabular text-[9.5px] text-muted-foreground/65">
                                <CompPip letter="V" value={a.avgV} />
                                <CompPip letter="A" value={a.avgA} />
                                <CompPip letter="S" value={a.avgS} />
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* CTA - only the rank-1 row carries the bold teal button; lower rows
                           get a subtler text affordance that appears on hover, keeping the
                           top-of-list emphasis without making every row scream. */}
                      {isTop ? (
                        <div className="mt-2.5 inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-md bg-teal text-[11.5px] font-semibold text-primary-foreground shadow-[0_1px_0_oklch(0.4_0.08_186)] transition-all duration-200 ease-out group-hover/row:translate-y-px group-hover/row:shadow-none">
                          <svg
                            viewBox="0 0 12 12"
                            fill="currentColor"
                            className="size-2.5 transition-transform duration-200 ease-out group-hover/row:rotate-12"
                            aria-hidden="true"
                          >
                            <path d="M6 1l1.5 3.5L11 6l-3.5 1.5L6 11l-1.5-3.5L1 6l3.5-1.5L6 1z" />
                          </svg>
                          Generate Intervention
                          <svg
                            viewBox="0 0 12 12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="size-2.5 transition-transform duration-200 ease-out group-hover/row:translate-x-0.5"
                            aria-hidden="true"
                          >
                            <path d="M3 6h6" />
                            <path d="M6.5 3.5L9 6L6.5 8.5" />
                          </svg>
                        </div>
                      ) : (
                        <div className="mt-1.5 flex items-center gap-1 pl-[26px] text-[10px] font-medium text-muted-foreground/65 transition-colors duration-200 ease-out group-hover/row:text-teal">
                          <span>Inspect</span>
                          <svg
                            viewBox="0 0 12 12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="size-2.5 transition-transform duration-200 ease-out group-hover/row:translate-x-0.5"
                            aria-hidden="true"
                          >
                            <path d="M3 6h6" />
                            <path d="M6.5 3.5L9 6L6.5 8.5" />
                          </svg>
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* RECENT INTERVENTIONS - treated as receipts, not navigation */}
        <div className="shrink-0 border-t border-hairline bg-canvas/40">
          <SidebarSectionHeader
            title="Recent Interventions"
            subtle
            meta={
              !interventionsLoading && interventions.length > 0 ? (
                <span className="inline-flex items-center gap-1 font-mono tabular text-[10px] text-muted-foreground/75">
                  <span className="size-1 rounded-full bg-risk-green" />
                  {interventions.length}
                  <span className="text-muted-foreground/55">generated</span>
                </span>
              ) : null
            }
          />

          <div className="scrollbar-thin max-h-[180px] overflow-y-auto px-3 pb-3 pt-1.5">
            {interventionsLoading ? (
              <InterventionListSkeleton />
            ) : interventions.length === 0 ? (
              <EmptyState
                compact
                icon={
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4"
                    aria-hidden="true"
                  >
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                }
                title="No interventions yet"
                body="Generated intervention plans for this city will appear here."
              />
            ) : (
              <ul className="space-y-0.5">
                {interventions.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => onSelect({ id: i.borough, name: i.borough })}
                      className="group/receipt flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors duration-200 ease-out hover:bg-panel"
                    >
                      <span
                        aria-hidden="true"
                        className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm bg-risk-green-soft text-risk-green ring-1 ring-inset ring-risk-green/20"
                      >
                        <svg
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="size-2.5"
                        >
                          <path d="M2.5 6.5l2.5 2.5 4.5-5.5" />
                        </svg>
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="truncate text-[11.5px] font-medium tracking-tight text-foreground">
                            {i.borough}
                          </span>
                          <span className="font-mono tabular text-[9.5px] text-muted-foreground/65">
                            {relativeTime(i.createdAt)}
                          </span>
                        </div>
                        <p className="truncate text-[10px] text-muted-foreground/80">
                          {i.buurtName}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-0 leading-none">
                        <span className="font-mono tabular text-[10.5px] font-semibold text-risk-green">
                          +{i.predictedScoreGain}
                        </span>
                        <span className="mt-0.5 font-mono tabular text-[9px] uppercase tracking-[0.04em] text-muted-foreground/65">
                          {i.predictedConnections} conn
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ helpers */

function SidebarSectionHeader({
  title,
  meta,
  live,
  subtle,
}: {
  title: string;
  meta?: React.ReactNode;
  live?: boolean;
  subtle?: boolean;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-[1] flex items-center justify-between gap-2 px-4 py-2",
        subtle
          ? "border-b border-hairline bg-canvas/40"
          : "border-b border-hairline bg-panel/85 backdrop-blur-[1px]",
      )}
    >
      <div className="flex items-center gap-1.5">
        {live ? (
          <span
            aria-hidden="true"
            className="size-1 shrink-0 animate-blink-soft rounded-full bg-teal"
          />
        ) : null}
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
          {title}
        </h2>
      </div>
      {meta ?? null}
    </header>
  );
}

function CompPip({ letter, value }: { letter: string; value: number }) {
  return (
    <span className="inline-flex items-baseline gap-0.5">
      <span className="text-muted-foreground/55">{letter}</span>
      <span className="text-muted-foreground/85">{value.toFixed(0)}</span>
    </span>
  );
}

function BoroughListSkeleton() {
  return (
    <ul className="space-y-1.5" aria-label="loading boroughs">
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className={cn(
            "h-[68px] animate-pulse rounded-lg ring-1 ring-inset ring-hairline",
            i === 0 ? "bg-risk-red-soft/30" : "bg-muted/30",
          )}
        />
      ))}
    </ul>
  );
}

function InterventionListSkeleton() {
  return (
    <ul className="space-y-1" aria-label="loading interventions">
      {[0, 1, 2].map((i) => (
        <li key={i} className="h-[34px] animate-pulse rounded-md bg-muted/30" />
      ))}
    </ul>
  );
}

function EmptyState({
  icon,
  title,
  body,
  compact,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-hairline-strong bg-canvas/40 text-center",
        compact ? "px-3 py-4" : "px-3 py-6",
      )}
    >
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted/60 text-muted-foreground/80 ring-1 ring-inset ring-hairline">
        {icon}
      </span>
      <p className="text-[11px] font-medium tracking-tight text-foreground">{title}</p>
      <p className="max-w-[200px] text-[10px] leading-snug text-muted-foreground">{body}</p>
    </div>
  );
}
