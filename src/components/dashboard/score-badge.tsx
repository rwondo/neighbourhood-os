import { cn } from "@/lib/utils";
import { riskLevel } from "@/lib/mock-data";

export function ScoreBadge({
  score,
  size = "md",
}: {
  score: number;
  size?: "sm" | "md" | "lg";
}) {
  const level = riskLevel(score);
  const tone =
    level === "high-isolation"
      ? "bg-risk-red-soft text-risk-red ring-risk-red/15"
      : level === "at-risk"
        ? "bg-risk-amber-soft text-risk-amber ring-risk-amber/20"
        : "bg-risk-green-soft text-risk-green ring-risk-green/20";

  const sizing =
    size === "sm"
      ? "h-5 px-1.5 text-[11px]"
      : size === "lg"
        ? "h-7 px-2 text-[13px]"
        : "h-6 px-1.5 text-[12px]";

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md ring-1 ring-inset font-mono tabular font-medium",
        tone,
        sizing
      )}
    >
      {score}
    </span>
  );
}
