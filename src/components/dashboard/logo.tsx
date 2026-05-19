export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      {/*
        Mark: three neighbourhood nodes connected to a central civic anchor.
        Reads as a small constellation; reinforces "neighbourhoods linked into
        a city". Monochrome teal, hairline ring, no gradient, no playful curves.
      */}
      <div className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-teal-soft/70 ring-1 ring-inset ring-teal/20">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-[18px] text-teal"
          aria-hidden="true"
        >
          {/* Connecting lines: drawn first so node fills sit on top. */}
          <g strokeWidth="1.25" opacity="0.55">
            <path d="M12 12 L6.5 6.5" />
            <path d="M12 12 L17.5 6.5" />
            <path d="M12 12 L12 18.5" />
          </g>
          {/* Outer nodes: hollow rings, civic monuments. */}
          <g strokeWidth="1.4" fill="var(--panel)">
            <circle cx="6.5" cy="6.5" r="1.9" />
            <circle cx="17.5" cy="6.5" r="1.9" />
            <circle cx="12" cy="18.5" r="1.9" />
          </g>
          {/* Central anchor: solid, the municipal core. */}
          <circle cx="12" cy="12" r="2.1" fill="currentColor" stroke="none" />
        </svg>
      </div>
      <div className="flex min-w-0 flex-col leading-none">
        <div className="flex items-baseline gap-1">
          <span className="text-[13px] font-semibold tracking-[-0.012em] text-foreground">
            Neighbourhood
          </span>
          <span className="font-mono text-[11px] font-semibold tracking-[-0.01em] text-teal">
            OS
          </span>
        </div>
        <span className="mt-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          Municipal Intelligence
        </span>
      </div>
    </div>
  );
}
