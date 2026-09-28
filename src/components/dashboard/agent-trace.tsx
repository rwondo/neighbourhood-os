import { cn } from "@/lib/utils";
import type { TraceStep } from "@/lib/hooks/use-intervention-stream";

// Visual law: the eye should land on the ACTIVE step instantly.
// Completed steps fade back. Pending steps wait quietly. Skipped/error
// get distinct, calmer treatment so they read at a glance without shouting.

export function AgentTrace({ steps }: { steps: TraceStep[] }) {
  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-hairline-strong bg-panel/60 px-3 py-6 text-center">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4 text-muted-foreground/60"
          aria-hidden="true"
        >
          <path d="M3 4h10" />
          <path d="M3 8h10" />
          <path d="M3 12h6" />
          <circle cx="13" cy="12" r="1.5" />
        </svg>
        <p className="text-[10.5px] text-muted-foreground">
          Trace appears when the orchestrator fires.
        </p>
      </div>
    );
  }

  // Find the index of the first non-completed step (the "current front" of the run).
  // Used to draw the rail's completed portion in teal and the rest as muted hairline.
  const activeIdx = steps.findIndex((s) => s.status === "active");
  const lastCompletedIdx = (() => {
    let i = -1;
    steps.forEach((s, idx) => {
      if (s.status === "completed") i = idx;
    });
    return i;
  })();
  const hasActive = activeIdx >= 0;
  const filledThroughIdx = hasActive ? activeIdx : lastCompletedIdx;
  // Rail-fill percentage based on completed depth — purely cosmetic.
  const railFillPct =
    steps.length <= 1
      ? 100
      : Math.max(0, Math.min(100, ((filledThroughIdx + 0.5) / (steps.length - 0.5)) * 100));

  return (
    <ol className="relative pl-1">
      {/* Connecting rail — base track */}
      <span aria-hidden="true" className="absolute left-[8px] top-2 bottom-2 w-px bg-hairline" />
      {/* Connecting rail — filled portion drawn from the top down */}
      <span
        aria-hidden="true"
        className="absolute left-[8px] top-2 w-px bg-teal/70 transition-[height] duration-700 ease-out"
        style={{ height: `calc(${railFillPct}% - 0.5rem)` }}
      />
      {/* Active-step sweep beacon — only visible when something is running */}
      {hasActive ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-[7px] w-[3px] overflow-hidden"
          style={{
            top: `calc(${(activeIdx / Math.max(steps.length, 1)) * 100}% + 0.5rem)`,
            height: `${100 / Math.max(steps.length, 1)}%`,
          }}
        >
          <span className="block h-full w-full animate-trace-sweep bg-gradient-to-b from-teal/0 via-teal to-teal/0" />
        </span>
      ) : null}

      {steps.map((step, i) => {
        const isActive = step.status === "active";
        const isCompleted = step.status === "completed";
        const isSkipped = step.status === "skipped";
        const isError = step.status === "error";
        const isPending = step.status === "pending";

        // Vertical rhythm: active row gets more breathing room, completed rows
        // tighten up, skipped/error sit between. Pending stays compact.
        const rowPadding = isActive
          ? "py-2"
          : isError
            ? "py-1.5"
            : isSkipped
              ? "py-1"
              : isCompleted
                ? "py-[3px]"
                : "py-1";

        return (
          <li
            key={step.id}
            className={cn(
              "relative isolate flex items-start gap-2.5 transition-[padding] duration-300 ease-out",
              rowPadding,
            )}
          >
            {/* Active row "halo" — soft teal wash that sits behind the node and
                label, giving the running step unmistakable presence. */}
            {isActive ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 -left-2 right-0 -z-10 rounded-md bg-teal-soft/60 ring-1 ring-inset ring-teal/20"
              />
            ) : null}

            {/* Node */}
            <span
              className={cn(
                "relative z-10 mt-[2px] flex shrink-0 items-center justify-center rounded-full border transition-all duration-300 ease-out",
                isActive
                  ? "size-[19px] border-teal bg-panel shadow-[0_0_0_3px_oklch(0.55_0.105_186/0.18)] animate-trace-pulse"
                  : "size-[17px]",
                isCompleted && "border-teal bg-teal",
                isSkipped && "border-risk-amber/55 bg-risk-amber-soft",
                isError &&
                  "border-risk-red bg-risk-red-soft shadow-[0_0_0_2px_oklch(0.58_0.21_27/0.15)]",
                isPending && "border-hairline-strong bg-panel",
              )}
              aria-hidden="true"
            >
              {isCompleted ? (
                <svg
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-2 text-primary-foreground"
                >
                  <path d="M2 5l2 2 4-4.5" />
                </svg>
              ) : isActive ? (
                <span className="relative flex size-[9px] items-center justify-center">
                  <span className="absolute inset-0 animate-blink-soft rounded-full bg-teal/60" />
                  <span className="relative size-[7px] rounded-full bg-teal" />
                </span>
              ) : isSkipped ? (
                <svg
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="size-2 text-risk-amber"
                >
                  <path d="M2 5h6" />
                </svg>
              ) : isError ? (
                <svg
                  viewBox="0 0 10 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="size-2 text-risk-red"
                >
                  <path d="M2.5 2.5L7.5 7.5" />
                  <path d="M7.5 2.5L2.5 7.5" />
                </svg>
              ) : (
                <span className="size-[5px] rounded-full bg-hairline-strong" />
              )}
            </span>

            {/* Body */}
            <div className="min-w-0 flex-1 pt-[1px]">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <span
                  className={cn(
                    "font-mono text-[9.5px] tabular transition-colors",
                    isActive && "font-semibold text-teal",
                    isCompleted && "text-foreground/45",
                    isError && "text-risk-red/80",
                    isSkipped && "text-risk-amber/75",
                    isPending && "text-muted-foreground/45",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "leading-tight transition-[color,font-size,font-weight] duration-300 ease-out",
                    isActive && "text-[12.5px] font-semibold tracking-tight text-foreground",
                    isCompleted && "text-[11px] text-foreground/65",
                    isError && "text-[11.5px] font-semibold text-risk-red",
                    isSkipped && "text-[11px] text-risk-amber/85",
                    isPending && "text-[11px] text-muted-foreground/85",
                  )}
                >
                  {step.label}
                </span>
                {isActive ? (
                  <span className="relative inline-flex shrink-0 items-center gap-1 overflow-hidden rounded-full bg-teal px-1.5 py-px font-mono text-[8.5px] font-semibold uppercase tracking-[0.08em] text-primary-foreground">
                    <span className="size-1 animate-blink-soft rounded-full bg-primary-foreground" />
                    running
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 -translate-x-full animate-shimmer-x bg-gradient-to-r from-white/0 via-white/30 to-white/0"
                    />
                  </span>
                ) : isError ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-risk-red-soft px-1.5 py-px font-mono text-[8.5px] font-semibold uppercase tracking-[0.08em] text-risk-red ring-1 ring-inset ring-risk-red/25">
                    failed
                  </span>
                ) : isSkipped ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-risk-amber-soft/70 px-1.5 py-px font-mono text-[8.5px] font-semibold uppercase tracking-[0.08em] text-risk-amber/90 ring-1 ring-inset ring-risk-amber/25">
                    skipped
                  </span>
                ) : null}
              </div>

              {step.detail ? (
                <p
                  className={cn(
                    "mt-0.5 truncate text-[10.5px] leading-snug transition-colors",
                    isActive && "text-foreground/75",
                    isCompleted && "text-muted-foreground/65",
                    isError && "text-risk-red/80",
                    isSkipped && "text-risk-amber/75",
                    isPending && "text-muted-foreground/65",
                  )}
                >
                  {step.detail}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
