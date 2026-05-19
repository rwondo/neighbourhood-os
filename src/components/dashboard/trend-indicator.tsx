import { cn } from "@/lib/utils";
import type { Trend } from "@/lib/mock-data";

export function TrendIndicator({ trend, className }: { trend: Trend; className?: string }) {
  if (trend === "down") {
    return (
      <span className={cn("inline-flex items-center text-risk-red text-[11px]", className)}>
        <svg viewBox="0 0 12 12" className="size-3" fill="currentColor" aria-hidden="true">
          <path d="M6 10L1.5 3.5h9L6 10z" />
        </svg>
      </span>
    );
  }
  if (trend === "up") {
    return (
      <span className={cn("inline-flex items-center text-risk-green text-[11px]", className)}>
        <svg viewBox="0 0 12 12" className="size-3" fill="currentColor" aria-hidden="true">
          <path d="M6 2l4.5 6.5h-9L6 2z" />
        </svg>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center text-risk-amber text-[11px]", className)}>
      <svg viewBox="0 0 12 12" className="size-3" fill="currentColor" aria-hidden="true">
        <path d="M10 6L4 2.5v7L10 6z" />
      </svg>
    </span>
  );
}
