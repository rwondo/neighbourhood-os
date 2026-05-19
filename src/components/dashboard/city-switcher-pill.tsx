"use client";

import { useEffect, useRef, useState } from "react";
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
        className={cn(
          "group inline-flex items-center gap-1.5 rounded-full border border-hairline bg-panel py-1 pl-2.5 pr-1.5 text-[11.5px] font-medium text-foreground transition-all",
          "hover:border-hairline-strong hover:bg-muted/30",
          open && "border-hairline-strong bg-muted/30"
        )}
      >
        <span className="size-1.5 rounded-full bg-teal" />
        <span className="tracking-tight">{current.label}</span>
        <svg
          viewBox="0 0 12 12"
          className={cn(
            "size-3 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[160px] overflow-hidden rounded-lg border border-hairline bg-panel shadow-[0_6px_24px_-8px_rgb(0_0_0_/_0.10),0_2px_6px_-2px_rgb(0_0_0_/_0.06)]"
        >
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
                  "flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left text-[12px] transition-colors",
                  selected
                    ? "bg-teal-soft text-foreground"
                    : "text-foreground hover:bg-muted/40"
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      selected ? "bg-teal" : "bg-hairline-strong"
                    )}
                  />
                  <span className="font-medium tracking-tight">{c.label}</span>
                </span>
                <span className="font-mono text-[10px] tabular text-muted-foreground">
                  {c.totalBuurten}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
