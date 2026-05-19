import { cn } from "@/lib/utils";
import type { Channel } from "@/lib/mock-data";

const META: Record<
  Channel,
  { label: string; short: string; bg: string; fg: string; ring: string }
> = {
  whatsapp: {
    label: "WhatsApp",
    short: "WA",
    bg: "bg-channel-whatsapp/12",
    fg: "text-channel-whatsapp",
    ring: "ring-channel-whatsapp/20",
  },
  tiktok: {
    label: "TikTok",
    short: "TT",
    bg: "bg-channel-tiktok/10",
    fg: "text-channel-tiktok",
    ring: "ring-channel-tiktok/15",
  },
  sms: {
    label: "SMS",
    short: "SMS",
    bg: "bg-channel-sms/12",
    fg: "text-channel-sms",
    ring: "ring-channel-sms/20",
  },
  leaflet: {
    label: "Leaflet",
    short: "PDF",
    bg: "bg-channel-leaflet/12",
    fg: "text-channel-leaflet",
    ring: "ring-channel-leaflet/20",
  },
};

export function ChannelBadge({
  channel,
  size = "sm",
  withLabel = false,
}: {
  channel: Channel;
  size?: "xs" | "sm" | "md";
  withLabel?: boolean;
}) {
  const m = META[channel];
  const sz =
    size === "xs"
      ? "h-4 min-w-[20px] px-1 text-[9px]"
      : size === "md"
        ? "h-6 min-w-[28px] px-1.5 text-[10.5px]"
        : "h-5 min-w-[22px] px-1 text-[9.5px]";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md ring-1 ring-inset font-mono font-semibold uppercase tracking-[0.04em] tabular",
        m.bg,
        m.fg,
        m.ring,
        sz
      )}
      title={m.label}
    >
      {m.short}
      {withLabel ? <span className="ml-1.5 normal-case tracking-normal">{m.label}</span> : null}
    </span>
  );
}

export function ChannelLabel({ channel }: { channel: Channel }) {
  return META[channel].label;
}

export function channelMeta(channel: Channel) {
  return META[channel];
}
