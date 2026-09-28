import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { fetchPOICountsForBuurt, type POICounts } from "@/lib/osm";

const MIGRATION_PATH = path.resolve(process.cwd(), "drizzle/0003_poi_counts.sql");
const SLEEP_BETWEEN_BUURTEN_MS = 1_000;
const LOG_EVERY = 25;

// Rotterdam-Centrum smoke-test centroid.
const SMOKE_LAT = 51.9225;
const SMOKE_LNG = 4.4792;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type BuurtRow = {
  buurt_code: string;
  centroid_lng: number;
  centroid_lat: number;
};

async function applyMigration(sql: postgres.Sql): Promise<void> {
  const ddl = readFileSync(MIGRATION_PATH, "utf8");
  console.log("[osm] applying migration drizzle/0003_poi_counts.sql");
  await sql.unsafe(ddl);
  console.log("[osm] migration applied");
}

async function runSmokeTest(): Promise<boolean> {
  console.log(`[osm] smoke test: Rotterdam-Centrum (lat=${SMOKE_LAT}, lng=${SMOKE_LNG})`);
  try {
    const counts = await fetchPOICountsForBuurt(SMOKE_LAT, SMOKE_LNG);
    console.log("[osm] smoke result:", JSON.stringify(counts));
    const total =
      counts.libraries +
      counts.community_centres +
      counts.parks +
      counts.benches +
      counts.cafes +
      counts.sports +
      counts.intersections;
    if (total === 0) {
      console.error("[osm] smoke test returned all zeros — aborting (likely client bug)");
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[osm] smoke test failed: ${(err as Error).message}`);
    return false;
  }
}

async function updateBuurt(sql: postgres.Sql, buurtCode: string, counts: POICounts): Promise<void> {
  await sql`
    UPDATE neighbourhoods
    SET
      poi_libraries = ${counts.libraries},
      poi_community_centres = ${counts.community_centres},
      poi_parks = ${counts.parks},
      poi_benches = ${counts.benches},
      poi_cafes = ${counts.cafes},
      poi_sports = ${counts.sports},
      poi_intersections = ${counts.intersections}
    WHERE buurt_code = ${buurtCode}
  `;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const sql = postgres(url, { prepare: false, max: 3 });

  try {
    await applyMigration(sql);

    const smokeOk = await runSmokeTest();
    if (!smokeOk) {
      console.error("[osm] aborting before full run due to smoke-test failure");
      process.exit(1);
    }

    const rows = (await sql<BuurtRow[]>`
      SELECT buurt_code, centroid_lng, centroid_lat
      FROM neighbourhoods
      WHERE centroid_lng <> 0 AND centroid_lat <> 0
    `) as unknown as BuurtRow[];

    if (rows.length === 0) {
      console.warn(
        "[osm] centroids not populated yet; run `pnpm populate:centroids` first. Migration applied; exiting cleanly.",
      );
      return;
    }

    console.log(`[osm] populating POI counts for ${rows.length} buurten`);
    let i = 0;
    let errors = 0;
    for (const row of rows) {
      i++;
      try {
        const counts = await fetchPOICountsForBuurt(row.centroid_lat, row.centroid_lng);
        await updateBuurt(sql, row.buurt_code, counts);
        if (i % LOG_EVERY === 0 || i === rows.length) {
          console.log(
            `[osm] ${i}/${rows.length} latest=${row.buurt_code} libraries=${counts.libraries} cafes=${counts.cafes} parks=${counts.parks} benches=${counts.benches} sports=${counts.sports} community=${counts.community_centres} crossings=${counts.intersections}`,
          );
        }
      } catch (err) {
        errors++;
        console.warn(`[osm] ${row.buurt_code} failed: ${(err as Error).message}`);
      }
      if (i < rows.length) {
        await sleep(SLEEP_BETWEEN_BUURTEN_MS);
      }
    }
    console.log(`[osm] done — ${i - errors}/${rows.length} populated, ${errors} errors`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
