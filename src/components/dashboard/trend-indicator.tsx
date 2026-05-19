import { cn } from "@/lib/utils";
import type { Trend } from "@/lib/mock-data";

/**
 * TrendIndicator - minimal directional glyph.
 *
 * Tone is intentionally inverted from CDI semantics: an upward arrow in this
 * dashboard means social fabric is improving (green), a downward arrow means
 * it is deteriorating (red). Flat is amber, matching the moderate band.
 *
 * The glyph sits as a single inline-flex span so it can be placed alongside a
 * ScoreBadge or a StatCard label without throwing off baselines.
 */
export function TrendIndicator({
  trend,
  className,
}: {
  trend: Trend;
  className?: string;
}) {
  if (trend === "down") {
    return (
      <span
        aria-label="trending down"
        className={cn(
          "inline-flex size-4 items-center justify-center rounded-sm bg-risk-red-soft/70 text-risk-red ring-1 ring-inset ring-risk-red/15",
          className
        )}
      >
        <svg viewBox="0 0 12 12" className="size-2.5" fill="currentColor" aria-hidden="true">
          <path d="M6 10L1.5 3.5h9L6 10z" />
        </svg>
      </span>
    );
  }
  if (trend === "up") {
    return (
      <span
        aria-label="trending up"
        className={cn(
          "inline-flex size-4 items-center justify-center rounded-sm bg-risk-green-soft/70 text-risk-green ring-1 ring-inset ring-risk-green/20",
          className
        )}
      >
        <svg viewBox="0 0 12 12" className="size-2.5" fill="currentColor" aria-hidden="true">
          <path d="M6 2l4.5 6.5h-9L6 2z" />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-label="flat"
      className={cn(
        "inline-flex size-4 items-center justify-center rounded-sm bg-muted/60 text-muted-foreground ring-1 ring-inset ring-hairline",
        className
      )}
    >
      <svg viewBox="0 0 12 12" className="size-2.5" fill="currentColor" aria-hidden="true">
        <rect x="2" y="5" width="8" height="2" rx="1" />
      </svg>
    </span>
  );
}
