import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { neighbourhoods } from "@/lib/db/schema";
import { makeLogger } from "@/lib/log";

const log = makeLogger("api:neighbourhoods");

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city");
  try {
    const rows = city
      ? await db
          .select()
          .from(neighbourhoods)
          .where(eq(neighbourhoods.city, city))
          .orderBy(desc(neighbourhoods.score))
      : await db.select().from(neighbourhoods).orderBy(desc(neighbourhoods.score));
    return NextResponse.json({ neighbourhoods: rows });
  } catch (err) {
    log.error("db error", err);
    // Degrade to an empty list so the map doesn't blank on a transient DB hiccup.
    return NextResponse.json({ neighbourhoods: [] });
  }
}
