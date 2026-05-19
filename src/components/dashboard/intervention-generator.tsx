export function InterventionGenerator({
  selectedName,
  running,
  onRun,
}: {
  selectedName: string | null;
  running: boolean;
  onRun: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-hairline-strong bg-panel p-3">
      <div className="flex items-start gap-2.5">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-teal-soft text-teal">
          <svg viewBox="0 0 16 16" fill="currentColor" className="size-3.5" aria-hidden="true">
            <path d="M8 1l1.6 4.2L14 6.8l-4.4 1.6L8 12.6 6.4 8.4 2 6.8l4.4-1.6L8 1z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[12.5px] font-semibold tracking-tight text-foreground">
            Intervention Generator
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {selectedName ? `Strategy will be built for ${selectedName}.` : "Select a neighbourhood to generate an intervention strategy."}
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={!selectedName || running}
        onClick={onRun}
        className="mt-3 inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-md bg-teal text-[11.5px] font-medium text-primary-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-70"
      >
        <svg viewBox="0 0 12 12" fill="currentColor" className="size-3" aria-hidden="true">
          <path d="M6 1l1.5 3.5L11 6l-3.5 1.5L6 11l-1.5-3.5L1 6l3.5-1.5L6 1z" />
        </svg>
        {running ? "Generating…" : "Generate Strategy"}
      </button>
    </div>
  );
}
