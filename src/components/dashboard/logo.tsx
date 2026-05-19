export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative size-7 shrink-0">
        <div className="absolute inset-0 rounded-full bg-teal" />
        <div className="absolute inset-[3px] rounded-full bg-teal/60 mix-blend-overlay" />
        <div className="absolute inset-[6px] rounded-full bg-teal/40 mix-blend-screen" />
        <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-black/[0.06]" />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-[13px] font-semibold tracking-[-0.012em] text-foreground">
          Neighbourhood OS
        </span>
        <span className="mt-1 text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">
          Municipal Intelligence Platform
        </span>
      </div>
    </div>
  );
}
