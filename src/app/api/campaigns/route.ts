import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns, clusterMessages } from "@/lib/db/schema";
import { makeLogger } from "@/lib/log";

const log = makeLogger("api:campaigns");

async function readJson<T>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const neighbourhood = req.nextUrl.searchParams.get("neighbourhood");
    const rows = neighbourhood
      ? await db
          .select()
          .from(campaigns)
          .where(eq(campaigns.neighbourhoodId, neighbourhood))
          .orderBy(desc(campaigns.createdAt))
      : await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
    return NextResponse.json({ campaigns: rows });
  } catch (err) {
    log.error("GET db error", err);
    return NextResponse.json({ campaigns: [] });
  }
}

export async function POST(req: NextRequest) {
  const body = await readJson<{
    neighbourhoodId: string;
    interventionId: string;
    shockText?: string;
    channels: string[];
    clusters: unknown[];
  }>(req);
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  const id = `cmp_${Date.now()}`;
  try {
    const [row] = await db
      .insert(campaigns)
      .values({
        id,
        neighbourhoodId: body.neighbourhoodId,
        interventionId: body.interventionId,
        shockText: body.shockText ?? null,
        channels: body.channels,
        clusters: body.clusters,
        status: "pending",
      })
      .returning();
    return NextResponse.json({ campaign: row });
  } catch (err) {
    log.error("POST db error", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const body = await readJson<{
    id: string;
    status: "approved" | "sent" | "completed";
    approvedBy?: string;
  }>(req);
  if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  try {
    const [row] = await db
      .update(campaigns)
      .set({
        status: body.status,
        approvedBy: body.approvedBy ?? null,
        sentAt: body.status === "sent" ? new Date() : null,
      })
      .where(eq(campaigns.id, body.id))
      .returning();
    if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (body.status === "approved") {
      try {
        const msgs = await db
          .select()
          .from(clusterMessages)
          .where(eq(clusterMessages.campaignId, body.id));
        await Promise.all(
          msgs.map((m) =>
            db
              .update(clusterMessages)
              .set({ approved: true })
              .where(eq(clusterMessages.id, m.id)),
          ),
        );
      } catch (err) {
        // Don't fail the whole approval if message-flag update partially fails.
        log.warn("approval: partial clusterMessages update failure", err);
      }
    }
    return NextResponse.json({ campaign: row });
  } catch (err) {
    log.error("PATCH db error", err);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
}
