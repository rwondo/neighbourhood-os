import type { RecommendedActivity, ResidentCluster } from "@/lib/types";
import { ChannelBadge } from "./channel-icon";
import { cn } from "@/lib/utils";

const CLUSTER_LABEL: Record<string, string> = {
  cluster_elderly: "Elderly 65+",
  cluster_singles: "Singles",
  cluster_single_parents: "Single parents",
  cluster_low_income: "Low-income",
  cluster_young_adults: "Young adults",
  cluster_internationals: "Internationals",
  cluster_general: "Mixed",
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
    return new Date(iso).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function activityKey(a: RecommendedActivity, i: number): string {
  return `${a.name}__${a.venue}__${a.whenISO}__${i}`;
}

export function ActivitiesList({
  activities,
  clusters,
  running,
  approvedKeys,
  onSelect,
}: {
  activities: RecommendedActivity[];
  clusters: ResidentCluster[];
  running: boolean;
  approvedKeys: Set<string>;
  onSelect: (activity: RecommendedActivity, key: string) => void;
}) {
  if (!activities.length) {
    if (running) {
      return (
        <ul className="space-y-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <li
              key={`skel_${i}`}
              className="rounded-lg border border-dashed border-hairline-strong bg-panel p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="h-2.5 w-32 animate-pulse rounded-sm bg-muted/60" />
                <span className="h-2.5 w-12 animate-pulse rounded-sm bg-muted/50" />
              </div>
              <span className="mt-1.5 block h-2 w-24 animate-pulse rounded-sm bg-muted/40" />
              <span className="mt-1 block h-2 w-3/5 animate-pulse rounded-sm bg-muted/30" />
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p className="text-[11px] leading-snug text-muted-foreground">
        No URL-backed events surfaced yet. The web-search agent scopes to the selected borough
        and drops anything without a real event listing.
      </p>
    );
  }

  const clusterById = new Map(clusters.map((c) => [c.id, c]));

  return (
    <ul className="space-y-1.5">
      {activities.map((a, i) => {
        const key = activityKey(a, i);
        const approved = approvedKeys.has(key);
        const targets = (a.targetClusters ?? []).map((id) => clusterById.get(id)).filter(Boolean) as ResidentCluster[];
        return (
          <li key={key}>
            <button
              type="button"
              onClick={() => onSelect(a, key)}
              className={cn(
                "group w-full rounded-lg border bg-panel p-2 text-left transition-colors",
                approved
                  ? "border-risk-green/30 bg-risk-green-soft/20"
                  : "border-hairline hover:border-hairline-strong hover:bg-muted/15",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="line-clamp-1 text-[12px] font-medium text-foreground">
                  {a.name}
                </span>
                <span className="shrink-0 font-mono text-[10px] tabular text-muted-foreground">
                  {formatWhen(a.whenISO)}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-[10.5px] text-muted-foreground">{a.venue}</p>
              {targets.length ? (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {targets.map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1 rounded-full border border-hairline bg-canvas/60 px-1.5 py-0.5 text-[9.5px] text-foreground/75"
                    >
                      <ChannelBadge channel={c.preferredChannel} size="xs" />
                      <span className="font-medium tracking-tight">
                        {CLUSTER_LABEL[c.id] ?? c.profile.split(",")[0]}
                      </span>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-1 flex items-center justify-between gap-2">
                {a.url ? (
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex min-w-0 max-w-[60%] items-center gap-1 truncate text-[10px] text-teal hover:underline"
                    title={a.url}
                  >
                    <LinkIcon />
                    <span className="truncate">{shortUrl(a.url)}</span>
                  </a>
                ) : a.source && !isUrl(a.source) ? (
                  <span className="truncate text-[10px] text-muted-foreground/80" title={a.source}>
                    {a.source}
                  </span>
                ) : (
                  <span />
                )}
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.05em] ring-1 ring-inset",
                    approved
                      ? "bg-risk-green-soft text-risk-green ring-risk-green/20"
                      : "bg-canvas/60 text-muted-foreground ring-hairline-strong group-hover:bg-teal-soft group-hover:text-teal group-hover:ring-teal/20",
                  )}
                >
                  {approved ? (
                    <>
                      <span className="size-1 rounded-full bg-risk-green" /> Approved
                    </>
                  ) : (
                    <>
                      <ChevronRightIcon />
                      Review &amp; approve
                    </>
                  )}
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      viewBox="0 0 8 8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-2"
      aria-hidden="true"
    >
      <path d="M3 1.5L5.5 4L3 6.5" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-2.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M3.5 2H2a1.5 1.5 0 0 0-1.5 1.5v3A1.5 1.5 0 0 0 2 8h3a1.5 1.5 0 0 0 1.5-1.5V5" />
      <path d="M5.5 1H9v3.5" />
      <path d="M9 1L4.5 5.5" />
    </svg>
  );
}
