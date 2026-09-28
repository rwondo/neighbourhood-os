"use client";

import { cn } from "@/lib/utils";
import { CITIES, type CityKey } from "@/lib/mock-data";

export function CityTabs({
  value,
  onChange,
}: {
  value: CityKey;
  onChange: (city: CityKey) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Select city"
      className="relative flex items-stretch gap-0.5 rounded-md border border-hairline bg-canvas/40 p-0.5"
    >
      {CITIES.map((c) => {
        const active = c.key === value;
        return (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(c.key)}
            className={cn(
              "group relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[5px] px-2 py-1.5 transition-all duration-150 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40",
              active
                ? "bg-panel text-foreground shadow-[0_1px_0_var(--hairline-strong),0_1px_2px_-1px_oklch(0.18_0.01_250_/_0.06)]"
                : "text-muted-foreground hover:bg-panel/70 hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "text-[12px] font-semibold leading-none tracking-tight transition-colors",
                active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
              )}
            >
              {c.label}
            </span>
            <span
              className={cn(
                "font-mono text-[8.5px] font-medium uppercase leading-none tracking-[0.1em] transition-colors",
                active ? "text-teal" : "text-muted-foreground/55 group-hover:text-muted-foreground",
              )}
            >
              {c.shortLabel}
            </span>
            {/* Active accent: sits flush under the resting tab pill. */}
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-x-2 -bottom-[2px] h-[2px] rounded-full bg-teal transition-opacity duration-150 ease-out",
                active ? "opacity-100" : "opacity-0",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
