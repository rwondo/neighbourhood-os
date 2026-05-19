import { cn } from "@/lib/utils";
import { ChannelBadge } from "./channel-icon";
import { CHANNEL_PREVIEWS, type ChannelPreview } from "@/lib/mock-data";
import type { ClusterMessage } from "@/lib/types";

export function ChannelPreviews({ messages }: { messages: ClusterMessage[] }) {
  const data: ChannelPreview[] = messages.length
    ? messages.map((m, i) => ({
        id: `m_${i}`,
        channel: m.channel as ChannelPreview["channel"],
        cluster: m.tone || m.language || "Cluster",
        message: m.message,
        statusLabel: "Pending Approval",
        statusTone: "pending",
        isPdf: m.channel === "leaflet",
      }))
    : CHANNEL_PREVIEWS;

  return (
    <ul className="space-y-2">
      {data.map((p) => (
        <li key={p.id}>
          <div className="group relative overflow-hidden rounded-lg border border-hairline bg-panel transition-colors hover:border-hairline-strong">
            <div className="flex items-center justify-between gap-2 border-b border-hairline px-2.5 py-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <ChannelBadge channel={p.channel} size="sm" />
                <span className="truncate text-[11px] font-medium tracking-tight text-foreground">{p.cluster}</span>
              </div>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wider ring-1 ring-inset bg-risk-amber-soft text-risk-amber ring-risk-amber/20")}>
                <span className="size-1 rounded-full bg-risk-amber" />
                {p.statusLabel}
              </span>
            </div>
            <div className="px-2.5 py-2">
              <p className="line-clamp-2 text-[11px] leading-snug text-foreground/85">{p.message}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
