import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { interventions, clusterMessages } from "@/lib/db/schema";
import { makeLogger } from "@/lib/log";
import { isStaticMode, staticModeResponse } from "@/lib/runtime-mode";

const log = makeLogger("api:intervention/[id]");

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (isStaticMode()) return staticModeResponse();
  const { id } = await params;
  try {
    const [row] = await getDb().select().from(interventions).where(eq(interventions.id, id));
    if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const messages = await getDb()
      .select()
      .from(clusterMessages)
      .where(eq(clusterMessages.interventionId, id));
    return NextResponse.json({ intervention: row, messages });
  } catch (err) {
    log.error("db error", { id, err });
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
