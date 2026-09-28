import { cn } from "@/lib/utils";
import type { Channel } from "@/lib/mock-data";

// ----- Inline glyphs -----------------------------------------------------------
// Each glyph is tuned for legibility at 10–14px and inherits currentColor so the
// surrounding badge can paint it in the channel's brand tint. No CDN logos —
// these are tasteful evocations of the brand silhouette.

function GlyphWhatsApp() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-full">
      <path
        d="M8 1.8a6.2 6.2 0 0 0-5.27 9.43L1.8 14.2l3.05-.9A6.2 6.2 0 1 0 8 1.8Z"
        fill="currentColor"
        opacity="0.18"
      />
      <path
        d="M8 1.8a6.2 6.2 0 0 0-5.27 9.43L1.8 14.2l3.05-.9A6.2 6.2 0 1 0 8 1.8Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M5.85 5.55c.1-.27.31-.32.45-.32h.4c.13 0 .31.04.46.36.16.34.53 1.18.58 1.28.05.1.08.22.02.34-.06.13-.1.21-.2.32-.1.11-.21.25-.3.34-.1.1-.2.2-.1.4.1.21.49.81.96 1.22.62.54 1.08.66 1.27.76.18.1.29.08.4-.03.1-.12.46-.54.59-.73.13-.18.25-.15.42-.09.18.07 1.08.51 1.27.6.18.1.31.14.36.22.04.08.04.45-.1.89-.15.43-.85.84-1.2.86-.34.03-.66.16-2.2-.46-1.87-.74-3.06-2.63-3.15-2.76-.09-.13-.75-1-.75-1.91 0-.91.48-1.36.65-1.55Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GlyphTikTok() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-full">
      {/* music-note hybrid with TikTok offset feel — single colour, currentColor */}
      <path
        d="M9.6 2.2c.05 1.05.55 1.96 1.4 2.55.55.39 1.22.59 1.92.6V7.1a5.3 5.3 0 0 1-3.07-.94v4.43a3.45 3.45 0 1 1-2.95-3.4v1.95a1.55 1.55 0 1 0 1.05 1.45V2.2H9.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GlyphSMS() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-full">
      <path
        d="M2.6 4.2c0-.94.76-1.7 1.7-1.7h7.4c.94 0 1.7.76 1.7 1.7v5.05c0 .94-.76 1.7-1.7 1.7H6.5l-2.62 2.1a.45.45 0 0 1-.73-.35V11c-.31-.27-.55-.71-.55-1.2V4.2Z"
        fill="currentColor"
        opacity="0.16"
      />
      <path
        d="M2.6 4.2c0-.94.76-1.7 1.7-1.7h7.4c.94 0 1.7.76 1.7 1.7v5.05c0 .94-.76 1.7-1.7 1.7H6.5l-2.62 2.1a.45.45 0 0 1-.73-.35V11c-.31-.27-.55-.71-.55-1.2V4.2Z"
        stroke="currentColor"
        strokeWidth="1.05"
        strokeLinejoin="round"
      />
      <circle cx="5.5" cy="6.8" r="0.7" fill="currentColor" />
      <circle cx="8" cy="6.8" r="0.7" fill="currentColor" />
      <circle cx="10.5" cy="6.8" r="0.7" fill="currentColor" />
    </svg>
  );
}

