import { cn } from "@/lib/utils";
import { riskLevel } from "@/lib/mock-data";

/**
 * ScoreBadge - coloured numeric pill.
 *
 * Tone tracks the CDI risk band (green healthy / amber moderate / red severe)
 * so the badge reads consistently next to map fills and sidebar dots.
 *
 * Sizes share a single mono character grid; weight scales with footprint so
 * the badge sits comfortably next to a TrendIndicator or StatCard label without
 * overpowering its neighbours.
 */
export function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const level = riskLevel(score);
  const tone =
    level === "high-isolation"
      ? "bg-risk-red-soft text-risk-red ring-risk-red/20"
      : level === "at-risk"
        ? "bg-risk-amber-soft text-risk-amber ring-risk-amber/25"
        : "bg-risk-green-soft text-risk-green ring-risk-green/25";

  const sizing =
    size === "sm"
      ? "h-[18px] min-w-[26px] px-1 text-[10.5px] font-semibold"
      : size === "lg"
        ? "h-7 min-w-[36px] px-2 text-[13.5px] font-semibold"
        : "h-6 min-w-[32px] px-1.5 text-[12px] font-semibold";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md font-mono tabular leading-none ring-1 ring-inset",
        "transition-colors duration-200 ease-out",
        tone,
        sizing,
      )}
    >
      {score}
    </span>
  );
}
