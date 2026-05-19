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
  cluster_young_adults: "Young adults 18-35",
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
    return { label: "Creating campaign", tone: "active" };
  if (enrichment.mcpStatus === "live")
    return { label: "Live (paused)", tone: "ready" };
  if (enrichment.mcpStatus === "manual_fallback")
    return { label: "Manual upload", tone: "manual" };
  if (enrichment.creativeStatus === "pending")
    return { label: "Generating creative", tone: "active" };
  if (enrichment.creativeStatus === "ready") return { label: "Creative ready", tone: "ready" };
  if (enrichment.creativeStatus === "fallback")
    return { label: "Placeholder", tone: "manual" };
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

type ChannelGroup = "social" | "leaflet" | "messaging";

function groupForChannel(channel: SupportedChannel): ChannelGroup {
  if (channel === "facebook" || channel === "instagram" || channel === "tiktok") return "social";
  if (channel === "leaflet") return "leaflet";
  return "messaging";
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
              <div className="relative overflow-hidden rounded-lg border border-dashed border-hairline-strong bg-panel">
                <div className="absolute inset-y-0 left-0 w-[40%] animate-shimmer-x bg-gradient-to-r from-transparent via-muted/35 to-transparent" />
                <div className="flex items-center justify-between gap-2 border-b border-hairline px-2.5 py-1.5">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="size-4 rounded-md bg-muted/50" />
                    <span className="h-2 w-20 rounded-sm bg-muted/50" />
                  </div>
                  <span className="h-2 w-14 rounded-full bg-muted/40" />
                </div>
                <div className="space-y-1 px-2.5 py-2">
                  <span className="block h-2 w-full rounded-sm bg-muted/40" />
                  <span className="block h-2 w-3/5 rounded-sm bg-muted/30" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-hairline-strong bg-canvas/30 px-3 py-6 text-center">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="size-4 text-muted-foreground/60" aria-hidden="true">
          <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
          <path d="M2 6.5h12" />
          <path d="M5 9h4" />
        </svg>
        <p className="max-w-[24ch] text-[10.5px] leading-snug text-muted-foreground">
          Per-cluster message variants stream in after the orchestrator generates a strategy.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {messages.map((m, i) => {
        const channel: SupportedChannel = isSupportedChannel(m.channel) ? m.channel : "whatsapp";
        const cluster =
          CLUSTER_LABEL[m.clusterId] ?? m.tone?.split("·")[0]?.trim() ?? m.clusterId;
        const enrichment = enrichments?.[enrichmentKey(m.clusterId, m.channel)];
        const status = statusForCard(enrichment);
        const group = groupForChannel(channel);

        if (group === "messaging") {
          return (
            <MessagingCard
              key={`m_${m.clusterId}_${i}`}
              channel={channel}
              cluster={cluster}
              message={m.message}
              status={status}
              enrichment={enrichment}
              clusterId={m.clusterId}
            />
          );
        }
        if (group === "leaflet") {
          return (
            <LeafletCard
              key={`m_${m.clusterId}_${i}`}
              cluster={cluster}
              message={m.message}
              status={status}
              enrichment={enrichment}
              clusterId={m.clusterId}
            />
          );
        }
        return (
          <SocialCard
            key={`m_${m.clusterId}_${i}`}
            channel={channel}
            cluster={cluster}
            message={m.message}
            status={status}
            enrichment={enrichment}
            clusterId={m.clusterId}
          />
        );
      })}
    </ul>
  );
}

