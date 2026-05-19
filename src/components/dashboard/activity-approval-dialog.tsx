"use client";

import { useState } from "react";
import type { RecommendedActivity, ResidentCluster } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChannelBadge } from "./channel-icon";
import { cn } from "@/lib/utils";

const CLUSTER_LABEL: Record<string, string> = {
  cluster_elderly: "Elderly 65+",
  cluster_singles: "Single-adult households",
  cluster_single_parents: "Single parents",
  cluster_low_income: "Low-income, mixed ages",
  cluster_young_adults: "Young adults 18–35",
  cluster_internationals: "International students",
  cluster_general: "Mixed residents",
};

const WHEN_OPTS: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
};

function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

function shortUrl(s: string): string {
  try {
    const u = new URL(s);
    return u.hostname.replace(/^www\./, "") + (u.pathname.length > 1 ? u.pathname : "");
  } catch {
    return s;
  }
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", WHEN_OPTS);
  } catch {
    return iso;
  }
}

export function ActivityApprovalDialog({
  open,
  onOpenChange,
  activity,
  clusters,
  borough,
  city,
  onApproved,
  alreadyApproved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: RecommendedActivity | null;
  clusters: ResidentCluster[];
  borough: string | null;
  city: string | null;
  onApproved: (dispatchId: string) => void;
  alreadyApproved: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetIds = new Set(activity?.targetClusters ?? []);
  const matched = clusters.filter((c) => targetIds.has(c.id));
  const targetClusters = matched.length ? matched : clusters;

  const handleApprove = async () => {
    if (!activity) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/activities/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity: {
            name: activity.name,
            venue: activity.venue,
            whenISO: activity.whenISO,
            source: activity.source,
            targetClusters: activity.targetClusters ?? [],
          },
          borough,
          city,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { dispatchId?: string };
      onApproved(json.dispatchId ?? `disp_${Date.now()}`);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dispatch");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate">{activity?.name ?? "Activity"}</DialogTitle>
            <DialogDescription className="mt-0.5">
              {activity ? (
                <>
                  {activity.venue}
                  {borough ? <> · {borough}</> : null}
                </>
              ) : null}
            </DialogDescription>
          </div>
          {alreadyApproved ? (
            <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-risk-green-soft px-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-risk-green ring-1 ring-inset ring-risk-green/20">
              <span className="size-1 rounded-full bg-risk-green" /> Approved
            </span>
          ) : null}
        </DialogHeader>

        <div className="scrollbar-thin max-h-[60vh] overflow-y-auto px-5 pb-3 pt-1">
          {activity ? (
            <div className="space-y-4">
              {activity.url ? (
                <a
                  href={activity.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start justify-between gap-3 rounded-md border border-teal/30 bg-teal-soft/40 px-3 py-2 transition-colors hover:border-teal/50 hover:bg-teal-soft/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-teal/80">
                      Event listing
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11.5px] text-teal">
                      {shortUrl(activity.url)}
                    </div>
                  </div>
                  <ExternalIcon />
                </a>
              ) : null}

              <section className="grid grid-cols-2 gap-2">
                <FactRow label="When" value={formatWhen(activity.whenISO)} />
                <FactRow label="Venue" value={activity.venue} />
              </section>

              {activity.description ? (
                <section>
                  <SectionLabel>What happens</SectionLabel>
                  <p className="rounded-md border border-hairline bg-canvas/40 px-3 py-2 text-[12px] leading-relaxed text-foreground/85">
                    {activity.description}
                  </p>
                </section>
              ) : null}

              <section>
                <SectionLabel>Target clusters · {targetClusters.length}</SectionLabel>
                <ul className="space-y-1.5">
                  {targetClusters.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-start gap-2 rounded-md border border-hairline bg-panel px-2.5 py-1.5"
                    >
                      <ChannelBadge channel={c.preferredChannel} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[12px] font-semibold tracking-tight text-foreground">
                            {CLUSTER_LABEL[c.id] ?? c.profile}
                          </span>
                          <span className="font-mono tabular text-[10px] text-muted-foreground">
                            age {c.ageRange[0]}–{c.ageRange[1]}
                          </span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                            {c.language.join("/")}
                          </span>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="font-mono tabular text-[10px] text-muted-foreground">
                            ~{c.estimatedSize.toLocaleString("en-GB")} residents
                          </span>
                        </div>
                        {c.notes ? (
                          <p className="mt-0.5 text-[10.5px] leading-snug text-muted-foreground/85">
                            {c.notes}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {activity.source && !isUrl(activity.source) ? (
                <section>
                  <SectionLabel>Source</SectionLabel>
                  <div className="rounded-md border border-hairline bg-canvas/40 px-3 py-1.5 text-[11px] text-foreground/75">
                    {activity.source}
                  </div>
                </section>
              ) : null}

              <section>
                <SectionLabel>On approval</SectionLabel>
                <ul className="space-y-1 text-[11px] leading-relaxed text-foreground/80">
                  <li className="flex items-baseline gap-1.5">
                    <Bullet />
                    Dispatch the creative agent to produce a variant per target-cluster channel.
                  </li>
                  <li className="flex items-baseline gap-1.5">
                    <Bullet />
                    Verify venue, timing, and contact details against the source.
                  </li>
                  <li className="flex items-baseline gap-1.5">
                    <Bullet />
                    Estimate reachability against the borough's demographic mix.
                  </li>
                </ul>
              </section>

              {error ? (
                <p className="rounded-md border border-risk-red/30 bg-risk-red-soft/30 px-2.5 py-1.5 text-[11px] text-risk-red">
                  {error}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-7 items-center justify-center rounded-md border border-hairline bg-panel px-3 text-[11.5px] font-medium text-foreground/80 transition-colors hover:bg-muted/40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!activity || submitting || alreadyApproved}
            onClick={handleApprove}
            className={cn(
              "inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-3 text-[11.5px] font-medium transition-colors disabled:cursor-not-allowed",
              alreadyApproved
                ? "bg-risk-green-soft text-risk-green ring-1 ring-inset ring-risk-green/30"
                : "bg-teal text-primary-foreground disabled:opacity-60",
            )}
          >
            {alreadyApproved ? (
              <>
                <CheckIcon />
                Already approved
              </>
            ) : submitting ? (
              "Dispatching…"
            ) : (
              <>
                <CheckIcon />
                Approve &amp; Dispatch Agent
              </>
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
      {children}
    </h3>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-hairline bg-panel px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-[12px] font-medium text-foreground" title={value}>
        {value}
      </div>
    </div>
  );
}

function Bullet() {
  return (
    <span className="mt-[5px] size-1 shrink-0 rounded-full bg-teal" aria-hidden="true" />
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3"
      aria-hidden="true"
    >
      <path d="M2.5 6.5L5 9l4.5-5.5" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-3.5 shrink-0 text-teal/70 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      aria-hidden="true"
    >
      <path d="M4 2h6v6" />
      <path d="M10 2L4.5 7.5" />
      <path d="M9 7v2.5A1.5 1.5 0 0 1 7.5 11h-5A1.5 1.5 0 0 1 1 9.5v-5A1.5 1.5 0 0 1 2.5 3H5" />
    </svg>
  );
}