function GlyphLeaflet() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-full">
      {/* A folded leaflet/document with crease */}
      <path
        d="M3.6 2.5h6L12.4 5v8.2a.3.3 0 0 1-.3.3H3.6a.3.3 0 0 1-.3-.3V2.8a.3.3 0 0 1 .3-.3Z"
        fill="currentColor"
        opacity="0.16"
      />
      <path
        d="M3.6 2.5h6L12.4 5v8.2a.3.3 0 0 1-.3.3H3.6a.3.3 0 0 1-.3-.3V2.8a.3.3 0 0 1 .3-.3Z"
        stroke="currentColor"
        strokeWidth="1.05"
        strokeLinejoin="round"
      />
      <path d="M9.6 2.5V5h2.8" stroke="currentColor" strokeWidth="1.05" strokeLinejoin="round" />
      <path
        d="M5.4 8h5.2M5.4 10h5.2M5.4 12h3"
        stroke="currentColor"
        strokeWidth="1.05"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlyphFacebook() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-full">
      <circle cx="8" cy="8" r="6.2" fill="currentColor" opacity="0.16" />
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.05" />
      <path
        d="M9.05 14V8.85h1.45l.22-1.7H9.05V6.1c0-.5.14-.83.85-.83h.9V3.78a12 12 0 0 0-1.31-.07c-1.3 0-2.19.8-2.19 2.25v1.25H5.85v1.7H7.3V14h1.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GlyphInstagram() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-full">
      <rect x="2.4" y="2.4" width="11.2" height="11.2" rx="3" fill="currentColor" opacity="0.16" />
      <rect
        x="2.4"
        y="2.4"
        width="11.2"
        height="11.2"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.05"
      />
      <circle cx="8" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="11.3" cy="4.7" r="0.7" fill="currentColor" />
    </svg>
  );
}

// ----- Channel metadata --------------------------------------------------------

const META: Record<
  Channel,
  {
    label: string;
    short: string;
    bg: string;
    fg: string;
    ring: string;
    Glyph: () => React.ReactNode;
  }
> = {
  whatsapp: {
    label: "WhatsApp",
    short: "WA",
    bg: "bg-channel-whatsapp/12",
    fg: "text-channel-whatsapp",
    ring: "ring-channel-whatsapp/25",
    Glyph: GlyphWhatsApp,
  },
  tiktok: {
    label: "TikTok",
    short: "TT",
    // TikTok brand ink is near-black — pair it with a faint ink-tinted plate so
    // the glyph stays crisp without overwhelming the row.
    bg: "bg-foreground/[0.06]",
    fg: "text-foreground",
    ring: "ring-foreground/15",
    Glyph: GlyphTikTok,
  },
  sms: {
    label: "SMS",
    short: "SMS",
    bg: "bg-channel-sms/12",
    fg: "text-channel-sms",
    ring: "ring-channel-sms/25",
    Glyph: GlyphSMS,
  },
  leaflet: {
    label: "Leaflet",
    short: "PDF",
    bg: "bg-channel-leaflet/12",
    fg: "text-channel-leaflet",
    ring: "ring-channel-leaflet/25",
    Glyph: GlyphLeaflet,
  },
  facebook: {
    label: "Facebook",
    short: "FB",
    bg: "bg-channel-facebook/12",
    fg: "text-channel-facebook",
    ring: "ring-channel-facebook/25",
    Glyph: GlyphFacebook,
  },
  instagram: {
    label: "Instagram",
    short: "IG",
    bg: "bg-channel-instagram/12",
    fg: "text-channel-instagram",
    ring: "ring-channel-instagram/25",
    Glyph: GlyphInstagram,
  },
};

// ----- Public components -------------------------------------------------------

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
  const dims =
    size === "xs"
      ? { box: "size-4", glyph: "size-3" }
      : size === "md"
        ? { box: "size-6", glyph: "size-[18px]" }
        : { box: "size-5", glyph: "size-[15px]" };
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1.5", withLabel ? "pr-1" : null)}
      title={m.label}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-md ring-1 ring-inset",
          m.bg,
          m.fg,
          m.ring,
          dims.box,
        )}
      >
        <span className={cn("flex items-center justify-center", dims.glyph)}>
          <m.Glyph />
        </span>
      </span>
      {withLabel ? (
        <span className="text-[10.5px] font-medium tracking-tight text-foreground/80">
          {m.label}
        </span>
      ) : null}
    </span>
  );
}

export function ChannelLabel({ channel }: { channel: Channel }) {
  return META[channel].label;
}

export function channelMeta(channel: Channel) {
  const { label, short, bg, fg, ring } = META[channel];
  return { label, short, bg, fg, ring };
}