// ============================================================================
// Variant 1: MessagingCard (WhatsApp, SMS) — chat-bubble feel, no image slot
// ============================================================================
function MessagingCard({
  channel,
  cluster,
  message,
  status,
  enrichment,
}: {
  channel: SupportedChannel;
  cluster: string;
  message: string;
  status: { label: string; tone: StatusTone };
  enrichment: ChannelEnrichment | undefined;
  clusterId: string;
}) {
  const isWa = channel === "whatsapp";
  return (
    <li>
      <div className="overflow-hidden rounded-lg border border-hairline bg-panel">
        <div className="flex items-center justify-between gap-2 border-b border-hairline px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <ChannelBadge channel={channel} size="sm" />
            <span className="truncate text-[11px] font-medium tracking-tight text-foreground">
              {cluster}
            </span>
          </div>
          <StatusPill status={status} />
        </div>
        <div
          className={cn(
            "px-2.5 py-2.5",
            isWa ? "bg-channel-whatsapp/[0.04]" : "bg-canvas/30",
          )}
        >
          {/* Chat bubble */}
          <div className="flex items-start gap-1.5">
            <span
              className={cn(
                "mt-1 size-1.5 shrink-0 rounded-full",
                isWa ? "bg-channel-whatsapp" : "bg-channel-sms",
              )}
            />
            <div
              className={cn(
                "relative max-w-full rounded-md rounded-tl-sm px-2.5 py-1.5 text-[11px] leading-relaxed text-foreground/85 shadow-[0_1px_0_oklch(0.93_0.004_250)]",
                isWa
                  ? "bg-white ring-1 ring-inset ring-channel-whatsapp/15"
                  : "bg-white ring-1 ring-inset ring-hairline",
              )}
            >
              <p className="whitespace-pre-line">{message}</p>
              <div className="mt-1 flex items-center justify-end gap-1 font-mono text-[8.5px] text-muted-foreground/60">
                <span>{isWa ? "WA" : "SMS"}</span>
                <span>·</span>
                <span>delivered</span>
              </div>
            </div>
          </div>
        </div>
        {enrichment?.campaignId ? (
          <CampaignFooter enrichment={enrichment} />
        ) : null}
      </div>
    </li>
  );
}

// ============================================================================
// Variant 2: SocialCard (Facebook, Instagram, TikTok) — image-forward
// ============================================================================
function SocialCard({
  channel,
  cluster,
  message,
  status,
  enrichment,
}: {
  channel: SupportedChannel;
  cluster: string;
  message: string;
  status: { label: string; tone: StatusTone };
  enrichment: ChannelEnrichment | undefined;
  clusterId: string;
}) {
  const aspect = aspectClassFor(channel);
  const showImage = Boolean(enrichment?.creativeUrl);

  return (
    <li>
      <div className="overflow-hidden rounded-lg border border-hairline bg-panel">
        <div className="flex items-center justify-between gap-2 border-b border-hairline px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <ChannelBadge channel={channel} size="sm" />
            <span className="truncate text-[11px] font-medium tracking-tight text-foreground">
              {cluster}
            </span>
          </div>
          <StatusPill status={status} />
        </div>

        {enrichment ? (
          <div className={cn("relative w-full overflow-hidden bg-canvas/40", aspect)}>
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
                  Generating creative
                </span>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                <svg viewBox="0 0 16 16" className="size-4 text-muted-foreground/50" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" aria-hidden="true">
                  <rect x="2" y="2" width="12" height="12" rx="1.5" />
                  <circle cx="5.5" cy="6" r="1" />
                  <path d="M3 11l3-3 3 2 4-4" />
                </svg>
                <span className="text-[9.5px] uppercase tracking-wider text-muted-foreground">
                  Creative placeholder
                </span>
              </div>
            )}
          </div>
        ) : null}

        <div className="space-y-2 px-2.5 py-2">
          <p className="line-clamp-3 text-[11px] leading-snug text-foreground/85">{message}</p>
          {enrichment?.campaignId ? <CampaignFooter enrichment={enrichment} inline /> : null}
        </div>
      </div>
    </li>
  );
}

