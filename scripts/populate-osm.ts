/**
 * Fills the poi_* columns with OpenStreetMap counts within 500 m of each buurt
 * centroid (libraries, community centres, parks, benches, cafes, sports
 * centres, pedestrian crossings).
 *
 *   pnpm populate:osm
 *
 * One Overpass request per category per city (21 in total). If any request
 * fails after retries, the script aborts without writing, so a network hiccup
 * can never leave buurten with fake zero counts.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import {
  POI_CATEGORIES,
  countPOIsWithin,
  fetchCategoryPoints,
  type BBox,
  type CityPOIs,
  type POICounts,
} from "@/lib/osm";

const MIGRATION_PATH = path.resolve(process.cwd(), "drizzle/0003_poi_counts.sql");
// ~1 km of padding so buurten on the city edge still see everything within 500 m.
const BBOX_PADDING_DEG = 0.01;
const PAUSE_BETWEEN_REQUESTS_MS = 2_000;

// Rotterdam-Centrum: a sanity check that the counts are not all zero.
const SMOKE = { city: "rotterdam", lat: 51.9225, lng: 4.4792 };

type BuurtRow = {
  buurt_code: string;
  city: string;
  centroid_lng: number;
  centroid_lat: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function bboxFor(rows: BuurtRow[]): BBox {
  const lats = rows.map((r) => r.centroid_lat);
  const lngs = rows.map((r) => r.centroid_lng);
  return {
    south: Math.min(...lats) - BBOX_PADDING_DEG,
    west: Math.min(...lngs) - BBOX_PADDING_DEG,
    north: Math.max(...lats) + BBOX_PADDING_DEG,
    east: Math.max(...lngs) + BBOX_PADDING_DEG,
  };
}

async function fetchCity(city: string, bbox: BBox): Promise<CityPOIs> {
  const pois = {} as CityPOIs;
  for (const category of POI_CATEGORIES) {
    pois[category] = await fetchCategoryPoints(category, bbox);
    console.log(`[osm] ${city}: ${pois[category].length} ${category}`);
    await sleep(PAUSE_BETWEEN_REQUESTS_MS);
  }
  return pois;
}

async function updateBuurt(sql: postgres.Sql, buurtCode: string, c: POICounts): Promise<void> {
  await sql`
    UPDATE neighbourhoods
    SET
      poi_libraries = ${c.libraries},
      poi_community_centres = ${c.community_centres},
      poi_parks = ${c.parks},
      poi_benches = ${c.benches},
      poi_cafes = ${c.cafes},
      poi_sports = ${c.sports},
      poi_intersections = ${c.intersections}
    WHERE buurt_code = ${buurtCode}
  `;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { prepare: false, max: 3 });

  try {
    await sql.unsafe(readFileSync(MIGRATION_PATH, "utf8"));

    const rows = (await sql<BuurtRow[]>`
      SELECT buurt_code, city, centroid_lng, centroid_lat
      FROM neighbourhoods
      WHERE centroid_lng <> 0 AND centroid_lat <> 0
    `) as unknown as BuurtRow[];
    if (rows.length === 0) {
      console.warn("[osm] no centroids yet; run `pnpm populate:centroids` first.");
      return;
    }

    const cities = [...new Set(rows.map((r) => r.city))].sort(
      (a, b) => Number(b === SMOKE.city) - Number(a === SMOKE.city),
    );
    const poisByCity = new Map<string, CityPOIs>();
    for (const city of cities) {
      const cityRows = rows.filter((r) => r.city === city);
      poisByCity.set(city, await fetchCity(city, bboxFor(cityRows)));

      if (city === SMOKE.city) {
        const smoke = countPOIsWithin(poisByCity.get(city)!, SMOKE.lat, SMOKE.lng);
        console.log("[osm] smoke test (Rotterdam-Centrum):", JSON.stringify(smoke));
        if (Object.values(smoke).every((v) => v === 0)) {
          throw new Error("smoke test returned all zeros; refusing to write counts");
        }
      }
    }

    // All fetches succeeded; only now write anything.
    for (const row of rows) {
      const counts = countPOIsWithin(poisByCity.get(row.city)!, row.centroid_lat, row.centroid_lng);
      await updateBuurt(sql, row.buurt_code, counts);
    }
    console.log(`[osm] done: updated ${rows.length} buurten`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error("[osm] fatal:", e);
  process.exit(1);
});
