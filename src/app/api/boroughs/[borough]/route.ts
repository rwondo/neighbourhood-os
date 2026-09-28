import { NextRequest, NextResponse } from "next/server";
import { INDUSTRIAL_BOROUGHS, parseCity, queryBoroughDetail } from "@/lib/data/boroughs";
import { SNAPSHOT_CACHE_HEADERS, snapshotBoroughDetail } from "@/lib/data/static-snapshot";
import { isStaticMode } from "@/lib/runtime-mode";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ borough: string }> },
) {
  const city = parseCity(req.nextUrl.searchParams.get("city"));
  if (!city) {
    return NextResponse.json({ error: "Missing or invalid 'city' query parameter." }, { status: 400 });
  }
  const { borough: rawBorough } = await params;
  const borough = decodeURIComponent(rawBorough);

  if (INDUSTRIAL_BOROUGHS.has(borough)) {
    return NextResponse.json({ error: "industrial_borough", borough }, { status: 404 });
  }

  const detail = isStaticMode()
    ? snapshotBoroughDetail(city, borough)
    : await queryBoroughDetail(city, borough);
  if (!detail) {
    return NextResponse.json({ error: "borough_not_found" }, { status: 404 });
  }
  return NextResponse.json(detail, isStaticMode() ? { headers: SNAPSHOT_CACHE_HEADERS } : undefined);
}
