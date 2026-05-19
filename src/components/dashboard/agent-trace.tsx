import { cn } from "@/lib/utils";
import type { TraceStep } from "@/lib/hooks/use-intervention-stream";

export function AgentTrace({ steps }: { steps: TraceStep[] }) {
  return (
    <ol className="relative space-y-2.5 pl-1">
      <span aria-hidden="true" className="absolute left-[7px] top-2 bottom-2 w-px bg-hairline" />
      {steps.map((step, i) => (
        <li key={step.id} className="relative flex items-start gap-2.5">
          <span
            className={cn(
              "relative z-10 mt-[3px] flex size-[15px] shrink-0 items-center justify-center rounded-full border bg-panel",
              step.status === "completed" && "border-teal bg-teal",
              step.status === "active" && "border-teal animate-pulse",
              step.status === "pending" && "border-hairline-strong"
            )}
          >
            <span
              className={cn(
                "size-1 rounded-full",
                step.status === "completed" ? "bg-white" : step.status === "active" ? "bg-teal" : "bg-hairline-strong"
              )}
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] tabular text-muted-foreground/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "text-[11.5px] leading-tight",
                  step.status === "active" ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
