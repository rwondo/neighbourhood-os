import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns, clusterMessages, neighbourhoods } from "@/lib/db/schema";
import { routeMessage } from "@/lib/channels";
import type { ClusterMessage } from "@/lib/types";

export async function POST(req: NextRequest) {
  const { campaignId } = (await req.json()) as { campaignId: string };
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
  if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (campaign.status !== "approved") {
    return NextResponse.json({ error: "not_approved", status: campaign.status }, { status: 400 });
  }
  const [n] = await db.select().from(neighbourhoods).where(eq(neighbourhoods.id, campaign.neighbourhoodId));
  const messages = await db.select().from(clusterMessages).where(eq(clusterMessages.campaignId, campaignId));
  const postcode = (n?.buurtCode ?? "0000").slice(2, 6);

  const results = await Promise.all(
    messages.map((m) =>
      routeMessage(
        {
          clusterId: m.clusterId,
          channel: m.channel as ClusterMessage["channel"],
          language: m.language,
          tone: m.tone ?? "",
          message: m.message,
          pdfUrl: m.pdfUrl ?? undefined,
        },
        { postcode, status: "approved" }
      )
    )
  );

  await db.update(campaigns).set({ status: "sent", sentAt: new Date() }).where(eq(campaigns.id, campaignId));
  return NextResponse.json({ results });
}
