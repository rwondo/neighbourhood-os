import { NextRequest, NextResponse } from "next/server";
import { parseCity, queryBoroughAggregates } from "@/lib/data/boroughs";
import { SNAPSHOT_CACHE_HEADERS, snapshotBoroughs } from "@/lib/data/static-snapshot";
import { makeLogger } from "@/lib/log";
import { isStaticMode } from "@/lib/runtime-mode";
import type { BoroughAggregate } from "@/lib/types";

const log = makeLogger("api:boroughs");

export async function GET(req: NextRequest) {
  const city = parseCity(req.nextUrl.searchParams.get("city"));
  if (!city) {
    return NextResponse.json(
      {
        error:
          "Missing or invalid 'city' query parameter. Must be one of: rotterdam, amsterdam, denhaag.",
      },
      { status: 400 },
    );
  }

  if (isStaticMode()) {
    return NextResponse.json(
      { boroughs: snapshotBoroughs(city) },
      { headers: SNAPSHOT_CACHE_HEADERS },
    );
  }

  try {
    return NextResponse.json({ boroughs: await queryBoroughAggregates(city) });
  } catch (err) {
    log.warn("aggregate query failed; returning empty list", {
      err: err instanceof Error ? err.message : err,
    });
    return NextResponse.json({ boroughs: [] satisfies BoroughAggregate[] });
  }
}
