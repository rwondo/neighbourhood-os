import { cn } from "@/lib/utils";

/**
 * StatCard - small labeled value tile.
 *
 * Compositional atom for the bottom-of-map metric row. Designed to live in a
 * 3-up or 4-up strip without dominating the surface above it: muted surface,
 * minimal chrome, tone applied to the numeral only.
 *
 * The label sits on its own row above the value, with optional `hint` flowing
 * inline at the right as a tertiary range marker (e.g. "70-100"). A faint dot
 * inherits the tone so the tile has one accent point rather than a coloured
 * fill or a stripe.
 */
export function StatCard({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: number | string;
  tone?: "default" | "amber" | "red" | "teal" | "green";
  hint?: string;
}) {
  const numeralTone = {
    default: "text-foreground",
    amber: "text-risk-amber",
    red: "text-risk-red",
    teal: "text-teal",
    green: "text-risk-green",
  }[tone];

  const dotTone = {
    default: "bg-muted-foreground/30",
    amber: "bg-risk-amber",
    red: "bg-risk-red",
    teal: "bg-teal",
    green: "bg-risk-green",
  }[tone];

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-hairline bg-panel px-3 py-2.5",
        "transition-colors duration-200 ease-out hover:border-hairline-strong hover:bg-canvas/60",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("size-1 rounded-full", dotTone)} />
          <span className="text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
            {label}
          </span>
        </div>
        {hint ? (
          <span className="font-mono tabular text-[9.5px] uppercase tracking-[0.04em] text-muted-foreground/65">
            {hint}
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "mt-1.5 flex items-baseline gap-1 font-mono tabular text-[22px] font-semibold leading-none",
          numeralTone,
        )}
      >
        {value}
      </div>
    </div>
  );
}
