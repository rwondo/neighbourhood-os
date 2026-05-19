"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type {
  Channel,
  CityKey,
  ClusterMessage,
  CreativeStatus,
  MCPCampaignStatus,
  RecommendedActivity,
  ResidentCluster,
} from "@/lib/types";
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

export type CreativeDispatch = {
  clusterId: string;
  channel: Channel;
  creativeUrl: string | null;
  creativeStatus: CreativeStatus;
  qrCodeUrl: string | null;
  joinUrl: string | null;
};

export type MCPDispatchResult = {
  clusterId: string;
  channel: Channel;
  status: MCPCampaignStatus;
  campaignId: string;
  adsManagerUrl: string | null;
  fallback: boolean;
  reason?: string;
};

export type ApprovalResult = {
  dispatchId: string;
  creatives: CreativeDispatch[];
  mcpResults: MCPDispatchResult[];
};

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

function aspectClassFor(channel: Channel): string {
  if (channel === "facebook" || channel === "instagram") return "aspect-square";
  if (channel === "tiktok" || channel === "leaflet") return "aspect-[9/16]";
  return "aspect-square";
}

function aspectLabelFor(channel: Channel): string {
  if (channel === "facebook" || channel === "instagram") return "1:1";
  if (channel === "tiktok") return "9:16";
  if (channel === "leaflet") return "A5 · 9:16";
  return "";
}

function channelLabel(channel: Channel): string {
  switch (channel) {
    case "facebook":
      return "Facebook";
    case "instagram":
      return "Instagram";
    case "tiktok":
      return "TikTok";
    case "leaflet":
      return "Leaflet";
    case "whatsapp":
      return "WhatsApp";
    case "sms":
      return "SMS";
    default:
      return channel;
  }
}

