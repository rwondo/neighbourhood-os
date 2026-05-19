import { cn } from "@/lib/utils";
import { ChannelBadge } from "./channel-icon";
import type { Channel as TypesChannel, ClusterMessage } from "@/lib/types";

type SupportedChannel = "whatsapp" | "tiktok" | "sms" | "leaflet" | "facebook" | "instagram";

type ChannelPreview = {
  id: string;
  channel: SupportedChannel;
  cluster: string;
  message: string;
  statusLabel: string;
  statusTone: "pending" | "ready";
  isPdf?: boolean;
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

function isSupportedChannel(c: TypesChannel): c is SupportedChannel {
  return c === "whatsapp" || c === "tiktok" || c === "sms" || c === "leaflet" || c === "facebook" || c === "instagram";
}

export function ChannelPreviews({
  messages,
  running,
}: {
  messages: ClusterMessage[];
  running?: boolean;
}) {
  const previews: ChannelPreview[] = messages.map((m, i) => ({
    id: `m_${m.clusterId}_${i}`,
    channel: isSupportedChannel(m.channel) ? m.channel : "whatsapp",
    cluster: CLUSTER_LABEL[m.clusterId] ?? m.tone?.split("·")[0]?.trim() ?? m.clusterId,
    message: m.message,
    statusLabel: "Pending Approval",
    statusTone: "pending",
    isPdf: m.channel === "leaflet" || Boolean(m.pdfUrl),
  }));

  if (previews.length === 0) {
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
      {previews.map((p) => (
        <li key={p.id}>
          <div className="group relative overflow-hidden rounded-lg border border-hairline bg-panel transition-colors hover:border-hairline-strong">
            <div className="flex items-center justify-between gap-2 border-b border-hairline px-2.5 py-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <ChannelBadge channel={p.channel} size="sm" />
                <span className="truncate text-[11px] font-medium tracking-tight text-foreground">
                  {p.cluster}
                </span>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wider ring-1 ring-inset",
                  p.statusTone === "ready"
                    ? "bg-risk-green-soft text-risk-green ring-risk-green/20"
                    : "bg-risk-amber-soft text-risk-amber ring-risk-amber/20",
                )}
              >
                <span
                  className={cn(
                    "size-1 rounded-full",
                    p.statusTone === "ready" ? "bg-risk-green" : "bg-risk-amber",
                  )}
                />
                {p.statusLabel}
              </span>
            </div>
            <div className="px-2.5 py-2">
              {p.isPdf ? (
                <p className="line-clamp-2 text-[11px] leading-snug text-foreground/85">
                  <span className="mr-1 inline-block rounded-sm bg-risk-amber-soft px-1 text-[9px] font-mono uppercase tracking-wider text-risk-amber">
                    PDF
                  </span>
                  {p.message}
                </p>
              ) : (
                <p className="line-clamp-3 text-[11px] leading-snug text-foreground/85">{p.message}</p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