// ============================================================================
// Variant 3: LeafletCard (Physical PDF) — paper-tinted, QR-forward
// ============================================================================
function LeafletCard({
  cluster,
  message,
  status,
  enrichment,
  clusterId,
}: {
  cluster: string;
  message: string;
  status: { label: string; tone: StatusTone };
  enrichment: ChannelEnrichment | undefined;
  clusterId: string;
}) {
  const showImage = Boolean(enrichment?.creativeUrl);

  return (
    <li>
      <div className="overflow-hidden rounded-lg border border-hairline bg-channel-leaflet/[0.04]">
        <div className="flex items-center justify-between gap-2 border-b border-hairline px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <ChannelBadge channel="leaflet" size="sm" />
            <span className="truncate text-[11px] font-medium tracking-tight text-foreground">
              {cluster}
            </span>
            <span className="shrink-0 rounded-sm bg-channel-leaflet/12 px-1 py-px font-mono text-[8.5px] font-semibold uppercase tracking-wider text-channel-leaflet ring-1 ring-inset ring-channel-leaflet/25">
              A5 PDF
            </span>
          </div>
          <StatusPill status={status} />
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2 p-2">
          <div className="paper-grid relative aspect-[9/12] overflow-hidden rounded-md border border-hairline bg-white">
            {showImage && enrichment?.creativeUrl ? (
              <Image
                src={enrichment.creativeUrl}
                alt={`${cluster} · leaflet`}
                fill
                sizes="(max-width: 1280px) 18vw, 200px"
                className="object-contain"
                unoptimized
              />
            ) : enrichment?.creativeStatus === "pending" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/70">
                <span className="size-4 animate-spin rounded-full border-2 border-channel-leaflet border-t-transparent" />
                <span className="text-[9px] uppercase tracking-wider text-channel-leaflet/80">
                  Rendering PDF
                </span>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/70 p-3 text-center">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="size-5 text-channel-leaflet/70" aria-hidden="true">
                  <path d="M3.5 1.5h6L13 5v9.5H3.5z" />
                  <path d="M9.5 1.5V5H13" />
                  <path d="M5.5 8h5" />
                  <path d="M5.5 10.5h5" />
                  <path d="M5.5 13h3" />
                </svg>
                <span className="text-[9px] uppercase tracking-wider text-channel-leaflet/80">
                  Print-ready A5 PDF
                </span>
              </div>
            )}
          </div>

          <div className="flex w-[120px] flex-col justify-between">
            <p className="line-clamp-5 text-[10.5px] leading-snug text-foreground/80">
              {message}
            </p>
            {enrichment?.qrCodeUrl ? (
              <div className="mt-1.5 flex flex-col items-center gap-1 rounded-md border border-hairline bg-panel p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={enrichment.qrCodeUrl}
                  alt="Join QR"
                  className="size-14 rounded-sm bg-white p-0.5"
                />
                <button
                  type="button"
                  onClick={() =>
                    enrichment?.qrCodeUrl
                      ? downloadDataUrl(enrichment.qrCodeUrl, `qr-${clusterId}.png`)
                      : undefined
                  }
                  className="inline-flex h-5 items-center gap-1 rounded-sm px-1 font-mono text-[9px] uppercase tracking-wider text-channel-leaflet hover:bg-channel-leaflet/10"
                >
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="size-2.5" aria-hidden="true">
                    <path d="M5 1.5v5" />
                    <path d="M2.5 4.5L5 7l2.5-2.5" />
                    <path d="M1.5 8.5h7" />
                  </svg>
                  QR
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {enrichment?.campaignId ? <CampaignFooter enrichment={enrichment} /> : null}
      </div>
    </li>
  );
}

// ============================================================================
// Shared bits
// ============================================================================
function StatusPill({ status }: { status: { label: string; tone: StatusTone } }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ring-1 ring-inset",
        status.tone === "ready" && "bg-risk-green-soft text-risk-green ring-risk-green/20",
        status.tone === "active" && "bg-teal-soft/60 text-teal ring-teal/25",
        status.tone === "pending" && "bg-muted/40 text-muted-foreground ring-hairline-strong",
        status.tone === "manual" && "bg-risk-amber-soft text-risk-amber ring-risk-amber/20",
      )}
    >
      <span
        className={cn(
          "size-1 rounded-full",
          status.tone === "ready" && "bg-risk-green",
          status.tone === "active" && "animate-blink-soft bg-teal",
          status.tone === "pending" && "bg-muted-foreground/60",
          status.tone === "manual" && "bg-risk-amber",
        )}
      />
      {status.label}
    </span>
  );
}

function CampaignFooter({
  enrichment,
  inline = false,
}: {
  enrichment: ChannelEnrichment;
  inline?: boolean;
}) {
  if (!enrichment.campaignId) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 bg-canvas/40 px-2 py-1",
        inline ? "rounded-md border border-hairline" : "border-t border-hairline",
      )}
    >
      <div className="min-w-0">
        <div className="text-[8.5px] font-semibold uppercase tracking-wider text-muted-foreground/80">
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
          className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-teal px-2 text-[10px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Ads Manager
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-2" aria-hidden="true">
            <path d="M3.5 2H8v4.5" />
            <path d="M8 2L3.5 6.5" />
          </svg>
        </a>
      ) : enrichment.creativeUrl ? (
        <a
          href={enrichment.creativeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-risk-amber/30 bg-risk-amber-soft px-2 text-[10px] font-medium text-risk-amber transition-colors hover:bg-risk-amber-soft/80"
        >
          Download
        </a>
      ) : null}
    </div>
  );
}
