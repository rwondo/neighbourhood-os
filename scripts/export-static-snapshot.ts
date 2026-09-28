/**
 * Freezes the dashboard's read APIs into src/lib/data/static-snapshot.json so
 * the app can run without a database (static snapshot mode).
 *
 *   pnpm export:snapshot
 *
 * Run it after the data pipeline (see README). It calls the same query
 * functions the API routes use, validates the result against the borough
 * shapes on the map, and refuses to write an incomplete snapshot.
 */
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CITY_KEYS, queryCitySnapshot } from "@/lib/data/boroughs";
import { validateSnapshot } from "@/lib/data/validate-snapshot";
import type { CityKey, CitySnapshot, StaticSnapshot } from "@/lib/types";

const OUT_FILE = path.resolve(process.cwd(), "src/lib/data/static-snapshot.json");
const BOROUGHS_FILE = path.resolve(process.cwd(), "public/boroughs.geojson");

async function main() {
  const cities = {} as Record<CityKey, CitySnapshot>;
  for (const city of CITY_KEYS) {
    cities[city] = await queryCitySnapshot(city);
    console.log(
      `[snapshot] ${city}: ${cities[city].boroughs.length} boroughs, ` +
        `${cities[city].recentInterventions.length} recent interventions`,
    );
  }

  const snapshot: StaticSnapshot = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sources: [
      "CBS Kerncijfers wijken en buurten 2023 (table 85618NED)",
      "PDOK wijken en buurten 2023",
      "OpenStreetMap via Overpass API",
      "OVapi GTFS (gtfs-nl)",
      "Open-Meteo",
    ],
    cities,
  };

  const problems = validateSnapshot(snapshot, JSON.parse(readFileSync(BOROUGHS_FILE, "utf-8")));
  if (problems.length > 0) {
    console.error(`[snapshot] refusing to write, ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  writeFileSync(OUT_FILE, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`[snapshot] wrote ${path.relative(process.cwd(), OUT_FILE)}`);
  process.exit(0); // the postgres pool would otherwise keep the process alive
}

main().catch((err) => {
  console.error("[snapshot] failed:", err);
  process.exit(1);
});
