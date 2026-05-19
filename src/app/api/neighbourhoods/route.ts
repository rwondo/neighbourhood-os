import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { neighbourhoods } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city");
  const rows = city
    ? await db.select().from(neighbourhoods).where(eq(neighbourhoods.city, city)).orderBy(desc(neighbourhoods.score))
    : await db.select().from(neighbourhoods).orderBy(desc(neighbourhoods.score));
  return NextResponse.json({ neighbourhoods: rows });
}
