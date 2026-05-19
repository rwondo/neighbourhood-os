"use client";

import { useEffect, useState } from "react";
import type { CityKey } from "@/lib/types";

export type BoroughScore = {
  borough: string;
  avgScore: number;
  avgCdi: number;
  buurtCount: number;
  riskLevel: "low" | "moderate" | "high" | "severe";
  color: "green" | "yellow" | "orange" | "red";
  avgV?: number;
  avgA?: number;
  avgS?: number;
};

type BoroughAggregateResponse = {
  boroughs: Array<{
    borough: string;
    city: CityKey;
    buurtCount: number;
    avgScore: number;
    avgCdi: number;
    riskLevel: "low" | "moderate" | "high" | "severe";
    color: "green" | "yellow" | "orange" | "red";
    avgV?: number;
    avgA?: number;
    avgS?: number;
  }>;
};

export function useBoroughs(city: CityKey): {
  scores: Map<string, BoroughScore>;
  ordered: BoroughScore[];
  loading: boolean;
  error: string | null;
} {
  const [scores, setScores] = useState<Map<string, BoroughScore>>(new Map());
  const [ordered, setOrdered] = useState<BoroughScore[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Fetch-and-reset pattern — synchronous setState here resets the previous
    // city's data before the new fetch resolves. This is intentional.
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    setError(null);
    setScores(new Map());
    setOrdered([]);
    /* eslint-enable react-hooks/set-state-in-effect */

    fetch(`/api/boroughs?city=${city}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<BoroughAggregateResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        const list: BoroughScore[] = (data.boroughs ?? []).map((b) => ({
          borough: b.borough,
          avgScore: b.avgScore,
          avgCdi: b.avgCdi,
          buurtCount: b.buurtCount,
          riskLevel: b.riskLevel,
          color: b.color,
          avgV: b.avgV,
          avgA: b.avgA,
          avgS: b.avgS,
        }));
        const map = new Map<string, BoroughScore>(list.map((b) => [b.borough, b]));
        setScores(map);
        setOrdered(list);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load boroughs");
        setScores(new Map());
        setOrdered([]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [city]);

  return { scores, ordered, loading, error };
}
