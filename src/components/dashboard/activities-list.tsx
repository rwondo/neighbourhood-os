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

type WhenParts = {
  day: string;
  month: string;
  weekday: string;
  iso: string;
};

function whenParts(iso: string): WhenParts {
  try {
    const d = new Date(iso);
    return {
      day: d.toLocaleDateString("en-GB", { day: "numeric" }),
      month: d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase(),
      weekday: d.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase(),
      iso,
    };
  } catch {
    const fallback = iso.slice(0, 10);
    return { day: fallback, month: "", weekday: "", iso: fallback };
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
  // ---- Empty + loading branches -----------------------------------------------
  if (!activities.length) {
    if (running) {
      return <ActivitiesSkeleton />;
    }
    return <ActivitiesEmpty />;
  }

  const clusterById = new Map(clusters.map((c) => [c.id, c]));

  // Visually break the uniform stack: first row is the featured pick, the rest
  // are a tighter list. This conveys "top recommendation + alternatives".
  const [hero, ...rest] = activities;
  const heroKey = activityKey(hero, 0);
  const heroApproved = approvedKeys.has(heroKey);
  const heroTargets = (hero.targetClusters ?? [])
    .map((id) => clusterById.get(id))
    .filter(Boolean) as ResidentCluster[];

  return (
    <div className="space-y-2">
      {/* ---- Featured / hero row ------------------------------------------- */}
      <FeaturedRow
        activity={hero}
        when={whenParts(hero.whenISO)}
        approved={heroApproved}
        targets={heroTargets}
        onClick={() => onSelect(hero, heroKey)}
      />

      {/* ---- Alternatives -------------------------------------------------- */}
      {rest.length ? (
        <div>
          <div className="mb-1 flex items-center gap-1.5 px-0.5">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground/70">
              Alternatives
            </span>
            <span className="h-px flex-1 bg-hairline" />
            <span className="font-mono text-[9.5px] tabular text-muted-foreground/60">
              {rest.length}
            </span>
          </div>
          <ul className="space-y-1">
            {rest.map((a, idx) => {
              const i = idx + 1;
              const key = activityKey(a, i);
              const approved = approvedKeys.has(key);
              const targets = (a.targetClusters ?? [])
                .map((id) => clusterById.get(id))
                .filter(Boolean) as ResidentCluster[];
              return (
                <li key={key}>
                  <CompactRow
                    activity={a}
                    when={whenParts(a.whenISO)}
                    approved={approved}
                    targets={targets}
                    onClick={() => onSelect(a, key)}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ===========================================================================
// Featured row: date anchor on the left, structured detail block, CTA pill.
// ===========================================================================
function FeaturedRow({
  activity,
  when,
  approved,
  targets,
  onClick,
}: {
  activity: RecommendedActivity;
  when: WhenParts;
  approved: boolean;
  targets: ResidentCluster[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full overflow-hidden rounded-lg border bg-panel p-2.5 text-left transition-colors ease-out",
        approved
          ? "border-risk-green/30 bg-risk-green-soft/25"
          : "border-hairline-strong hover:border-teal/40 hover:bg-teal-soft/25",
      )}
    >
      {/* Top recommendation pin: subtle ribbon */}
      <span
        className={cn(
          "absolute right-2.5 top-2.5 inline-flex h-[18px] items-center gap-1 rounded-full px-1.5 text-[9px] font-semibold uppercase tracking-[0.07em] ring-1 ring-inset",
          approved
            ? "bg-risk-green-soft text-risk-green ring-risk-green/25"
            : "bg-teal-soft/70 text-teal ring-teal/25",
        )}
      >
        <SparkIcon />
        Top pick
      </span>

      <div className="flex items-stretch gap-2.5">
        {/* Date anchor */}
        <DateAnchor when={when} approved={approved} featured />

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-w-0 pr-[78px]">
            <h3 className="line-clamp-2 text-[12.5px] font-semibold leading-tight tracking-tight text-foreground">
              {activity.name}
            </h3>
            <p className="mt-0.5 flex items-center gap-1 text-[10.5px] leading-snug text-muted-foreground">
              <PinIcon />
              <span className="truncate">{activity.venue}</span>
            </p>
          </div>

          {/* Affinity / target clusters */}
          {targets.length ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground/70">
                Fits
              </span>
              {targets.map((c) => (
                <ClusterAffinityChip key={c.id} cluster={c} />
              ))}
            </div>
          ) : null}

          {/* Source link + CTA */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <SourceLink activity={activity} />
            <ActionPill approved={approved} prominent />
          </div>
        </div>
      </div>
    </button>
  );
}

// ===========================================================================
// Compact row: tighter alternative pick.
// ===========================================================================
function CompactRow({
  activity,
  when,
  approved,
  targets,
  onClick,
}: {
  activity: RecommendedActivity;
  when: WhenParts;
  approved: boolean;
  targets: ResidentCluster[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-2 rounded-md border bg-panel p-1.5 pr-2 text-left transition-colors ease-out",
        approved
          ? "border-risk-green/25 bg-risk-green-soft/20"
          : "border-hairline hover:border-hairline-strong hover:bg-muted/15",
      )}
    >
      <DateAnchor when={when} approved={approved} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="line-clamp-1 flex-1 text-[12px] font-medium tracking-tight text-foreground">
            {activity.name}
          </span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] leading-snug text-muted-foreground">
          <PinIcon small />
          <span className="truncate">{activity.venue}</span>
          {targets.length ? (
            <>
              <span className="text-muted-foreground/40">·</span>
              <ClusterDotStack targets={targets} />
            </>
          ) : null}
        </div>
      </div>

      <ActionPill approved={approved} />
    </button>
  );
}

// ===========================================================================
// Bits
// ===========================================================================
function DateAnchor({
  when,
  approved,
  featured = false,
}: {
  when: WhenParts;
  approved: boolean;
  featured?: boolean;
}) {
  // Calendar-tear visual: weekday banner over a large day number, with month
  // tucked underneath. Tinted but never loud.
  const wrapBase =
    "flex shrink-0 flex-col overflow-hidden rounded-md ring-1 ring-inset bg-panel";
  const wrapSize = featured ? "w-11" : "w-9";
  const tone = approved
    ? "ring-risk-green/30"
    : featured
      ? "ring-hairline-strong"
      : "ring-hairline";
  const bannerTone = approved
    ? "bg-risk-green/15 text-risk-green"
    : featured
      ? "bg-teal/12 text-teal"
      : "bg-muted/50 text-muted-foreground";
  return (
    <div className={cn(wrapBase, wrapSize, tone)}>
      <div
        className={cn(
          "flex items-center justify-center font-mono uppercase tracking-[0.06em]",
          featured ? "h-3.5 text-[8.5px]" : "h-3 text-[8px]",
          bannerTone,
        )}
      >
        {when.weekday || "TBD"}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center py-0.5">
        <span
          className={cn(
            "font-mono tabular font-semibold leading-none text-foreground",
            featured ? "text-[16px]" : "text-[13px]",
          )}
        >
          {when.day}
        </span>
        {when.month ? (
          <span
            className={cn(
              "mt-0.5 font-mono uppercase tracking-[0.06em] leading-none text-muted-foreground/80",
              featured ? "text-[8.5px]" : "text-[8px]",
            )}
          >
            {when.month}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ClusterAffinityChip({ cluster }: { cluster: ResidentCluster }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-canvas/70 py-0.5 pl-0.5 pr-1.5 text-[9.5px]">
      <ChannelBadge channel={cluster.preferredChannel} size="xs" />
      <span className="font-medium tracking-tight text-foreground/80">
        {CLUSTER_LABEL[cluster.id] ?? cluster.profile.split(",")[0]}
      </span>
    </span>
  );
}

function ClusterDotStack({ targets }: { targets: ResidentCluster[] }) {
  // Compact representation for the compact row: stacked channel badges, then
  // a "+N" if there are more than two affinities.
  const shown = targets.slice(0, 2);
  const extra = targets.length - shown.length;
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="-space-x-1 inline-flex">
        {shown.map((c) => (
          <ChannelBadge key={c.id} channel={c.preferredChannel} size="xs" />
        ))}
      </span>
      {extra > 0 ? (
        <span className="ml-1 font-mono text-[9px] tabular text-muted-foreground/70">
          +{extra}
        </span>
      ) : null}
    </span>
  );
}

function SourceLink({ activity }: { activity: RecommendedActivity }) {
  if (activity.url) {
    return (
      <a
        href={activity.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex min-w-0 max-w-[60%] items-center gap-1 truncate text-[10px] text-teal transition-colors ease-out hover:underline"
        title={activity.url}
      >
        <LinkIcon />
        <span className="truncate">{shortUrl(activity.url)}</span>
      </a>
    );
  }
  if (activity.source && !isUrl(activity.source)) {
    return (
      <span className="truncate text-[10px] text-muted-foreground/80" title={activity.source}>
        {activity.source}
      </span>
    );
  }
  return <span />;
}

function ActionPill({
  approved,
  prominent = false,
}: {
  approved: boolean;
  prominent?: boolean;
}) {
  if (approved) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full ring-1 ring-inset",
          "bg-risk-green-soft text-risk-green ring-risk-green/25",
          prominent ? "h-6 px-2 text-[10px]" : "h-5 px-1.5 text-[9.5px]",
        )}
      >
        <CheckIcon />
        <span className="font-semibold uppercase tracking-[0.06em]">Approved</span>
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-semibold uppercase tracking-[0.06em] ring-1 ring-inset transition-colors ease-out",
        prominent
          ? "h-6 px-2 text-[10px] bg-teal text-primary-foreground ring-teal/40 group-hover:bg-teal/90 shadow-[0_1px_0_oklch(0.4_0.08_186)] group-hover:shadow-none"
          : "h-5 px-1.5 text-[9.5px] bg-panel text-muted-foreground ring-hairline-strong group-hover:bg-teal-soft group-hover:text-teal group-hover:ring-teal/30",
      )}
    >
      {prominent ? (
        <>
          Review &amp; approve
          <ChevronRightIcon />
        </>
      ) : (
        <>
          <ChevronRightIcon />
          Review
        </>
      )}
    </span>
  );
}

function ActivitiesEmpty() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-hairline-strong bg-canvas/40 px-4 py-6 text-center">
      <span className="flex size-7 items-center justify-center rounded-md bg-teal-soft/60 text-teal ring-1 ring-inset ring-teal/20">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
          aria-hidden="true"
        >
          <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
          <path d="M2.5 6.5h11" />
          <path d="M5.5 2v3" />
          <path d="M10.5 2v3" />
          <path d="M6 9.5h1" />
          <path d="M9 9.5h1" />
        </svg>
      </span>
      <p className="text-[11.5px] font-medium leading-tight text-foreground">
        No URL-backed events surfaced yet
      </p>
      <p className="max-w-[34ch] text-[10.5px] leading-snug text-muted-foreground">
        The web-search agent scopes to the selected borough and drops anything without a real
        event listing. Approved events show here grouped by date and cluster fit.
      </p>
    </div>
  );
}

function ActivitiesSkeleton() {
  // Vary widths and densities so the placeholder feels like real content
  // rather than a row of identical bars.
  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-lg border border-dashed border-hairline-strong bg-panel p-2.5">
        <div className="absolute inset-y-0 left-0 w-[40%] animate-shimmer-x bg-gradient-to-r from-transparent via-muted/30 to-transparent" />
        <div className="flex items-stretch gap-2.5">
          <span className="h-11 w-11 rounded-md bg-muted/40" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="h-2.5 w-3/5 rounded-sm bg-muted/55" />
            <span className="h-2 w-2/5 rounded-sm bg-muted/40" />
            <div className="mt-1 flex gap-1">
              <span className="h-3 w-14 rounded-full bg-muted/40" />
              <span className="h-3 w-12 rounded-full bg-muted/30" />
            </div>
            <span className="mt-1 h-2 w-1/3 rounded-sm bg-muted/30" />
          </div>
        </div>
      </div>
      {[0, 1].map((i) => (
        <div
          key={`alt_${i}`}
          className="flex items-center gap-2 rounded-md border border-dashed border-hairline bg-panel p-1.5 pr-2"
        >
          <span className="h-9 w-9 rounded-md bg-muted/35" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className={cn("h-2 rounded-sm bg-muted/45", i === 0 ? "w-2/3" : "w-1/2")} />
            <span className={cn("h-2 rounded-sm bg-muted/30", i === 0 ? "w-2/5" : "w-3/5")} />
          </div>
          <span className="h-4 w-12 rounded-full bg-muted/35" />
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
// Inline icons
// ===========================================================================
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

function PinIcon({ small = false }: { small?: boolean }) {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0 text-muted-foreground/70", small ? "size-2" : "size-2.5")}
      aria-hidden="true"
    >
      <path d="M5 1.2c-1.7 0-3 1.25-3 2.85 0 2 3 4.75 3 4.75s3-2.75 3-4.75c0-1.6-1.3-2.85-3-2.85z" />
      <circle cx="5" cy="4" r="0.9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-2.5"
      aria-hidden="true"
    >
      <path d="M2 5.2l2 2L8 3" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="currentColor"
      className="size-2"
      aria-hidden="true"
    >
      <path d="M5 0.6l1.05 2.6L8.6 4.2 6.05 5.2 5 7.8 3.95 5.2 1.4 4.2l2.55-1z" />
    </svg>
  );
}
