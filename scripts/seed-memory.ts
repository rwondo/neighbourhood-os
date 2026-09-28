/**
 * Seed neighbourhood memory for the buurten the demo will actually touch.
 *
 * Usage:
 *   pnpm tsx scripts/seed-memory.ts                       # seed worst-CDI buurt per borough across all 3 cities
 *   pnpm tsx scripts/seed-memory.ts BU05991703 BU03630000 # seed specific buurt codes
 *
 * The full `pnpm seed` script also writes memory rows, but only when
 * SEED_MEMORY=1 is exported AND it does so for all ~10k buurten, which
 * takes a long time. This script seeds only the ones the demo flow lands on.
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { neighbourhoods } from "@/lib/db/schema";
import { seedNeighbourhoodProfile, writeOutcome } from "@/lib/memory";

type Row = typeof neighbourhoods.$inferSelect;

function profileMarkdown(row: {
  name: string;
  buurtCode: string;
  city: string;
  borough: string | null;
  score: number;
  pctLivingAlone: number;
  pctElderly65: number;
  pctSingleParent: number;
  lowIncomeIndex: number;
}): string {
  return [
    `# ${row.name} (${row.buurtCode})`,
    ``,
    `City: ${row.city}`,
    `Borough: ${row.borough ?? "(none)"}`,
    `Current social fabric score: **${row.score}**`,
    ``,
    `## Demographics`,
    `- Living alone: ${row.pctLivingAlone.toFixed(1)}%`,
    `- 65+: ${row.pctElderly65.toFixed(1)}%`,
    `- Single parent: ${row.pctSingleParent.toFixed(1)}%`,
    `- Low income index: ${row.lowIncomeIndex.toFixed(1)}`,
    ``,
    `## Risk factors`,
    `- High share of living-alone households drives weak weak-tie formation.`,
    `- Elderly residents disproportionately affected by amenity-distance friction.`,
    `- Population turnover erodes neighbour familiarity over a 12-month horizon.`,
    ``,
    `## Seasonal patterns`,
    `- Dec-Feb: highest isolation, especially among 65+ single households.`,
    `- Apr-Sep: weather offset; community gardens and outdoor walking groups perform best.`,
    ``,
    `## Channel performance (historical priors)`,
    `- Leaflet via municipal post run: ~22% awareness lift in elderly low-digital households.`,
    `- SMS: highest opt-in among low-income, working-age residents.`,
    `- Instagram + WhatsApp: dominant for international students / recent movers.`,
  ].join("\n");
}

const SYNTHETIC_OUTCOMES = [
  {
    activity: "Schaakmiddag",
    venue: "Wijkcentrum",
    cluster: "elderly_65plus",
    attendance: { invited: 120, attended: 38 },
    estimatedConnections: 9,
    scoreImpact: 3,
    notes: "Strong retention; 70% returned the following week.",
  },
  {
    activity: "Buurtkookworkshop",
    venue: "Bibliotheek",
    cluster: "mixed_adults",
    attendance: { invited: 80, attended: 21 },
    estimatedConnections: 6,
    scoreImpact: 2,
    notes: "Vegetarian framing improved uptake; multilingual hosts helpful.",
  },
];

async function pickBuurten(codes: string[]): Promise<Row[]> {
  if (codes.length > 0) {
    return getDb()
      .select()
      .from(neighbourhoods)
      .where(sql`${neighbourhoods.buurtCode} = ANY(${codes})`);
  }
  // Default: worst-CDI buurt per borough across all 3 cities.
  // Fetch sorted by CDI desc then group by borough in JS — keeps the result
  // typed (camelCase) instead of raw db.execute() which returns snake_case keys.
  const all = await getDb()
    .select()
    .from(neighbourhoods)
    .where(sql`${neighbourhoods.borough} IS NOT NULL AND ${neighbourhoods.borough} <> ''`)
    .orderBy(sql`${neighbourhoods.cdi} DESC NULLS LAST`);
  const seen = new Set<string>();
  const picked: Row[] = [];
  for (const r of all) {
    const borough = r.borough;
    if (!borough || seen.has(borough)) continue;
    seen.add(borough);
    picked.push(r);
  }
  return picked;
}

async function main() {
  const args = process.argv.slice(2);
  // Graph extraction is on by default — adds the third retrieval path
  // (vector + lexical + graph) and noticeably improves orchestrator context.
  // V4-Pro can take 15-71s per buurt, so set EXTRACT_GRAPH=0 to skip when
  // iterating quickly during development.
  const extractGraph = process.env.EXTRACT_GRAPH !== "0";
  const rows = await pickBuurten(args);
  if (rows.length === 0) {
    console.warn("[seed-memory] no buurten matched — did you run `pnpm seed` first to populate the neighbourhoods table?");
    return;
  }
  console.log(
    `[seed-memory] seeding ${rows.length} buurt container${rows.length === 1 ? "" : "s"} (graph extraction: ${extractGraph ? "on — set EXTRACT_GRAPH=0 to skip" : "off"})`,
  );

  for (const r of rows) {
    const buurtCode = r.buurtCode;
    const name = r.name;
    const borough = r.borough ?? undefined;
    try {
      const t0 = Date.now();
      await seedNeighbourhoodProfile(
        buurtCode,
        profileMarkdown({
          name,
          buurtCode,
          city: r.city,
          borough: r.borough,
          score: r.score,
          pctLivingAlone: r.pctLivingAlone,
          pctElderly65: r.pctElderly65,
          pctSingleParent: r.pctSingleParent,
          lowIncomeIndex: r.lowIncomeIndex,
        }),
        { city: r.city, name, borough },
        { extractGraph, borough, city: r.city },
      );
      for (const o of SYNTHETIC_OUTCOMES) {
        await writeOutcome(buurtCode, o, { extractGraph, borough, city: r.city });
      }
      const tag = borough ? `${name} → borough:${borough}` : name;
      console.log(`[seed-memory] ${buurtCode} (${tag}) ok in ${Date.now() - t0}ms`);
    } catch (err) {
      console.error(`[seed-memory] ${buurtCode} (${name}) failed:`, err instanceof Error ? err.message : err);
    }
  }
  console.log("[seed-memory] done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed-memory] fatal:", err);
    process.exit(1);
  });
