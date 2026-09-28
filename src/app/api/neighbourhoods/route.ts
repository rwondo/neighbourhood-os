import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { neighbourhoods } from "@/lib/db/schema";
import { makeLogger } from "@/lib/log";
import { isStaticMode, staticModeResponse } from "@/lib/runtime-mode";

const log = makeLogger("api:neighbourhoods");

export async function GET(req: NextRequest) {
  if (isStaticMode()) return staticModeResponse();
  const city = req.nextUrl.searchParams.get("city");
  try {
    const rows = city
      ? await getDb()
          .select()
          .from(neighbourhoods)
          .where(eq(neighbourhoods.city, city))
          .orderBy(desc(neighbourhoods.score))
      : await getDb().select().from(neighbourhoods).orderBy(desc(neighbourhoods.score));
    return NextResponse.json({ neighbourhoods: rows });
  } catch (err) {
    log.error("db error", err);
    // Degrade to an empty list so the map doesn't blank on a transient DB hiccup.
    return NextResponse.json({ neighbourhoods: [] });
  }
}
