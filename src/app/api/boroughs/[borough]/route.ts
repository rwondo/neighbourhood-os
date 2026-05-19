import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { neighbourhoods } from "@/lib/db/schema";
import { riskLevelCDI, colorForCDI, type CDIRiskLevel, type CDIColor } from "@/lib/score";
import type { CityKey } from "@/lib/types";

const VALID_CITIES = ["rotterdam", "amsterdam", "denhaag"] as const;
const INDUSTRIAL_BOROUGHS = new Set(["Haven"]);

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

export type BoroughTopBuurt = {
  buurtCode: string;
  name: string;
  cdi: number;
  score: number;
  pctLivingAlone: number;
  pctElderly65: number;
  pctSingleParent: number;
};

export type BoroughDetailResponse = {
  borough: string;
  city: CityKey;
  buurtCount: number;
  avgScore: number;
  avgCdi: number;
  riskLevel: CDIRiskLevel;
  color: CDIColor;
  rankInCity: number;
  totalBoroughs: number;
  components: {
    V: number;
    A: number;
    S: number;
    E: number;
    H: number;
    PT: number;
    W: number;
    D: number;
    R: number;
  };
  demographics: {
    pctLivingAlone: number;
    pctElderly65: number;
    pctSingleParent: number;
    lowIncomeIndex: number;
    populationTurnover: number;
    amenityDistanceKm: number;
  };
  infrastructure: {
    transitStops500m: number;
    poiLibraries: number;
    poiCommunityCentres: number;
    poiParks: number;
    poiBenches: number;
    poiCafes: number;
    poiSports: number;
  };
  topBuurten: BoroughTopBuurt[];
};

type CityRankRow = {
  borough: string | null;
  avg_cdi: string | number | null;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ borough: string }> },
) {
  const cityParam = req.nextUrl.searchParams.get("city");
  if (!cityParam || !VALID_CITIES.includes(cityParam as (typeof VALID_CITIES)[number])) {
    return NextResponse.json(
      { error: "Missing or invalid 'city' query parameter." },
      { status: 400 },
    );
  }
  const city = cityParam as CityKey;
  const { borough: rawBorough } = await params;
  const borough = decodeURIComponent(rawBorough);

  if (INDUSTRIAL_BOROUGHS.has(borough)) {
    return NextResponse.json(
      { error: "industrial_borough", borough },
      { status: 404 },
    );
  }

  const where = and(eq(neighbourhoods.city, city), sql`${neighbourhoods.borough} = ${borough}`);
  const rows = await db.select().from(neighbourhoods).where(where);
  if (rows.length === 0) {
    return NextResponse.json({ error: "borough_not_found" }, { status: 404 });
  }

  const avg = (key: keyof (typeof rows)[number]) =>
    rows.reduce((acc, r) => acc + toNum(r[key]), 0) / rows.length;
  const sum = (key: keyof (typeof rows)[number]) =>
    rows.reduce((acc, r) => acc + toNum(r[key]), 0);

  const avgCdi = avg("cdi");
  const avgScore = avg("score");

  // CDI sub-components live in cdi_breakdown jsonb (V/A/S + components.E/H/PT/W/D/R)
  type Breakdown = {
    V?: number;
    A?: number;
    S?: number;
    components?: { E?: number; H?: number; PT?: number; W?: number; D?: number; R?: number };
  };
  const bdAvg = (pick: (b: Breakdown) => number | undefined) => {
    const vals: number[] = [];
    for (const row of rows) {
      const b = (row.cdiBreakdown ?? {}) as Breakdown;
      const v = pick(b);
      if (typeof v === "number" && Number.isFinite(v)) vals.push(v);
    }
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  // Determine rank within city by avgCdi DESC (worst is rank 1)
  const cityRows = (await db.execute<CityRankRow>(sql`
    SELECT borough, AVG(COALESCE(cdi, 0)) AS avg_cdi
    FROM neighbourhoods
    WHERE city = ${city} AND borough IS NOT NULL AND borough <> ''
    GROUP BY borough
    ORDER BY AVG(COALESCE(cdi, 0)) DESC
  `)) as unknown as CityRankRow[];
  const totalBoroughs = cityRows.length;
  const rankInCity = cityRows.findIndex((r) => r.borough === borough) + 1 || totalBoroughs;

  // Top buurten by worst CDI (limit 5)
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

  const response: BoroughDetailResponse = {
    borough,
    city,
    buurtCount: rows.length,
    avgScore: r1(avgScore),
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

  return NextResponse.json(response);
}
