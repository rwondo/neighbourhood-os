import "dotenv/config";
import postgres from "postgres";
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from "geojson";

// Reuse the same pattern as scripts/populate-centroids.ts: query PDOK's
// Wijken-en-Buurten 2023 WFS to get the real buurtnaam for each buurtcode,
// then UPDATE neighbourhoods.name. CBS table 85618NED only exposes
// Gemeentenaam_1 per row, so the seed had no good way to populate proper names.

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[names] DATABASE_URL missing in env");
  process.exit(1);
}
const sql = postgres(DATABASE_URL, { prepare: false, max: 4 });

const PDOK_WFS = "https://service.pdok.nl/cbs/wijkenbuurten/2023/wfs/v1_0";
const TYPE_NAMES = "wijkenbuurten:buurten";

const CITY_PREFIXES: { city: string; prefix: string; gemeenteName: string }[] = [
  { city: "rotterdam", prefix: "BU0599", gemeenteName: "Rotterdam" },
  { city: "amsterdam", prefix: "BU0363", gemeenteName: "Amsterdam" },
  { city: "denhaag", prefix: "BU0518", gemeenteName: "'s-Gravenhage" },
];

type BuurtProps = {
  buurtcode: string;
  buurtnaam?: string | null;
  gemeentenaam?: string | null;
  water?: string | null;
};

type BuurtFeature = Feature<Polygon | MultiPolygon, BuurtProps>;

function buildFilter(prefix: string): string {
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

function isPlaceholderName(name: string, gemeenteName: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (lower === gemeenteName.toLowerCase()) return true;
  // Common municipality-name aliases that signal "no proper buurt name"
  const aliases = new Set([
    "amsterdam",
    "rotterdam",
    "den haag",
    "'s-gravenhage",
    "s-gravenhage",
  ]);
  return aliases.has(lower);
}

async function main() {
  const t0 = Date.now();
  console.log("[names] starting; PDOK endpoint:", PDOK_WFS);

  // 1. Snapshot DB buurt_codes so we can detect which ones never got a real name.
  const dbRows = await sql<{ buurt_code: string; name: string }[]>`
    SELECT buurt_code, name FROM neighbourhoods
  `;
  const dbByCode = new Map<string, string>();
  for (const r of dbRows) dbByCode.set(r.buurt_code, r.name);
  console.log(`[names] DB has ${dbByCode.size} neighbourhoods`);

  // 2. Fetch features per city prefix from PDOK.
  let updated = 0;
  let skippedNoName = 0;
  let skippedPlaceholder = 0;
  let skippedNotInDb = 0;
  const updatedCodes = new Set<string>();
  const sampleNew: { code: string; name: string }[] = [];

  for (const { city, prefix, gemeenteName } of CITY_PREFIXES) {
    const features = await fetchAllForPrefix(prefix);
    console.log(`[names] ${city} (${prefix}): fetched ${features.length} features`);

    for (const f of features) {
      const code = f.properties?.buurtcode;
      const buurtnaam = f.properties?.buurtnaam;
      if (!code) continue;
      if (typeof buurtnaam !== "string" || !buurtnaam.trim()) {
        skippedNoName++;
        continue;
      }
      if (isPlaceholderName(buurtnaam, gemeenteName)) {
        skippedPlaceholder++;
        continue;
      }
      if (!dbByCode.has(code)) {
        skippedNotInDb++;
        continue;
      }
      const cleanName = buurtnaam.trim();
      const result = await sql`
        UPDATE neighbourhoods
        SET name = ${cleanName}, updated_at = now()
        WHERE buurt_code = ${code}
      `;
      if (result.count > 0) {
        updated++;
        updatedCodes.add(code);
        if (sampleNew.length < 8) sampleNew.push({ code, name: cleanName });
      }
    }
  }

  // 3. Identify buurten still missing a real name.
  const still = await sql<{ buurt_code: string; name: string; city: string }[]>`
    SELECT buurt_code, name, city FROM neighbourhoods
    WHERE name IN ('Amsterdam', 'Rotterdam', 'Den Haag', '''s-Gravenhage', 's-Gravenhage')
    ORDER BY city, buurt_code
  `;

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("[names] -------- summary --------");
  console.log(`[names] rows updated: ${updated}`);
  console.log(`[names] PDOK features skipped (empty buurtnaam): ${skippedNoName}`);
  console.log(`[names] PDOK features skipped (placeholder = gemeente): ${skippedPlaceholder}`);
  console.log(`[names] PDOK features skipped (not in DB): ${skippedNotInDb}`);
  console.log(`[names] DB buurten still showing gemeente as name: ${still.length}`);
  if (still.length > 0) {
    const sample = still.slice(0, 10).map((r) => `${r.buurt_code}=${r.name}`).join(", ");
    console.log(`[names]   sample: ${sample}${still.length > 10 ? " …" : ""}`);
  }
  console.log("[names] sample new names:");
  for (const s of sampleNew) console.log(`[names]   ${s.code} -> ${s.name}`);
  console.log(`[names] runtime: ${dt}s`);

  await sql.end({ timeout: 5 });
}

main().catch(async (e) => {
  console.error("[names] FATAL", e);
  try {
    await sql.end({ timeout: 5 });
  } catch {
    /* noop */
  }
  process.exit(1);
});
