import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns, clusterMessages } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  const neighbourhood = req.nextUrl.searchParams.get("neighbourhood");
  const rows = neighbourhood
    ? await db.select().from(campaigns).where(eq(campaigns.neighbourhoodId, neighbourhood)).orderBy(desc(campaigns.createdAt))
    : await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  return NextResponse.json({ campaigns: rows });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { neighbourhoodId: string; interventionId: string; shockText?: string; channels: string[]; clusters: unknown[] };
  const id = `cmp_${Date.now()}`;
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
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as { id: string; status: "approved" | "sent" | "completed"; approvedBy?: string };
  const [row] = await db
    .update(campaigns)
    .set({ status: body.status, approvedBy: body.approvedBy ?? null, sentAt: body.status === "sent" ? new Date() : null })
    .where(eq(campaigns.id, body.id))
    .returning();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (body.status === "approved") {
    const msgs = await db.select().from(clusterMessages).where(eq(clusterMessages.campaignId, body.id));
    await Promise.all(msgs.map((m) => db.update(clusterMessages).set({ approved: true }).where(eq(clusterMessages.id, m.id))));
  }
  return NextResponse.json({ campaign: row });
}
