import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { ensureGtfsStops, countStopsWithin } from "@/lib/gtfs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[transit] DATABASE_URL is not set");
  process.exit(1);
}

const MIGRATION_FILE = path.resolve(process.cwd(), "drizzle/0004_transit.sql");

async function applyMigration(sql: postgres.Sql): Promise<void> {
  const ddl = await fs.readFile(MIGRATION_FILE, "utf8");
  console.log(`[transit] applying migration ${path.basename(MIGRATION_FILE)}`);
  await sql.unsafe(ddl);
  console.log(`[transit] migration applied`);
}

type BuurtRow = { buurt_code: string; centroid_lng: number; centroid_lat: number };

async function main(): Promise<void> {
  const sql = postgres(DATABASE_URL!, { prepare: false, max: 5 });
  try {
    await applyMigration(sql);

    const stops = await ensureGtfsStops();
    console.log(`[transit] ${stops.length} NL-bbox stops ready`);

    // Smoke test: Rotterdam-Centrum
    const ROTTERDAM_CENTRUM = { lat: 51.9225, lng: 4.4792 };
    const smoke = countStopsWithin(stops, ROTTERDAM_CENTRUM.lat, ROTTERDAM_CENTRUM.lng, 500);
    console.log(`[transit] smoke test: stops within 500m of Rotterdam-Centrum = ${smoke}`);
    if (smoke <= 0) {
      console.warn(`[transit] WARN: expected > 0 stops near Rotterdam-Centrum but got ${smoke}`);
    }

    const rows = await sql<BuurtRow[]>`
      SELECT buurt_code, centroid_lng, centroid_lat
      FROM neighbourhoods
      WHERE centroid_lng != 0 AND centroid_lat != 0
    `;
    if (rows.length === 0) {
      console.warn("[transit] centroids not populated yet; run pnpm populate:centroids first");
      return;
    }
    console.log(`[transit] updating transit_stops_500m for ${rows.length} buurten`);

    let i = 0;
    let nonZero = 0;
    for (const row of rows) {
      const lat = Number(row.centroid_lat);
      const lng = Number(row.centroid_lng);
      const count = countStopsWithin(stops, lat, lng, 500);
      if (count > 0) nonZero++;
      await sql`
        UPDATE neighbourhoods
        SET transit_stops_500m = ${count}
        WHERE buurt_code = ${row.buurt_code}
      `;
      i++;
      if (i % 100 === 0 || i === rows.length) {
        console.log(`[transit] ${i}/${rows.length} (latest ${row.buurt_code}=${count}, non-zero so far=${nonZero})`);
      }
    }
    console.log(`[transit] done. updated=${i}, with stops=${nonZero}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
