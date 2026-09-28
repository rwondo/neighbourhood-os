import "dotenv/config";
import { getDb } from "@/lib/db";
import { neighbourhoods } from "@/lib/db/schema";
import { fetchCbsBuurten, GEMEENTE_CODES } from "@/lib/cbs";
import { fetchCityWeather } from "@/lib/weather";
import { computeSocialFabricScore } from "@/lib/score";
import { seedNeighbourhoodProfile } from "@/lib/memory";

const CITY_KEYS = ["rotterdam", "amsterdam", "denhaag"] as const;

function profileMarkdown(row: {
  name: string;
  buurtCode: string;
  score: number;
  pctLivingAlone: number;
  pctElderly65: number;
  pctSingleParent: number;
  lowIncomeIndex: number;
}): string {
  return [
    `# ${row.name} (${row.buurtCode})`,
    ``,
    `Social fabric score: **${row.score}**`,
    ``,
    `## Demographics`,
    `- Living alone: ${row.pctLivingAlone.toFixed(1)}%`,
    `- 65+: ${row.pctElderly65.toFixed(1)}%`,
    `- Single parent: ${row.pctSingleParent.toFixed(1)}%`,
    `- Low income index: ${row.lowIncomeIndex.toFixed(1)}`,
    ``,
    `## Risk factors`,
    `- Population turnover and amenity distance shape social opportunity`,
    `- Seasonal: winter increases isolation, summer offsets it`,
    ``,
    `## Seasonal patterns`,
    `- December–February: highest risk`,
    `- April–September: lowest risk`,
    ``,
    `## Historical interventions`,
    `- None yet recorded`,
  ].join("\n");
}

const SEED_MEMORY = process.env.SEED_MEMORY === "1";
const MEMORY_TIMEOUT_MS = 20_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rj) =>
      setTimeout(() => rj(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

async function main() {
  console.log("[seed] fetching CBS rows…");
  const rows = await fetchCbsBuurten(Object.values(GEMEENTE_CODES));
  console.log(`[seed] ${rows.length} buurten`);

  const weatherByCity: Record<string, number> = {};
  for (const c of CITY_KEYS) {
    console.log(`[seed] weather: fetching ${c}…`);
    const w = await fetchCityWeather(c);
    weatherByCity[c] = w.isolationPenalty;
    console.log(
      `[seed] weather: ${c} penalty=${w.isolationPenalty} minT=${w.minTempC} rain=${w.rainMmNext24h.toFixed(1)}mm`,
    );
  }

  console.log(
    `[seed] inserting ${rows.length} neighbourhoods (memory=${SEED_MEMORY ? "on" : "off"})…`,
  );
  let i = 0;
  for (const r of rows) {
    i++;
    const city = (Object.entries(GEMEENTE_CODES).find(([, code]) => code === r.gemeenteCode)?.[0] ??
      "rotterdam") as (typeof CITY_KEYS)[number];
    const score = computeSocialFabricScore({
      pctLivingAlone: r.pctLivingAlone,
      pctElderly65: r.pctElderly65,
      pctSingleParent: r.pctSingleParent,
      lowIncomeIndex: r.lowIncomeIndex,
      amenityDistanceKm: r.amenityDistanceKm,
      populationTurnover: r.populationTurnover,
      weatherIsolation: weatherByCity[city] ?? 0,
      socialParticipationDrop: 0,
    });

    await getDb()
      .insert(neighbourhoods)
      .values({
        id: r.buurtCode,
        city,
        buurtCode: r.buurtCode,
        name: r.name,
        centroidLng: r.centroidLng,
        centroidLat: r.centroidLat,
        pctLivingAlone: r.pctLivingAlone,
        pctElderly65: r.pctElderly65,
        pctSingleParent: r.pctSingleParent,
        lowIncomeIndex: r.lowIncomeIndex,
        amenityDistanceKm: r.amenityDistanceKm,
        populationTurnover: r.populationTurnover,
        weatherIsolation: weatherByCity[city] ?? 0,
        socialParticipationDrop: 0,
        score,
        trend: "flat",
        raw: r as unknown,
      })
      .onConflictDoUpdate({
        target: neighbourhoods.id,
        set: { score, updatedAt: new Date() },
      });

    if (i % 25 === 0 || i === rows.length) {
      console.log(`[seed] ${i}/${rows.length} latest=${r.buurtCode} ${city} score=${score}`);
    }

    if (SEED_MEMORY) {
      try {
        const t0 = Date.now();
        await withTimeout(
          seedNeighbourhoodProfile(r.buurtCode, profileMarkdown({ ...r, score }), {
            city,
            name: r.name,
          }),
          MEMORY_TIMEOUT_MS,
          `memory(${r.buurtCode})`,
        );
        console.log(`[seed]   memory ${r.buurtCode} ok in ${Date.now() - t0}ms`);
      } catch (e) {
        console.warn(`[seed]   memory ${r.buurtCode} failed: ${(e as Error).message}`);
      }
    }
  }
  console.log("[seed] done");
}

// Exit explicitly: the shared postgres pool would otherwise keep the process alive.
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
