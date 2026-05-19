"use client";

import { useEffect, useState } from "react";
import type { CityKey } from "@/lib/types";
import type { RecentInterventionRecord } from "@/app/api/interventions/recent/route";

export function useRecentInterventions(city: CityKey, refreshKey: number = 0) {
  const [interventions, setInterventions] = useState<RecentInterventionRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Fetch-and-reset pattern — intentional sync setState before the fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    fetch(`/api/interventions/recent?city=${city}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ interventions: RecentInterventionRecord[] }>;
      })
      .then((data) => {
        if (!cancelled) {
          setInterventions(data.interventions ?? []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load interventions");
          setInterventions([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [city, refreshKey]);

  return { interventions, loading, error };
}
