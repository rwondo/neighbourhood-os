import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { neighbourhoods, type Neighbourhood } from "@/lib/db/schema";
import { riskLevelCDI, colorForCDI } from "@/lib/score";
import type {
  BoroughAggregate,
  BoroughDetailResponse,
  BoroughTopBuurt,
  CityKey,
  CitySnapshot,
  RecentInterventionRecord,
} from "@/lib/types";

export const CITY_KEYS: readonly CityKey[] = ["rotterdam", "amsterdam", "denhaag"];

export function parseCity(value: string | null): CityKey | null {
  return CITY_KEYS.includes(value as CityKey) ? (value as CityKey) : null;
}

// Boroughs excluded from CDI aggregates because they don't represent a
// residential population (Rotterdam's port area).
export const INDUSTRIAL_BOROUGHS: ReadonlySet<string> = new Set(["Haven"]);

const toNum = (v: unknown): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};
const r2 = (v: number) => Math.round(v * 100) / 100;
const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * Per-city quartile rebinning so the map shows differentiation.
 *
 * Absolute CDI bands (score.ts riskLevelCDI: 0-30 low, 30-50 moderate, 50-70
 * high, 70-100 severe) put almost every borough in "high", because averaging
 * buurten compresses borough CDI to roughly 37-69. The numeric avgCdi stays
 * authoritative; riskLevel and color encode the borough's quartile rank within
 * its city instead ("which areas to prioritise first in this city").
 *
 * Expects boroughs sorted worst-first (highest avgCdi first).
 */
export function applyQuartileBands(sortedWorstFirst: BoroughAggregate[]): BoroughAggregate[] {
  const n = sortedWorstFirst.length;
  if (n === 0) return [];
  const q1 = Math.max(1, Math.round(n * 0.25));
  const q2 = Math.max(q1 + 1, Math.round(n * 0.5));
  const q3 = Math.max(q2 + 1, Math.round(n * 0.75));
  return sortedWorstFirst.map((b, i): BoroughAggregate => {
    if (i < q1) return { ...b, riskLevel: "severe", color: "red" };
    if (i < q2) return { ...b, riskLevel: "high", color: "orange" };
    if (i < q3) return { ...b, riskLevel: "moderate", color: "yellow" };
    return { ...b, riskLevel: "low", color: "green" };
  });
}

type AggregateRow = {
  borough: string | null;
  buurt_count: string | number;
  avg_score: string | number | null;
  avg_cdi: string | number | null;
  avg_v: string | number | null;
  avg_a: string | number | null;
  avg_s: string | number | null;
};

