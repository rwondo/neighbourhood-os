import "dotenv/config";
import postgres from "postgres";
import { fetchCbsBuurten, GEMEENTE_CODES } from "@/lib/cbs";

// Refresh demographic columns + raw jsonb on the existing neighbourhoods rows
// using the (now-fixed) fetchCbsBuurten. We do NOT re-run the full seed; that
// would overwrite POI / transit / centroid work and is slow. We only touch the
// four demographic columns + raw, leaving everything else intact.

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[demo] DATABASE_URL missing in env");
  process.exit(1);
}
const sql = postgres(DATABASE_URL, { prepare: false, max: 4 });

// pct_living_alone / pct_elderly_65 are NOT NULL in the schema, so we write 0
// when the buurt is low-signal. The authoritative low-signal flag lives in
// raw.lowSignal, which the CDI recomputer reads to decide what to skip in
// city stats and to override the per-buurt CDI to a neutral 50.
function safeNum(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

async function main() {
  const t0 = Date.now();

  console.log("[demo] fetching CBS rows…");
  const rows = await fetchCbsBuurten(Object.values(GEMEENTE_CODES));
  console.log(`[demo] CBS returned ${rows.length} buurten`);

  // Snapshot DB so we can detect codes that exist in CBS but not the DB and
  // vice versa (mostly water buurten omitted by populate-centroids).
  const dbRows = await sql<{ buurt_code: string }[]>`
    SELECT buurt_code FROM neighbourhoods
  `;
  const dbCodes = new Set(dbRows.map((r) => r.buurt_code));
  console.log(`[demo] DB has ${dbCodes.size} neighbourhoods`);

  let updated = 0;
  let skippedNotInDb = 0;
  let lowSignal = 0;
  const lowSignalSamples: { code: string; res: number; hh: number }[] = [];

  for (const r of rows) {
    if (!dbCodes.has(r.buurtCode)) {
      skippedNotInDb++;
      continue;
    }
    if (r.lowSignal) {
      lowSignal++;
      if (lowSignalSamples.length < 8) {
        lowSignalSamples.push({
          code: r.buurtCode,
          res: r.totalResidents,
          hh: r.totalHouseholds,
        });
      }
    }

    const pctLivingAlone = safeNum(r.pctLivingAlone);
    const pctElderly65 = safeNum(r.pctElderly65);
    const lowIncomeIndex = safeNum(r.lowIncomeIndex);
    const amenityDistanceKm = safeNum(r.amenityDistanceKm);

    // We store the full mapper output in raw so downstream code can inspect
    // lowSignal / totalResidents / totalHouseholds. JSON cannot represent NaN
    // natively, so replace any NaN with null before serialising.
    const rawJson = {
      buurtCode: r.buurtCode,
      name: r.name,
      gemeenteCode: r.gemeenteCode,
      pctLivingAlone: Number.isFinite(r.pctLivingAlone) ? r.pctLivingAlone : null,
      pctElderly65: Number.isFinite(r.pctElderly65) ? r.pctElderly65 : null,
      pctSingleParent: r.pctSingleParent,
      lowIncomeIndex: r.lowIncomeIndex,
      amenityDistanceKm: r.amenityDistanceKm,
      populationTurnover: r.populationTurnover,
      totalResidents: r.totalResidents,
      totalHouseholds: r.totalHouseholds,
      lowSignal: r.lowSignal,
    };

    const result = await sql`
      UPDATE neighbourhoods
      SET pct_living_alone = ${pctLivingAlone},
          pct_elderly_65 = ${pctElderly65},
          low_income_index = ${lowIncomeIndex},
          amenity_distance_km = ${amenityDistanceKm},
          raw = ${sql.json(rawJson)},
          updated_at = now()
      WHERE buurt_code = ${r.buurtCode}
    `;
    if (result.count > 0) updated++;

    if (updated > 0 && updated % 100 === 0) {
      console.log(`[demo] progress ${updated}/${rows.length} (latest ${r.buurtCode})`);
    }
  }

  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log("[demo] -------- summary --------");
  console.log(`[demo] rows updated: ${updated}`);
  console.log(`[demo] CBS codes not in DB: ${skippedNotInDb}`);
  console.log(`[demo] low-signal buurten flagged: ${lowSignal}`);
  if (lowSignalSamples.length > 0) {
    console.log("[demo] sample low-signal:");
    for (const s of lowSignalSamples) {
      console.log(`[demo]   ${s.code} residents=${s.res} households=${s.hh}`);
    }
  }
  console.log(`[demo] runtime: ${dt}s`);

  await sql.end({ timeout: 5 });
}

main().catch(async (e) => {
  console.error("[demo] FATAL", e);
  try {
    await sql.end({ timeout: 5 });
  } catch {
    /* noop */
  }
  process.exit(1);
});
