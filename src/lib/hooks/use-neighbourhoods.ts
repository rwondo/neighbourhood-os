"use client";
import { useEffect, useState } from "react";
import type { CityKey } from "@/lib/types";

export type AlertRow = {
  id: string;
  buurtCode: string;
  name: string;
  score: number;
  trend: "up" | "down" | "flat";
  pctLivingAlone: number;
  pctElderly65: number;
};

export function useNeighbourhoods(city: CityKey) {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/neighbourhoods?city=${city}`)
      .then((r) => r.json())
      .then((data: { neighbourhoods: AlertRow[] }) => {
        if (cancelled) return;
        const sorted = [...data.neighbourhoods].sort((a, b) => a.score - b.score).slice(0, 4);
        setAlerts(sorted);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [city]);
  return { alerts, loading };
}
