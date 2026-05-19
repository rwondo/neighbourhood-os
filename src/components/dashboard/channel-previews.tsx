import Image from "next/image";
import { cn } from "@/lib/utils";
import { ChannelBadge } from "./channel-icon";
import type { ChannelEnrichment, EnrichmentState } from "./right-panel";
import { enrichmentKey } from "./right-panel";
import type { Channel as TypesChannel, ClusterMessage } from "@/lib/types";

type SupportedChannel = "whatsapp" | "tiktok" | "sms" | "leaflet" | "facebook" | "instagram";

const CLUSTER_LABEL: Record<string, string> = {
  cluster_elderly: "Elderly 65+",
  cluster_singles: "Single-adult households",
  cluster_single_parents: "Single parents",
  cluster_low_income: "Low-income, mixed ages",
  cluster_young_adults: "Young adults 18–35",
  cluster_internationals: "International students",
  cluster_general: "Mixed residents",
};

function isSupportedChannel(c: TypesChannel): c is SupportedChannel {
  return (
    c === "whatsapp" ||
    c === "tiktok" ||
    c === "sms" ||
    c === "leaflet" ||
    c === "facebook" ||
    c === "instagram"
  );
}

function aspectClassFor(channel: TypesChannel): string {
  if (channel === "facebook" || channel === "instagram") return "aspect-square";
  if (channel === "tiktok" || channel === "leaflet") return "aspect-[9/16]";
  return "aspect-square";
}

type StatusTone = "pending" | "active" | "ready" | "manual";

function statusForCard(
  enrichment: ChannelEnrichment | undefined,
): { label: string; tone: StatusTone } {
  if (!enrichment) return { label: "Awaiting approval", tone: "pending" };
  if (enrichment.mcpStatus === "creating")
    return { label: "Creating campaign…", tone: "active" };
  if (enrichment.mcpStatus === "live")
    return { label: "Live in Ads Manager (paused)", tone: "ready" };
  if (enrichment.mcpStatus === "manual_fallback")
    return { label: "Manual upload ready", tone: "manual" };
  if (enrichment.creativeStatus === "pending")
    return { label: "Generating creative…", tone: "active" };
  if (enrichment.creativeStatus === "ready") return { label: "Creative ready", tone: "ready" };
  if (enrichment.creativeStatus === "fallback")
    return { label: "Creative placeholder", tone: "manual" };
  if (enrichment.creativeStatus === "failed")
    return { label: "Creative failed", tone: "manual" };
  return { label: "Awaiting approval", tone: "pending" };
}

