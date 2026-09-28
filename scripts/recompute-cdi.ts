import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";
import * as schema from "@/lib/db/schema";
import { neighbourhoods } from "@/lib/db/schema";
import { computeCDIBreakdown, computeCityStats, type CDIInputs, type CityStats } from "@/lib/score";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[cdi] DATABASE_URL is not set");
  process.exit(1);
}

const MIGRATION_PATH = path.resolve(process.cwd(), "drizzle/0005_cdi.sql");
const BOROUGHS_PATH = path.resolve(process.cwd(), "public/boroughs.geojson");

type BoroughProps = { city: string; borough: string };
type BoroughFeature = Feature<Polygon | MultiPolygon, BoroughProps>;
type BoroughsCollection = FeatureCollection<Polygon | MultiPolygon, BoroughProps>;

type BuurtRow = typeof neighbourhoods.$inferSelect;

const CITY_KEYS = ["amsterdam", "rotterdam", "denhaag"] as const;
type CityKey = (typeof CITY_KEYS)[number];

function isCityKey(s: string): s is CityKey {
  return (CITY_KEYS as readonly string[]).includes(s);
}

async function applyMigration(sql: postgres.Sql): Promise<void> {
  const ddl = readFileSync(MIGRATION_PATH, "utf8");
  console.log(`[cdi] applying migration ${path.basename(MIGRATION_PATH)}`);
  await sql.unsafe(ddl);
  console.log("[cdi] migration applied");
}

