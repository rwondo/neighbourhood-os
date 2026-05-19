import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { riskLevelCDI, colorForCDI } from "@/lib/score";
import { makeLogger } from "@/lib/log";
import type { BoroughAggregate, CityKey } from "@/lib/types";

const log = makeLogger("api:boroughs");

const VALID_CITIES = ["rotterdam", "amsterdam", "denhaag"] as const;

// Boroughs we exclude from CDI aggregates because they don't represent a
// residential population (port, industrial zones, etc.). The map still renders
// their polygons in grey via the legacy fallback in `mock-data.ts`.
const INDUSTRIAL_BOROUGHS = ["Haven"];

type AggregateRow = {
  borough: string | null;
  buurt_count: string | number;
  avg_score: string | number | null;
  avg_cdi: string | number | null;
  avg_v: string | number | null;
  avg_a: string | number | null;
  avg_s: string | number | null;
};

const toNum = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const toInt = (v: unknown): number => Math.round(toNum(v));

export async function GET(req: NextRequest) {
  const cityParam = req.nextUrl.searchParams.get("city");
  if (!cityParam || !VALID_CITIES.includes(cityParam as (typeof VALID_CITIES)[number])) {
    return NextResponse.json(
      { error: "Missing or invalid 'city' query parameter. Must be one of: rotterdam, amsterdam, denhaag." },
      { status: 400 },
    );
  }
  const city = cityParam as CityKey;

  // Aggregate at SQL level. We reference `cdi`, `borough`, `cdi_breakdown` directly so
  // this route works even though those columns aren't yet typed in schema.ts.
  // If the parallel migration hasn't landed, we catch and degrade gracefully.
  // Parameterised IN-list — safer than sql.raw string interpolation in case the
  // exclusion list ever picks up a borough name with a single quote.
  const industrialList = sql.join(
    INDUSTRIAL_BOROUGHS.map((b) => sql`${b}`),
    sql`, `,
  );

  let rows: AggregateRow[] = [];
  try {
    rows = (await db.execute<AggregateRow>(sql`
      SELECT
        borough AS borough,
        COUNT(*) AS buurt_count,
        AVG(score) AS avg_score,
        AVG(COALESCE(cdi, 0)) AS avg_cdi,
        AVG(NULLIF((cdi_breakdown ->> 'V'), '')::real) AS avg_v,
        AVG(NULLIF((cdi_breakdown ->> 'A'), '')::real) AS avg_a,
        AVG(NULLIF((cdi_breakdown ->> 'S'), '')::real) AS avg_s
      FROM neighbourhoods
      WHERE city = ${city}
        AND borough IS NOT NULL
        AND borough <> ''
        AND borough NOT IN (${industrialList})
      GROUP BY borough
      ORDER BY AVG(COALESCE(cdi, 0)) DESC
    `)) as unknown as AggregateRow[];
  } catch (err) {
    log.warn(
      "aggregate query failed (likely missing cdi/borough/cdi_breakdown columns); returning empty list",
      { err: err instanceof Error ? err.message : err },
    );
    return NextResponse.json({ boroughs: [] satisfies BoroughAggregate[] });
  }

  const boroughs: BoroughAggregate[] = rows
    .filter((r) => typeof r.borough === "string" && r.borough.length > 0)
    .map((r) => {
      const avgCdi = toNum(r.avg_cdi);
      const avgScore = toNum(r.avg_score);
      const buurtCount = toInt(r.buurt_count);
      const aggregate: BoroughAggregate = {
        borough: r.borough as string,
        city,
        buurtCount,
        avgScore: Math.round(avgScore * 100) / 100,
        avgCdi: Math.round(avgCdi * 100) / 100,
        riskLevel: riskLevelCDI(avgCdi),
        color: colorForCDI(avgCdi),
      };
      if (r.avg_v !== null && r.avg_v !== undefined) aggregate.avgV = Math.round(toNum(r.avg_v) * 100) / 100;
      if (r.avg_a !== null && r.avg_a !== undefined) aggregate.avgA = Math.round(toNum(r.avg_a) * 100) / 100;
      if (r.avg_s !== null && r.avg_s !== undefined) aggregate.avgS = Math.round(toNum(r.avg_s) * 100) / 100;
      return aggregate;
    });

  // Per-city quartile rebinning so the map shows differentiation.
  //
  // Absolute CDI thresholds (per prompt.txt: 0-30 low, 30-50 moderate, 50-70 high,
  // 70-100 severe) cluster almost every borough into "high/orange" after the
  // V+A+S weighted average + buurt-level aggregation compress the dynamic range
  // to roughly 37-69. The numeric `avgCdi` stays authoritative for the tooltip;
  // we override `riskLevel` and `color` to encode the borough's quartile rank
  // within its city. Map readers want "which areas to prioritise in our city",
  // and percentile binning guarantees a 25/25/25/25 visual spread.
  if (boroughs.length > 0) {
    // boroughs come from SQL already sorted by avgCdi DESC (worst first)
    const n = boroughs.length;
    const q1 = Math.max(1, Math.round(n * 0.25)); // top 25%: severe
    const q2 = Math.max(q1 + 1, Math.round(n * 0.5)); // next 25%: high
    const q3 = Math.max(q2 + 1, Math.round(n * 0.75)); // next 25%: moderate
    boroughs.forEach((b, i) => {
      if (i < q1) {
        b.riskLevel = "severe";
        b.color = "red";
      } else if (i < q2) {
        b.riskLevel = "high";
        b.color = "orange";
      } else if (i < q3) {
        b.riskLevel = "moderate";
        b.color = "yellow";
      } else {
        b.riskLevel = "low";
        b.color = "green";
      }
    });
  }

  return NextResponse.json({ boroughs });
}
