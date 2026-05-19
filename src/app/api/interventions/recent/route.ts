import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { CityKey } from "@/lib/types";

const VALID_CITIES = ["rotterdam", "amsterdam", "denhaag"] as const;

type RecentRow = {
  id: string;
  neighbourhood_id: string;
  rationale: string | null;
  predicted_score_gain: string | number;
  predicted_connections: string | number;
  created_at: string;
  borough: string | null;
  buurt_name: string;
};

export type RecentInterventionRecord = {
  id: string;
  borough: string;
  buurtName: string;
  predictedScoreGain: number;
  predictedConnections: number;
  createdAt: string;
};

const toNum = (v: unknown) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

export async function GET(req: NextRequest) {
  const cityParam = req.nextUrl.searchParams.get("city");
  if (!cityParam || !VALID_CITIES.includes(cityParam as (typeof VALID_CITIES)[number])) {
    return NextResponse.json({ error: "invalid_city" }, { status: 400 });
  }
  const city = cityParam as CityKey;

  let rows: RecentRow[] = [];
  try {
    rows = (await db.execute<RecentRow>(sql`
      SELECT
        i.id AS id,
        i.neighbourhood_id AS neighbourhood_id,
        i.rationale AS rationale,
        i.predicted_score_gain AS predicted_score_gain,
        i.predicted_connections AS predicted_connections,
        i.created_at AS created_at,
        n.borough AS borough,
        n.name AS buurt_name
      FROM interventions i
      JOIN neighbourhoods n ON n.id = i.neighbourhood_id
      WHERE n.city = ${city}
      ORDER BY i.created_at DESC
      LIMIT 8
    `)) as unknown as RecentRow[];
  } catch (err) {
    console.warn(
      "[api/interventions/recent] query failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ interventions: [] satisfies RecentInterventionRecord[] });
  }

  const interventions: RecentInterventionRecord[] = rows
    .filter((r) => typeof r.borough === "string" && r.borough.length > 0)
    .map((r) => ({
      id: r.id,
      borough: r.borough as string,
      buurtName: r.buurt_name,
      predictedScoreGain: Math.round(toNum(r.predicted_score_gain)),
      predictedConnections: Math.round(toNum(r.predicted_connections)),
      createdAt: r.created_at,
    }));

  return NextResponse.json({ interventions });
}
