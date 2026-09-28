/**
 * Dumps the most-recent intervention for a borough+city out of the DB into a
 * TypeScript demo snapshot. Use this AFTER you've run a live orchestrator
 * pass on a borough, to freeze that exact output for the pitch.
 *
 *   pnpm tsx scripts/export-demo-snapshot.ts <Borough> <city>
 *
 * Example:
 *   pnpm tsx scripts/export-demo-snapshot.ts Noord amsterdam
 *
 * Writes to: src/lib/demo-data/<borough-slug>.snapshot.json
 *
 * You then either:
 *   (a) hand-edit src/lib/demo-data/<borough>.ts to paste the new data, or
 *   (b) import the .snapshot.json file directly in a new TS module.
 *
 * NOTE: This export captures the strategy + cluster messages + trace steps. It
 * does NOT capture creative URLs or MCP campaign IDs (those live only in the
 * browser response from /api/activities/approve). Edit the approval section
 * of your TS snapshot manually after running this.
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { agentRuns, clusterMessages, interventions, neighbourhoods } from "@/lib/db/schema";

async function main() {
  const [borough, city] = process.argv.slice(2);
  if (!borough || !city) {
    console.error("usage: pnpm tsx scripts/export-demo-snapshot.ts <Borough> <city>");
    process.exit(1);
  }
  if (!["rotterdam", "amsterdam", "denhaag"].includes(city)) {
    console.error(`city must be one of: rotterdam, amsterdam, denhaag — got "${city}"`);
    process.exit(1);
  }

  // Find the worst-CDI buurt in the borough — same selector the simulate
  // route uses — then grab its most-recent intervention.
  const buurtRows = await getDb()
    .select()
    .from(neighbourhoods)
    .where(and(eq(neighbourhoods.city, city), sql`${neighbourhoods.borough} = ${borough}`))
    .orderBy(sql`${neighbourhoods.cdi} DESC NULLS LAST`)
    .limit(1);
  const buurt = buurtRows[0];
  if (!buurt) {
    console.error(`no buurten found for borough="${borough}" city="${city}"`);
    process.exit(1);
  }

  const [intervention] = await getDb()
    .select()
    .from(interventions)
    .where(eq(interventions.neighbourhoodId, buurt.id))
    .orderBy(desc(interventions.createdAt))
    .limit(1);
  if (!intervention) {
    console.error(`no interventions found for buurt id=${buurt.id} (${buurt.name})`);
    process.exit(1);
  }

  const messages = await getDb()
    .select()
    .from(clusterMessages)
    .where(eq(clusterMessages.interventionId, intervention.id));

  const [run] = await getDb()
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.interventionId, intervention.id))
    .orderBy(desc(agentRuns.createdAt))
    .limit(1);

  const snapshot = {
    borough,
    city,
    buurt: {
      id: buurt.id,
      name: buurt.name,
      buurtCode: buurt.buurtCode,
    },
    strategy: intervention.strategy,
    messages: messages.map((m) => ({
      clusterId: m.clusterId,
      channel: m.channel,
      language: m.language,
      tone: m.tone,
      message: m.message,
      pdfUrl: m.pdfUrl,
    })),
    traceSteps: run?.steps ?? null,
    totalMs: run?.totalMs ?? null,
    capturedAt: new Date().toISOString(),
  };

  const slug = borough
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const outDir = join(process.cwd(), "src", "lib", "demo-data");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${slug}.snapshot.json`);
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2));

  console.log(`exported snapshot for ${borough} (${city}) →`);
  console.log(`  ${outPath}`);
  console.log(`  buurt: ${buurt.name} (${buurt.buurtCode})`);
  console.log(
    `  strategy: ${(snapshot.strategy as { activities?: unknown[] })?.activities?.length ?? 0} activities`,
  );
  console.log(`  messages: ${messages.length}`);
  console.log(`  traceSteps: ${Array.isArray(run?.steps) ? run.steps.length : 0}`);
  console.log("");
  console.log(
    "Next: hand-edit src/lib/demo-data/<borough>.ts to paste these values into the TS snapshot.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
