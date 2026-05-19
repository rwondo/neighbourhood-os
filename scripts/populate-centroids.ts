import "dotenv/config";
import postgres from "postgres";
import centroid from "@turf/centroid";
import type { Feature, Geometry, Polygon, MultiPolygon, FeatureCollection } from "geojson";

// Use postgres-js directly (same pattern as src/lib/db/index.ts) so this script
// works standalone without depending on Drizzle's schema typing.
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[centroids] DATABASE_URL missing in env");
  process.exit(1);
}
const sql = postgres(DATABASE_URL, { prepare: false, max: 4 });

const PDOK_WFS = "https://service.pdok.nl/cbs/wijkenbuurten/2023/wfs/v1_0";
const TYPE_NAMES = "wijkenbuurten:buurten";

const CITY_PREFIXES: { city: string; prefix: string }[] = [
  { city: "rotterdam", prefix: "BU0599" },
  { city: "amsterdam", prefix: "BU0363" },
  { city: "denhaag", prefix: "BU0518" },
];

type BuurtProps = {
  buurtcode: string;
  buurtnaam?: string | null;
  gemeentecode?: string | null;
  water?: string | null;
};

type BuurtFeature = Feature<Polygon | MultiPolygon, BuurtProps>;

function buildFilter(prefix: string): string {
  // CQL-style XML filter on `buurtcode` property
  return [
    "<Filter>",
    '<PropertyIsLike wildCard="*" singleChar="." escapeChar="!">',
    "<PropertyName>buurtcode</PropertyName>",
    `<Literal>${prefix}*</Literal>`,
    "</PropertyIsLike>",
    "</Filter>",
  ].join("");
}

async function fetchAllForPrefix(prefix: string): Promise<BuurtFeature[]> {
  const PAGE = 500;
  let startIndex = 0;
  const all: BuurtFeature[] = [];
  // PDOK supports paging via startIndex + count
  while (true) {
    const params = new URLSearchParams({
      service: "WFS",
      version: "2.0.0",
      request: "GetFeature",
      typeNames: TYPE_NAMES,
      srsName: "EPSG:4326",
      outputFormat: "application/json",
      count: String(PAGE),
      startIndex: String(startIndex),
      filter: buildFilter(prefix),
    });
    const url = `${PDOK_WFS}?${params.toString()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`PDOK ${prefix} page ${startIndex} HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    const fc = (await res.json()) as FeatureCollection<Geometry, BuurtProps>;
    const features = (fc.features ?? []) as BuurtFeature[];
    if (features.length === 0) break;
    all.push(...features);
    if (features.length < PAGE) break;
    startIndex += PAGE;
  }
  return all;
}

function isPolygonOrMulti(g: Geometry): g is Polygon | MultiPolygon {
  return g.type === "Polygon" || g.type === "MultiPolygon";
}

async function main() {
  const t0 = Date.now();
  console.log("[centroids] starting; PDOK endpoint:", PDOK_WFS);

  // 1. Snapshot existing buurt_codes in DB so we can detect mismatches.
  const dbRows = await sql<{ buurt_code: string }[]>`
    SELECT buurt_code FROM neighbourhoods
  `;
  const dbCodes = new Set(dbRows.map((r) => r.buurt_code));
  console.log(`[centroids] DB has ${dbCodes.size} neighbourhoods`);

  // 2. Fetch features per prefix from PDOK WFS.
  const allFeatures: BuurtFeature[] = [];
  for (const { city, prefix } of CITY_PREFIXES) {
    const features = await fetchAllForPrefix(prefix);
    const land = features.filter((f) => (f.properties?.water ?? "").toUpperCase() !== "JA");
    const water = features.length - land.length;
    console.log(
      `[centroids] ${city} (${prefix}): fetched ${features.length} features (${land.length} land, ${water} water)`,
    );
    allFeatures.push(...land);
  }
  console.log(`[centroids] total land features: ${allFeatures.length}`);

  // 3. Compute centroids and UPDATE.
  let updated = 0;
  let missingInDb = 0;
  let badGeom = 0;
  let badCode = 0;
  const missingExamples: string[] = [];

  let i = 0;
  for (const f of allFeatures) {
    i++;
    const code = f.properties?.buurtcode;
    if (!code) {
      badCode++;
      continue;
    }
    if (!f.geometry || !isPolygonOrMulti(f.geometry)) {
      badGeom++;
      continue;
    }
    let lng: number;
    let lat: number;
    try {
      const c = centroid({ type: "Feature", geometry: f.geometry, properties: {} });
      const coords = c.geometry.coordinates;
      lng = coords[0];
      lat = coords[1];
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
        badGeom++;
        continue;
      }
    } catch (err) {
      badGeom++;
      console.warn(`[centroids] centroid failed for ${code}: ${(err as Error).message}`);
      continue;
    }

    if (!dbCodes.has(code)) {
      missingInDb++;
      if (missingExamples.length < 10) missingExamples.push(code);
      continue;
    }

    const result = await sql`
      UPDATE neighbourhoods
      SET centroid_lng = ${lng}, centroid_lat = ${lat}, updated_at = now()
      WHERE buurt_code = ${code}
    `;
    if (result.count > 0) updated++;

    if (i % 100 === 0) {
      console.log(`[centroids] progress ${i}/${allFeatures.length} updated=${updated}`);
    }
  }

  // 4. Verification query.
  const [{ count }] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM neighbourhoods
    WHERE centroid_lng != 0 AND centroid_lat != 0
  `;
  const [{ count: zeroCount }] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM neighbourhoods
    WHERE centroid_lng = 0 OR centroid_lat = 0
  `;
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  console.log("[centroids] -------- summary --------");
  console.log(`[centroids] features fetched: ${allFeatures.length}`);
  console.log(`[centroids] rows updated: ${updated}`);
  console.log(`[centroids] PDOK codes not in DB: ${missingInDb}${missingExamples.length ? ` (sample: ${missingExamples.join(", ")})` : ""}`);
  console.log(`[centroids] bad geometry: ${badGeom}, missing buurtcode: ${badCode}`);
  console.log(`[centroids] DB neighbourhoods with non-zero centroid: ${count}`);
  console.log(`[centroids] DB neighbourhoods still zero: ${zeroCount}`);
  console.log(`[centroids] runtime: ${dt}s`);

  await sql.end({ timeout: 5 });
}

main().catch(async (e) => {
  console.error("[centroids] FATAL", e);
  try {
    await sql.end({ timeout: 5 });
  } catch {
    /* noop */
  }
  process.exit(1);
});
