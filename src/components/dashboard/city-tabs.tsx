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
    <div className="relative">
      <div className="flex items-stretch gap-0 border-b border-hairline">
        {CITIES.map((c) => {
          const active = c.key === value;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onChange(c.key)}
              className={cn(
                "relative flex-1 px-2 pb-2 pt-1 text-[12px] font-medium transition-colors",
                "after:absolute after:inset-x-2 after:bottom-[-1px] after:h-[2px] after:rounded-t-sm after:transition-all",
                active
                  ? "text-foreground after:bg-teal"
                  : "text-muted-foreground hover:text-foreground after:bg-transparent"
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
