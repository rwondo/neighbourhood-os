import { cn } from "@/lib/utils";

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
  const toneClass = {
    default: "text-foreground",
    amber: "text-risk-amber",
    red: "text-risk-red",
    teal: "text-teal",
    green: "text-risk-green",
  }[tone];

  return (
    <div className="group relative rounded-lg border border-hairline bg-panel px-3 py-2.5 transition-colors hover:border-hairline-strong">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          {label}
        </span>
        {hint ? (
          <span className="text-[9.5px] uppercase tracking-wider text-muted-foreground/70">{hint}</span>
        ) : null}
      </div>
      <div className={cn("mt-1.5 font-mono tabular text-[22px] font-medium leading-none", toneClass)}>
        {value}
      </div>
    </div>
  );
}
