import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { neighbourhoods } from "@/lib/db/schema";
import { makeLogger } from "@/lib/log";
import { isStaticMode, staticModeResponse } from "@/lib/runtime-mode";

const log = makeLogger("api:neighbourhoods/[id]");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (isStaticMode()) return staticModeResponse();
  const { id } = await params;
  try {
    const [row] = await getDb().select().from(neighbourhoods).where(eq(neighbourhoods.id, id));
    if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ neighbourhood: row });
  } catch (err) {
    log.error("db error", { id, err });
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
