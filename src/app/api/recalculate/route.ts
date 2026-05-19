import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { neighbourhoods, scoreHistory } from "@/lib/db/schema";
import { fetchCityWeather } from "@/lib/weather";
import { compareTrend, computeSocialFabricScore } from "@/lib/score";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { city?: "rotterdam" | "amsterdam" | "denhaag" };
  const targets = body.city
    ? [body.city]
    : (["rotterdam", "amsterdam", "denhaag"] as const);
  const updated: { id: string; previous: number; current: number }[] = [];

  for (const city of targets) {
    const weather = await fetchCityWeather(city).catch(() => ({ isolationPenalty: 0 } as { isolationPenalty: number }));
    const rows = await db.select().from(neighbourhoods).where(eq(neighbourhoods.city, city));
    for (const r of rows) {
      const next = computeSocialFabricScore({
        pctLivingAlone: r.pctLivingAlone,
        pctElderly65: r.pctElderly65,
        pctSingleParent: r.pctSingleParent,
        lowIncomeIndex: r.lowIncomeIndex,
        amenityDistanceKm: r.amenityDistanceKm,
        populationTurnover: r.populationTurnover,
        weatherIsolation: weather.isolationPenalty,
        socialParticipationDrop: r.socialParticipationDrop,
      });
      const trend = compareTrend(r.score, next);
      await db.update(neighbourhoods).set({ score: next, trend, weatherIsolation: weather.isolationPenalty, updatedAt: new Date() }).where(eq(neighbourhoods.id, r.id));
      await db.insert(scoreHistory).values({
        id: `sh_${r.id}_${Date.now()}`,
        neighbourhoodId: r.id,
        score: next,
        weatherIsolation: weather.isolationPenalty,
      });
      if (Math.abs(next - r.score) >= 1) updated.push({ id: r.id, previous: r.score, current: next });
    }
  }
  return NextResponse.json({ updated });
}