/** Borough-level CDI averages for one city, worst first, with quartile bands. */
export async function queryBoroughAggregates(city: CityKey): Promise<BoroughAggregate[]> {
  const industrialList = sql.join(
    [...INDUSTRIAL_BOROUGHS].map((b) => sql`${b}`),
    sql`, `,
  );
  const rows = (await getDb().execute<AggregateRow>(sql`
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

  const boroughs = rows
    .filter((r) => typeof r.borough === "string" && r.borough.length > 0)
    .map((r) => {
      const avgCdi = toNum(r.avg_cdi);
      const aggregate: BoroughAggregate = {
        borough: r.borough as string,
        city,
        buurtCount: Math.round(toNum(r.buurt_count)),
        avgScore: r2(toNum(r.avg_score)),
        avgCdi: r2(avgCdi),
        riskLevel: riskLevelCDI(avgCdi),
        color: colorForCDI(avgCdi),
      };
      if (r.avg_v !== null && r.avg_v !== undefined) aggregate.avgV = r2(toNum(r.avg_v));
      if (r.avg_a !== null && r.avg_a !== undefined) aggregate.avgA = r2(toNum(r.avg_a));
      if (r.avg_s !== null && r.avg_s !== undefined) aggregate.avgS = r2(toNum(r.avg_s));
      return aggregate;
    });
  return applyQuartileBands(boroughs);
}

// CDI sub-components live in the cdi_breakdown jsonb column.
type Breakdown = {
  V?: number;
  A?: number;
  S?: number;
  components?: { E?: number; H?: number; PT?: number; W?: number; D?: number; R?: number };
};

/**
 * Shapes one borough's buurt rows into the detail payload. `cityRanking` is the
 * city's residential boroughs ordered worst-first by average CDI.
 */
export function buildBoroughDetail({
  city,
  borough,
  rows,
  cityRanking,
}: {
  city: CityKey;
  borough: string;
  rows: Neighbourhood[];
  cityRanking: string[];
}): BoroughDetailResponse {
  const avg = (key: keyof Neighbourhood) =>
    rows.reduce((acc, r) => acc + toNum(r[key]), 0) / rows.length;
  const sum = (key: keyof Neighbourhood) => rows.reduce((acc, r) => acc + toNum(r[key]), 0);
  const bdAvg = (pick: (b: Breakdown) => number | undefined) => {
    const vals: number[] = [];
    for (const row of rows) {
      const v = pick((row.cdiBreakdown ?? {}) as Breakdown);
      if (typeof v === "number" && Number.isFinite(v)) vals.push(v);
    }
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  const avgCdi = avg("cdi");
  const totalBoroughs = cityRanking.length;
  const rankInCity = cityRanking.indexOf(borough) + 1 || totalBoroughs;

  const topBuurten: BoroughTopBuurt[] = [...rows]
    .sort((a, b) => toNum(b.cdi) - toNum(a.cdi))
    .slice(0, 5)
    .map((r) => ({
      buurtCode: r.buurtCode,
      name: r.name,
      cdi: r2(toNum(r.cdi)),
      score: r1(toNum(r.score)),
      pctLivingAlone: r1(toNum(r.pctLivingAlone)),
      pctElderly65: r1(toNum(r.pctElderly65)),
      pctSingleParent: r1(toNum(r.pctSingleParent)),
    }));

  return {
    borough,
    city,
    buurtCount: rows.length,
    avgScore: r1(avg("score")),
    avgCdi: r1(avgCdi),
    riskLevel: riskLevelCDI(avgCdi),
    color: colorForCDI(avgCdi),
    rankInCity,
    totalBoroughs,
    components: {
      V: r1(bdAvg((b) => b.V)),
      A: r1(bdAvg((b) => b.A)),
      S: r1(bdAvg((b) => b.S)),
      E: r1(bdAvg((b) => b.components?.E)),
      H: r1(bdAvg((b) => b.components?.H)),
      PT: r1(bdAvg((b) => b.components?.PT)),
      W: r1(bdAvg((b) => b.components?.W)),
      D: r1(bdAvg((b) => b.components?.D)),
      R: r1(bdAvg((b) => b.components?.R)),
    },
    demographics: {
      pctLivingAlone: r1(avg("pctLivingAlone")),
      pctElderly65: r1(avg("pctElderly65")),
      pctSingleParent: r1(avg("pctSingleParent")),
      lowIncomeIndex: r1(avg("lowIncomeIndex")),
      populationTurnover: r1(avg("populationTurnover")),
      amenityDistanceKm: r2(avg("amenityDistanceKm")),
    },
    infrastructure: {
      transitStops500m: Math.round(sum("transitStops500m")),
      poiLibraries: Math.round(sum("poiLibraries")),
      poiCommunityCentres: Math.round(sum("poiCommunityCentres")),
      poiParks: Math.round(sum("poiParks")),
      poiBenches: Math.round(sum("poiBenches")),
      poiCafes: Math.round(sum("poiCafes")),
      poiSports: Math.round(sum("poiSports")),
    },
    topBuurten,
  };
}

/** Detail payload for one borough, or null when it has no buurten. */
export async function queryBoroughDetail(
  city: CityKey,
  borough: string,
): Promise<BoroughDetailResponse | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(neighbourhoods)
    .where(and(eq(neighbourhoods.city, city), sql`${neighbourhoods.borough} = ${borough}`));
  if (rows.length === 0) return null;
  const ranking = await queryBoroughAggregates(city);
  return buildBoroughDetail({ city, borough, rows, cityRanking: ranking.map((b) => b.borough) });
}

type RecentRow = {
  id: string;
  created_at: string | Date;
  predicted_score_gain: string | number;
  predicted_connections: string | number;
  borough: string | null;
  buurt_name: string;
};

/** Most recent stored intervention runs for a city, newest first. */
export async function queryRecentInterventions(
  city: CityKey,
  limit = 8,
): Promise<RecentInterventionRecord[]> {
  const rows = (await getDb().execute<RecentRow>(sql`
    SELECT
      i.id AS id,
      i.predicted_score_gain AS predicted_score_gain,
      i.predicted_connections AS predicted_connections,
      i.created_at AS created_at,
      n.borough AS borough,
      n.name AS buurt_name
    FROM interventions i
    JOIN neighbourhoods n ON n.id = i.neighbourhood_id
    WHERE n.city = ${city}
    ORDER BY i.created_at DESC
    LIMIT ${limit}
  `)) as unknown as RecentRow[];
  return rows
    .filter((r) => typeof r.borough === "string" && r.borough.length > 0)
    .map((r) => ({
      id: r.id,
      borough: r.borough as string,
      buurtName: r.buurt_name,
      predictedScoreGain: Math.round(toNum(r.predicted_score_gain)),
      predictedConnections: Math.round(toNum(r.predicted_connections)),
      createdAt: new Date(r.created_at).toISOString(),
    }));
}

/** Everything the dashboard reads for one city, used to build the static snapshot. */
export async function queryCitySnapshot(city: CityKey): Promise<CitySnapshot> {
  const boroughs = await queryBoroughAggregates(city);
  const details: Record<string, BoroughDetailResponse> = {};
  for (const b of boroughs) {
    const detail = await queryBoroughDetail(city, b.borough);
    if (detail) details[b.borough] = detail;
  }
  const recentInterventions = await queryRecentInterventions(city);
  return { boroughs, details, recentInterventions };
}
