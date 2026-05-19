import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { campaigns, clusterMessages, neighbourhoods } from "@/lib/db/schema";
import { routeMessage } from "@/lib/channels";
import { makeLogger } from "@/lib/log";
import type { ClusterMessage } from "@/lib/types";

const log = makeLogger("api:channels/dispatch");

export async function POST(req: NextRequest) {
  let payload: { campaignId?: string };
  try {
    payload = (await req.json()) as { campaignId?: string };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const campaignId = payload.campaignId;
  if (!campaignId) return NextResponse.json({ error: "missing_campaignId" }, { status: 400 });

  try {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId));
    if (!campaign) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (campaign.status !== "approved") {
      return NextResponse.json(
        { error: "not_approved", status: campaign.status },
        { status: 400 },
      );
    }
    const [n] = await db.select().from(neighbourhoods).where(eq(neighbourhoods.id, campaign.neighbourhoodId));
    const messages = await db
      .select()
      .from(clusterMessages)
      .where(eq(clusterMessages.campaignId, campaignId));
    const postcode = (n?.buurtCode ?? "0000").slice(2, 6);

    // Catch per-message so a single channel failure can't kill the whole dispatch
    // and leave the campaign stuck on "approved" forever.
    const results = await Promise.all(
      messages.map(async (m) => {
        try {
          return await routeMessage(
            {
              clusterId: m.clusterId,
              channel: m.channel as ClusterMessage["channel"],
              language: m.language,
              tone: m.tone ?? "",
              message: m.message,
              pdfUrl: m.pdfUrl ?? undefined,
            },
            { postcode, status: "approved" },
          );
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          log.warn("routeMessage failed", { clusterId: m.clusterId, channel: m.channel, reason });
          return { delivered: false, reason };
        }
      }),
    );

    try {
      await db
        .update(campaigns)
        .set({ status: "sent", sentAt: new Date() })
        .where(eq(campaigns.id, campaignId));
    } catch (err) {
      log.warn("status→sent update failed", err);
    }
    return NextResponse.json({ results });
  } catch (err) {
    log.error("dispatch error", err);
    return NextResponse.json({ error: "dispatch_error" }, { status: 500 });
  }
}
