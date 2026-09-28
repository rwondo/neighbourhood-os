"use client";

import { useEffect, useState } from "react";
import { listDemoBoroughs, readDemoFlag } from "@/lib/demo-data";

/**
 * Small pill that surfaces when `?demo=1` is active in live mode, so it's
 * unambiguous that the user is replaying a sample run rather than a live AI
 * run. (Static snapshot mode is labelled in the center panel header instead.)
 */
export function DemoModeBadge() {
  const [flag, setFlag] = useState<string | null>(null);

  useEffect(() => {
    // Read the URL flag once on mount — deferred from render to avoid an
    // SSR/client hydration mismatch on `window.location.search`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFlag(readDemoFlag());
  }, []);

  if (!flag) return null;

  const boroughs = listDemoBoroughs();
  const scope =
    flag === "1" || flag === "on" || flag === "true" || flag === "*"
      ? boroughs.map((b) => b.borough).join(" · ")
      : (boroughs.find((b) => b.borough.toLowerCase() === flag)?.borough ?? flag);

  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-50 -translate-x-1/2">
      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-teal/30 bg-panel/90 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-teal shadow-[0_4px_18px_-6px_oklch(0.55_0.105_186/0.55)] backdrop-blur-md">
        <span className="size-1.5 rounded-full bg-teal" />
        <span className="tracking-[0.16em]">Demo mode</span>
        <span className="text-muted-foreground/60">·</span>
        <span className="font-mono normal-case tracking-tight text-foreground/80">{scope}</span>
      </div>
    </div>
  );
}