function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function ChannelPreviews({
  messages,
  running,
  enrichments,
}: {
  messages: ClusterMessage[];
  running?: boolean;
  enrichments?: EnrichmentState;
}) {
  if (messages.length === 0) {
    if (running) {
      return (
        <ul className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={`sk_${i}`}>
              <div className="overflow-hidden rounded-lg border border-dashed border-hairline-strong bg-panel">
                <div className="flex items-center justify-between gap-2 border-b border-hairline px-2.5 py-1.5">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="size-4 animate-pulse rounded-md bg-muted/60" />
                    <span className="h-2 w-20 animate-pulse rounded-sm bg-muted/60" />
                  </div>
                  <span className="h-2 w-14 animate-pulse rounded-full bg-muted/60" />
                </div>
                <div className="space-y-1 px-2.5 py-2">
                  <span className="block h-2 w-full animate-pulse rounded-sm bg-muted/50" />
                  <span className="block h-2 w-3/5 animate-pulse rounded-sm bg-muted/40" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p className="text-[11px] text-muted-foreground">
        Per-cluster previews stream in after the orchestrator generates a strategy.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {messages.map((m, i) => {
        const channel: SupportedChannel = isSupportedChannel(m.channel) ? m.channel : "whatsapp";
        const cluster =
          CLUSTER_LABEL[m.clusterId] ?? m.tone?.split("·")[0]?.trim() ?? m.clusterId;
        const enrichment = enrichments?.[enrichmentKey(m.clusterId, m.channel)];
        const status = statusForCard(enrichment);
        const showImage = Boolean(enrichment?.creativeUrl);
        const aspect = aspectClassFor(channel);
        const isLeaflet = channel === "leaflet";

        return (
          <li key={`m_${m.clusterId}_${i}`}>
            <div className="group relative overflow-hidden rounded-lg border border-hairline bg-panel transition-colors hover:border-hairline-strong">
              <div className="flex items-center justify-between gap-2 border-b border-hairline px-2.5 py-1.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <ChannelBadge channel={channel} size="sm" />
                  <span className="truncate text-[11px] font-medium tracking-tight text-foreground">
                    {cluster}
                  </span>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wider ring-1 ring-inset",
                    status.tone === "ready" &&
                      "bg-risk-green-soft text-risk-green ring-risk-green/20",
                    status.tone === "active" && "bg-teal-soft/60 text-teal ring-teal/25",
                    status.tone === "pending" &&
                      "bg-risk-amber-soft text-risk-amber ring-risk-amber/20",
                    status.tone === "manual" &&
                      "bg-risk-red-soft text-risk-red ring-risk-red/20",
                  )}
                >
                  <span
                    className={cn(
                      "size-1 rounded-full",
                      status.tone === "ready" && "bg-risk-green",
                      status.tone === "active" && "bg-teal",
                      status.tone === "pending" && "bg-risk-amber",
                      status.tone === "manual" && "bg-risk-red",
                    )}
                  />
                  {status.label}
                </span>
              </div>

              {enrichment && (channel === "facebook" || channel === "instagram" || channel === "tiktok" || channel === "leaflet") ? (
                <div
                  className={cn(
                    "relative w-full overflow-hidden bg-canvas/40",
                    aspect,
                  )}
                >
                  {showImage && enrichment.creativeUrl ? (
                    <Image
                      src={enrichment.creativeUrl}
                      alt={`${cluster} · ${channel}`}
                      fill
                      sizes="(max-width: 1280px) 28vw, 360px"
                      className="object-contain"
                      unoptimized
                    />
                  ) : enrichment.creativeStatus === "pending" ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <span className="size-5 animate-spin rounded-full border-2 border-teal border-t-transparent" />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Generating creative…
                      </span>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Creative placeholder
                      </span>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="space-y-2 px-2.5 py-2">
                <p className="line-clamp-3 text-[11px] leading-snug text-foreground/85">
                  {isLeaflet ? (
                    <span className="mr-1 inline-block rounded-sm bg-risk-amber-soft px-1 text-[9px] font-mono uppercase tracking-wider text-risk-amber">
                      PDF
                    </span>
                  ) : null}
                  {m.message}
                </p>

                {isLeaflet && enrichment?.qrCodeUrl ? (
                  <div className="flex items-center gap-2 rounded-md border border-hairline bg-canvas/40 p-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={enrichment.qrCodeUrl}
                      alt="Join QR code"
                      className="size-12 shrink-0 rounded-sm bg-white p-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Join QR
                      </div>
                      <div className="truncate font-mono text-[10px] text-foreground/70">
                        {enrichment.joinUrl ?? "neighbourhoodos.nl/join/…"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        enrichment.qrCodeUrl
                          ? downloadDataUrl(enrichment.qrCodeUrl, `qr-${m.clusterId}.png`)
                          : undefined
                      }
                      className="inline-flex h-6 shrink-0 items-center rounded-md border border-hairline bg-panel px-2 text-[10px] font-medium text-foreground/80 transition-colors hover:bg-muted/40"
                    >
                      Download QR
                    </button>
                  </div>
                ) : null}

                {enrichment?.campaignId ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-hairline bg-canvas/40 px-2 py-1">
                    <div className="min-w-0">
                      <div className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Campaign ID
                      </div>
                      <div className="truncate font-mono text-[10px] text-foreground/80">
                        {enrichment.campaignId}
                      </div>
                    </div>
                    {enrichment.adsManagerUrl ? (
                      <a
                        href={enrichment.adsManagerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-6 shrink-0 items-center rounded-md bg-teal px-2 text-[10px] font-medium text-primary-foreground transition-colors hover:opacity-90"
                      >
                        Open in Ads Manager
                      </a>
                    ) : enrichment.creativeUrl ? (
                      <a
                        href={enrichment.creativeUrl}
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
            </div>
          </li>
        );
      })}
    </ul>
  );
}
