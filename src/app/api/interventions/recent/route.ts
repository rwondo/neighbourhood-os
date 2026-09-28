import { NextRequest, NextResponse } from "next/server";
import { parseCity, queryRecentInterventions } from "@/lib/data/boroughs";
import { snapshotRecentInterventions } from "@/lib/data/static-snapshot";
import { makeLogger } from "@/lib/log";
import { isStaticMode } from "@/lib/runtime-mode";
import type { RecentInterventionRecord } from "@/lib/types";

const log = makeLogger("api:interventions/recent");

export async function GET(req: NextRequest) {
  const city = parseCity(req.nextUrl.searchParams.get("city"));
  if (!city) {
    return NextResponse.json({ error: "invalid_city" }, { status: 400 });
  }

  if (isStaticMode()) {
    return NextResponse.json({ interventions: snapshotRecentInterventions(city) });
  }

  try {
    return NextResponse.json({ interventions: await queryRecentInterventions(city) });
  } catch (err) {
    log.warn("query failed", { err: err instanceof Error ? err.message : err });
    return NextResponse.json({ interventions: [] satisfies RecentInterventionRecord[] });
  }
}