function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function ActivityApprovalDialog({
  open,
  onOpenChange,
  activity,
  clusters,
  messages,
  borough,
  city,
  onApproved,
  alreadyApproved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: RecommendedActivity | null;
  clusters: ResidentCluster[];
  messages: ClusterMessage[];
  borough: string | null;
  city: CityKey | null;
  onApproved: (result: ApprovalResult) => void;
  alreadyApproved: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApprovalResult | null>(null);

  // Reset state whenever the dialog opens for a new activity.
  useEffect(() => {
    if (open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setResult(null);
      setError(null);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open, activity?.name]);

  const targetIds = new Set(activity?.targetClusters ?? []);
  const matched = clusters.filter((c) => targetIds.has(c.id));
  const targetClusters = matched.length ? matched : clusters;

  const handleApprove = async () => {
    if (!activity) return;
    setSubmitting(true);
    setError(null);
    try {
      const includedMessages = messages
        .filter((m) => targetIds.size === 0 || targetIds.has(m.clusterId))
        .map((m) => ({ clusterId: m.clusterId, channel: m.channel, message: m.message }));
      const res = await fetch("/api/activities/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity: {
            name: activity.name,
            description: activity.description,
            venue: activity.venue,
            whenISO: activity.whenISO,
            source: activity.source,
            targetClusters: activity.targetClusters ?? [],
          },
          borough,
          city,
          clusters: matched.length ? matched : clusters,
          messages: includedMessages,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        dispatchId?: string;
        creatives?: CreativeDispatch[];
        mcpResults?: MCPDispatchResult[];
      };
      const approval: ApprovalResult = {
        dispatchId: json.dispatchId ?? `disp_${Date.now()}`,
        creatives: json.creatives ?? [],
        mcpResults: json.mcpResults ?? [],
      };
      setResult(approval);
      onApproved(approval);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dispatch");
    } finally {
      setSubmitting(false);
    }
  };

  const showPreview = result !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Block dismissal while a dispatch is in flight so the result isn't lost.
        if (!o && submitting) return;
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate">
              {showPreview ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-risk-green text-white">
                    <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-2.5" aria-hidden="true">
                      <path d="M2 5l2 2 4-4.5" />
                    </svg>
                  </span>
                  Creatives dispatched
                </span>
              ) : (
                (activity?.name ?? "Activity")
              )}
            </DialogTitle>
            <DialogDescription className="mt-0.5">
              {showPreview ? (
                <span>
                  <span className="font-mono tabular text-foreground/70">
                    {result?.creatives.length ?? 0}
                  </span>{" "}
                  creatives ·{" "}
                  <span className="font-mono tabular text-foreground/70">
                    {result?.mcpResults.length ?? 0}
                  </span>{" "}
                  campaigns live in Ads Manager (paused)
                </span>
              ) : activity ? (
                <>
                  {activity.venue}
                  {borough ? <> · {borough}</> : null}
                </>
              ) : null}
            </DialogDescription>
          </div>
          {alreadyApproved && !showPreview ? (
            <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-risk-green-soft px-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-risk-green ring-1 ring-inset ring-risk-green/20">
              <span className="size-1 rounded-full bg-risk-green" /> Approved
            </span>
          ) : null}
        </DialogHeader>

        <div className="scrollbar-thin max-h-[68vh] overflow-y-auto px-5 pb-3 pt-1">
          {showPreview && result ? (
            <CreativePreviewPane result={result} />
          ) : activity ? (
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
                    Generate one Ideogram 3.0 creative per target-cluster channel.
                  </li>
                  <li className="flex items-baseline gap-1.5">
                    <Bullet />
                    Render a QR code for any leaflet-targeted cluster.
                  </li>
                  <li className="flex items-baseline gap-1.5">
                    <Bullet />
                    Push Meta and TikTok campaigns to Ads Manager (status: PAUSED).
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
          {showPreview ? (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-7 items-center justify-center rounded-md bg-teal px-3 text-[11.5px] font-medium text-primary-foreground transition-colors hover:opacity-90"
            >
              Done
            </button>
          ) : (
            <>
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
                  <>
                    <span className="size-3 animate-spin rounded-full border-2 border-primary-foreground/70 border-t-transparent" />
                    Generating creatives…
                  </>
                ) : (
                  <>
                    <CheckIcon />
                    Approve &amp; Generate Creatives
                  </>
                )}
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreativePreviewPane({ result }: { result: ApprovalResult }) {
  const mcpByKey = new Map(
    result.mcpResults.map((m) => [`${m.clusterId}::${m.channel}`, m]),
  );
  const visible = result.creatives.filter(
    (c) =>
      c.channel === "facebook" ||
      c.channel === "instagram" ||
      c.channel === "tiktok" ||
      c.channel === "leaflet",
  );

  if (visible.length === 0) {
    return (
      <p className="rounded-md border border-hairline bg-panel/60 p-3 text-[11.5px] text-muted-foreground">
        No image-channel clusters were targeted by this activity.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {visible.map((c) => {
        const mcp = mcpByKey.get(`${c.clusterId}::${c.channel}`);
        const aspect = aspectClassFor(c.channel);
        const aspectLbl = aspectLabelFor(c.channel);
        const clusterLabel = CLUSTER_LABEL[c.clusterId] ?? c.clusterId;
        const hasImage = !!c.creativeUrl;
        return (
          <div
            key={`${c.clusterId}::${c.channel}`}
            className="overflow-hidden rounded-lg border border-hairline bg-panel"
          >
            <div className="flex items-center justify-between gap-2 border-b border-hairline px-2.5 py-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <ChannelBadge channel={c.channel} size="sm" />
                <span className="truncate text-[11px] font-semibold tracking-tight text-foreground">
                  {channelLabel(c.channel)}
                </span>
                <span className="font-mono text-[10px] tabular text-muted-foreground">
                  {aspectLbl}
                </span>
              </div>
              <span className="truncate font-mono text-[10px] tabular text-muted-foreground">
                {clusterLabel}
              </span>
            </div>

            <div
              className={cn(
                "relative w-full overflow-hidden bg-canvas/40",
                aspect,
              )}
            >
              {hasImage && c.creativeUrl ? (
                <Image
                  src={c.creativeUrl}
                  alt={`${channelLabel(c.channel)} creative for ${clusterLabel}`}
                  fill
                  sizes="(max-width: 640px) 90vw, 340px"
                  className="object-contain"
                  unoptimized
                />
              ) : c.creativeStatus === "fallback" || c.creativeStatus === "failed" ? (
                <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground">
                  Creative placeholder
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <span className="size-5 animate-spin rounded-full border-2 border-teal border-t-transparent" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Generating…
                  </span>
                </div>
              )}
            </div>

            {c.channel === "leaflet" && c.qrCodeUrl ? (
              <div className="flex items-center gap-2 border-t border-hairline bg-canvas/30 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.qrCodeUrl}
                  alt="Join QR code"
                  className="size-12 shrink-0 rounded-sm bg-white p-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Join QR
                  </div>
                  <div className="truncate font-mono text-[10px] text-foreground/70">
                    {c.joinUrl ?? "neighbourhoodos.nl/join/…"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    c.qrCodeUrl ? downloadDataUrl(c.qrCodeUrl, `qr-${c.clusterId}.png`) : undefined
                  }
                  className="inline-flex h-6 shrink-0 items-center rounded-md border border-hairline bg-panel px-2 text-[10px] font-medium text-foreground/80 transition-colors hover:bg-muted/40"
                >
                  Download QR
                </button>
              </div>
            ) : null}

            {mcp ? (
              <div className="flex items-center justify-between gap-2 border-t border-hairline bg-canvas/30 p-2">
                <div className="min-w-0">
                  <div className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Campaign ID
                  </div>
                  <div className="truncate font-mono text-[10px] text-foreground/80">
                    {mcp.campaignId}
                  </div>
                  {mcp.fallback ? (
                    <div className="mt-0.5 text-[9.5px] font-medium uppercase tracking-wider text-risk-red">
                      Manual upload ready
                    </div>
                  ) : (
                    <div className="mt-0.5 text-[9.5px] font-medium uppercase tracking-wider text-risk-green">
                      Live in Ads Manager (paused)
                    </div>
                  )}
                </div>
                {mcp.adsManagerUrl ? (
                  <a
                    href={mcp.adsManagerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-6 shrink-0 items-center rounded-md bg-teal px-2 text-[10px] font-medium text-primary-foreground transition-colors hover:opacity-90"
                  >
                    Open in Ads Manager
                  </a>
                ) : c.creativeUrl ? (
                  <a
                    href={c.creativeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-6 shrink-0 items-center rounded-md border border-risk-red/30 bg-risk-red-soft px-2 text-[10px] font-medium text-risk-red transition-colors hover:bg-risk-red-soft/80"
                  >
                    Download creative
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
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