function loadBoroughs(): Map<CityKey, BoroughFeature[]> {
  const raw = readFileSync(BOROUGHS_PATH, "utf8");
  const fc = JSON.parse(raw) as BoroughsCollection;
  const byCity = new Map<CityKey, BoroughFeature[]>();
  for (const key of CITY_KEYS) byCity.set(key, []);
  for (const f of fc.features) {
    const cityProp = f.properties?.city;
    if (!cityProp || !isCityKey(cityProp)) continue;
    if (!f.geometry || (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon")) {
      continue;
    }
    byCity.get(cityProp)!.push(f);
  }
  for (const key of CITY_KEYS) {
    console.log(`[cdi] boroughs loaded: ${key} = ${byCity.get(key)!.length}`);
  }
  return byCity;
}

function findBorough(lng: number, lat: number, boroughs: BoroughFeature[]): string | null {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const pt = point([lng, lat]);
  for (const f of boroughs) {
    try {
      if (booleanPointInPolygon(pt, f)) {
        return f.properties.borough;
      }
    } catch {
      // ignore broken geom
    }
  }
  return null;
}

function buurtToCdiInputs(b: BuurtRow): CDIInputs {
  return {
    pctElderly65: b.pctElderly65,
    pctLivingAlone: b.pctLivingAlone,
    amenityDistanceKm: b.amenityDistanceKm,
    weatherIsolation: b.weatherIsolation,
    // The following are optional new columns; cast through schema raw shape.
    // They are guaranteed present in DB (per task brief), so read via index.
    transitStops500m: numField(b, "transitStops500m"),
    poiLibraries: numField(b, "poiLibraries"),
    poiCommunityCentres: numField(b, "poiCommunityCentres"),
    poiParks: numField(b, "poiParks"),
    poiBenches: numField(b, "poiBenches"),
    poiCafes: numField(b, "poiCafes"),
    poiSports: numField(b, "poiSports"),
    poiIntersections: numField(b, "poiIntersections"),
  };
}

function numField(row: BuurtRow, key: string): number {
  const r = row as unknown as Record<string, unknown>;
  const v = r[key];
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

// Industrial / harbour / barely-inhabited buurten are flagged in
// raw.lowSignal by scripts/refresh-demographics.ts. Including them in the
// per-city min-max normaliser explodes the range (e.g. 100% living alone)
// and pushes every real residential buurt toward the orange/red end of the
// CDI scale. We exclude them from stats and assign a neutral CDI=50.
function isLowSignal(row: BuurtRow): boolean {
  const raw = (row as unknown as { raw?: unknown }).raw;
  if (raw && typeof raw === "object" && raw !== null) {
    const ls = (raw as Record<string, unknown>).lowSignal;
    if (ls === true) return true;
  }
  // Belt-and-braces: a NaN demographic value also signals low signal.
  if (!Number.isFinite(row.pctLivingAlone) || !Number.isFinite(row.pctElderly65)) {
    return true;
  }
  return false;
}

type RiskCounts = { low: number; moderate: number; high: number; severe: number };

async function main(): Promise<void> {
  const t0 = Date.now();
  const sql = postgres(DATABASE_URL!, { prepare: false, max: 5 });
  const db = drizzle(sql, { schema });

  try {
    await applyMigration(sql);

    const boroughsByCity = loadBoroughs();

    // Use Drizzle select so column names match the typed schema (camelCase).
    // Raw postgres-js returns snake_case keys, which we don't want here.
    const allRows = await db.select().from(neighbourhoods);
    const allRowsFiltered = allRows.filter(
      (r) =>
        Number.isFinite(r.centroidLng) &&
        Number.isFinite(r.centroidLat) &&
        r.centroidLng !== 0 &&
        r.centroidLat !== 0,
    );
    console.log(
      `[cdi] loaded ${allRows.length} buurten from DB (${allRowsFiltered.length} with centroids)`,
    );

    const byCity = new Map<CityKey, BuurtRow[]>();
    for (const key of CITY_KEYS) byCity.set(key, []);
    let unknownCity = 0;
    for (const row of allRowsFiltered) {
      const c = String(row.city).toLowerCase();
      if (isCityKey(c)) byCity.get(c)!.push(row);
      else unknownCity++;
    }
    if (unknownCity > 0) {
      console.warn(`[cdi] ${unknownCity} buurten have a city we don't recognise; skipping them`);
    }

    let processedTotal = 0;
    const perCitySummary: Record<
      CityKey,
      {
        n: number;
        boroughMatched: number;
        boroughMissing: number;
        cdiMin: number;
        cdiMax: number;
        cdiSum: number;
        risk: RiskCounts;
      }
    > = {
      amsterdam: emptySummary(),
      rotterdam: emptySummary(),
      denhaag: emptySummary(),
    };

    for (const city of CITY_KEYS) {
      const cityBuurten = byCity.get(city)!;
      if (cityBuurten.length === 0) {
        console.warn(`[cdi] no buurten for city=${city}; skipping`);
        continue;
      }
      const cityBoroughs = boroughsByCity.get(city)!;

      // Split low-signal (industrial / harbour / barely-inhabited) from the
      // rest. Only the residential subset participates in min-max stats; the
      // low-signal rows still get written, but with a neutral CDI=50 so they
      // don't poison the per-city distribution.
      const residential = cityBuurten.filter((b) => !isLowSignal(b));
      const lowSignalBuurten = cityBuurten.filter((b) => isLowSignal(b));
      console.log(
        `[cdi] processing city=${city}: buurten=${cityBuurten.length} (residential=${residential.length}, lowSignal=${lowSignalBuurten.length}), boroughs=${cityBoroughs.length}`,
      );

      // Compute per-city normalisation stats once, residential only.
      const inputsArr: CDIInputs[] = residential.map((b) => buurtToCdiInputs(b));
      const stats: CityStats = computeCityStats(inputsArr);

      let i = 0;
      for (const row of cityBuurten) {
        i++;
        processedTotal++;

        const lowSig = isLowSignal(row);
        let cdi: number;
        let score: number;
        let breakdown: Record<string, unknown>;

        if (lowSig) {
          // Neutral fallback: never run a low-signal buurt through the
          // normaliser. Force CDI=50, score=50, flag in breakdown so the
          // dashboard / tooltips can render a "no data" hint.
          cdi = 50;
          score = 50;
          breakdown = {
            cdi: 50,
            V: 50,
            A: 50,
            S: 50,
            components: { E: 50, H: 50, PT: 50, W: 50, D: 50, R: 50 },
            risk: "moderate",
            color: "yellow",
            note: "low_signal",
          };
        } else {
          const inputs = buurtToCdiInputs(row);
          const fullBreakdown = computeCDIBreakdown(inputs, stats);
          cdi = fullBreakdown.cdi;
          score = Math.max(0, Math.min(100, Math.round(100 - cdi)));
          breakdown = fullBreakdown as unknown as Record<string, unknown>;
        }

        const borough = findBorough(Number(row.centroidLng), Number(row.centroidLat), cityBoroughs);

        await db
          .update(neighbourhoods)
          .set({
            score,
            cdi,
            cdiBreakdown: breakdown,
            borough,
          })
          .where(eq(neighbourhoods.id, row.id));

        const sum = perCitySummary[city];
        sum.n++;
        if (borough) sum.boroughMatched++;
        else sum.boroughMissing++;
        sum.cdiSum += cdi;
        if (cdi < sum.cdiMin) sum.cdiMin = cdi;
        if (cdi > sum.cdiMax) sum.cdiMax = cdi;
        const riskKey = (breakdown.risk ?? "moderate") as "low" | "moderate" | "high" | "severe";
        if (riskKey in sum.risk) sum.risk[riskKey]++;

        if (processedTotal % 100 === 0) {
          console.log(
            `[cdi] progress ${processedTotal}/${allRowsFiltered.length} (city ${city} ${i}/${cityBuurten.length}, latest ${row.buurtCode} cdi=${cdi.toFixed(1)} score=${score} borough=${borough ?? "null"}${lowSig ? " [lowSignal]" : ""})`,
          );
        }
      }

      const sum = perCitySummary[city];
      const avg = sum.n > 0 ? sum.cdiSum / sum.n : 0;
      console.log(
        `[cdi] city=${city} done: n=${sum.n} matched=${sum.boroughMatched} missing=${sum.boroughMissing} lowSignal=${lowSignalBuurten.length} cdi avg=${avg.toFixed(2)} min=${sum.cdiMin.toFixed(2)} max=${sum.cdiMax.toFixed(2)} risk=${JSON.stringify(sum.risk)}`,
      );
    }

    // Sample rows per city.
    console.log("[cdi] -------- samples (3 per city) --------");
    for (const city of CITY_KEYS) {
      const samples = await sql<
        {
          buurt_code: string;
          borough: string | null;
          score: number;
          cdi: number;
          cdi_breakdown: { V: number; A: number; S: number; risk: string } | null;
        }[]
      >`
        SELECT buurt_code, borough, score, cdi, cdi_breakdown
        FROM neighbourhoods
        WHERE city = ${city}
        ORDER BY cdi DESC
        LIMIT 3
      `;
      for (const r of samples) {
        const b = r.cdi_breakdown;
        const breakdownStr = b
          ? `V=${b.V.toFixed(1)} A=${b.A.toFixed(1)} S=${b.S.toFixed(1)} risk=${b.risk}`
          : "(no breakdown)";
        console.log(
          `[cdi] ${city.padEnd(10)} ${r.buurt_code} borough=${r.borough ?? "null"} score=${r.score} cdi=${Number(r.cdi).toFixed(2)} ${breakdownStr}`,
        );
      }
    }

    console.log("[cdi] -------- summary --------");
    for (const city of CITY_KEYS) {
      const sum = perCitySummary[city];
      const avg = sum.n > 0 ? sum.cdiSum / sum.n : 0;
      console.log(
        `[cdi] ${city.padEnd(10)} n=${sum.n} matched=${sum.boroughMatched} missing=${sum.boroughMissing} avgCDI=${avg.toFixed(2)} minCDI=${sum.cdiMin === Infinity ? "n/a" : sum.cdiMin.toFixed(2)} maxCDI=${sum.cdiMax === -Infinity ? "n/a" : sum.cdiMax.toFixed(2)} risk=${JSON.stringify(sum.risk)}`,
      );
    }
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[cdi] runtime: ${dt}s, processed: ${processedTotal}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function emptySummary() {
  return {
    n: 0,
    boroughMatched: 0,
    boroughMissing: 0,
    cdiMin: Infinity,
    cdiMax: -Infinity,
    cdiSum: 0,
    risk: { low: 0, moderate: 0, high: 0, severe: 0 } as RiskCounts,
  };
}

main().catch((e) => {
  console.error("[cdi] FATAL", e);
  process.exit(1);
});
