"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { CITIES, type CityKey } from "@/lib/mock-data";

export function CitySwitcherPill({
  value,
  onChange,
}: {
  value: CityKey;
  onChange: (city: CityKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = CITIES.find((c) => c.key === value)!;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className={cn(
          // Floating pill. Backdrop-blur is purposeful for legibility over the
          // coloured borough map underneath; not decorative.
          "group inline-flex items-center gap-2 rounded-full border bg-panel/85 py-[5px] pl-2 pr-1.5 text-[11.5px] font-medium tracking-tight text-foreground backdrop-blur-md transition-all duration-150 ease-out",
          "shadow-[0_1px_0_oklch(1_0_0_/_0.65)_inset,0_4px_14px_-6px_oklch(0.18_0.01_250_/_0.18),0_1px_3px_-1px_oklch(0.18_0.01_250_/_0.08)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/40",
          open
            ? "border-hairline-strong bg-panel/95"
            : "border-hairline hover:border-hairline-strong hover:bg-panel/95",
        )}
      >
        {/* Active indicator: pulsing teal dot signals the "live" city. */}
        <span className="relative flex size-2 items-center justify-center">
          <span
            aria-hidden="true"
            className="absolute inline-flex size-full animate-ping rounded-full bg-teal/35 opacity-70"
          />
          <span className="relative inline-flex size-1.5 rounded-full bg-teal" />
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="font-semibold tracking-tight">{current.label}</span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted-foreground/80">
            {current.shortLabel}
          </span>
        </span>
        <span
          aria-hidden="true"
          className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-canvas/60 text-muted-foreground ring-1 ring-inset ring-hairline transition-colors group-hover:text-foreground"
        >
          <svg
            viewBox="0 0 12 12"
            className={cn(
              "size-2.5 transition-transform duration-150 ease-out",
              open && "rotate-180",
            )}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 4.75L6 7.75L9 4.75" />
          </svg>
        </span>
      </button>
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Cities"
          className={cn(
            "absolute left-0 top-[calc(100%+8px)] z-50 min-w-[208px] overflow-hidden rounded-xl border border-hairline bg-panel/95 backdrop-blur-md",
            "shadow-[0_12px_36px_-12px_oklch(0.18_0.01_250_/_0.18),0_2px_8px_-2px_oklch(0.18_0.01_250_/_0.08)]",
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-hairline bg-canvas/40 px-2.5 py-1.5">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
              Switch municipality
            </span>
            <span className="font-mono text-[9.5px] tabular text-muted-foreground/60">
              {CITIES.length}
            </span>
          </div>
          <div className="p-1">
            {CITIES.map((c) => {
              const selected = c.key === value;
              return (
                <button
                  key={c.key}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(c.key);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors duration-100 ease-out",
                    "focus-visible:outline-none focus-visible:bg-muted/40",
                    selected ? "bg-teal-soft/70" : "hover:bg-muted/40",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full transition-colors",
                      selected
                        ? "bg-teal text-primary-foreground"
                        : "bg-canvas/60 ring-1 ring-inset ring-hairline",
                    )}
                  >
                    {selected ? (
                      <svg
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-2.5"
                      >
                        <path d="M2.75 6.25L5 8.5L9.25 3.75" />
                      </svg>
                    ) : (
                      <span className="size-1 rounded-full bg-muted-foreground/40" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "text-[12px] font-semibold tracking-tight",
                        selected ? "text-foreground" : "text-foreground/85",
                      )}
                    >
                      {c.label}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[9.5px] uppercase tracking-[0.1em] tabular",
                        selected ? "text-teal" : "text-muted-foreground/60",
                      )}
                    >
                      {c.shortLabel}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
