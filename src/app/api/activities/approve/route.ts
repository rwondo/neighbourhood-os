import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getDb } from "@/lib/db";
import { neighbourhoods } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { makeLogger } from "@/lib/log";
import { isStaticMode, staticModeResponse } from "@/lib/runtime-mode";
import { channelNeedsCreative, generateCreative } from "@/lib/agents/creative";
import { createMetaCampaign, createTikTokCampaign } from "@/lib/mcp/pipeboard";
import type {
  BuurtRecord,
  Channel,
  CityKey,
  CreativeStatus,
  MCPCampaignStatus,
  ResidentCluster,
} from "@/lib/types";

const log = makeLogger("api:activities/approve");

export const runtime = "nodejs";

type IncomingMessage = {
  clusterId: string;
  channel: Channel;
  message: string;
};

type ApprovePayload = {
  activity?: {
    name?: string;
    description?: string;
    venue?: string;
    whenISO?: string;
    source?: string;
    targetClusters?: string[];
  };
  borough?: string;
  city?: CityKey;
  clusters?: ResidentCluster[];
  messages?: IncomingMessage[];
};

export type CreativeDispatch = {
  clusterId: string;
  channel: Channel;
  creativeUrl: string | null;
  creativeStatus: CreativeStatus;
  qrCodeUrl: string | null;
  joinUrl: string | null;
};

export type MCPDispatchResult = {
  clusterId: string;
  channel: Channel;
  status: MCPCampaignStatus;
  campaignId: string;
  adsManagerUrl: string | null;
  fallback: boolean;
  reason?: string;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function resolveBuurt(borough: string, city: CityKey | undefined): Promise<BuurtRecord | null> {
  const cityFilter = city ? eq(neighbourhoods.city, city) : undefined;
  const boroughFilter = sql`${neighbourhoods.borough} = ${borough}`;
  const where = cityFilter ? and(cityFilter, boroughFilter) : boroughFilter;
  const rows = await getDb()
    .select()
    .from(neighbourhoods)
    .where(where)
    .orderBy(sql`${neighbourhoods.cdi} DESC NULLS LAST`)
    .limit(1);
  return (rows[0] as unknown as BuurtRecord) ?? null;
}

export async function POST(req: NextRequest) {
  if (isStaticMode()) return staticModeResponse();
  let payload: ApprovePayload = {};
  try {
    payload = (await req.json()) as ApprovePayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const activityName = payload.activity?.name ?? "unnamed activity";
  const dispatchId = `disp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const borough = payload.borough ?? "";
  const city = payload.city;
  log.info("activity approval received", {
    dispatchId,
    activity: activityName,
    borough,
    city,
    messageCount: payload.messages?.length ?? 0,
    clusterCount: payload.clusters?.length ?? 0,
  });

  const buurt = borough ? await resolveBuurt(borough, city).catch(() => null) : null;
  if (!buurt) {
    log.warn("approve: borough not resolved — creatives will use synthetic record", { borough, city });
  }

  const clustersById = new Map(
    (payload.clusters ?? []).map((c) => [c.id, c]),
  );
  const messages = payload.messages ?? [];

  const fallbackNeighbourhood: BuurtRecord =
    buurt ??
    ({
      id: "synthetic",
      city: (city ?? "rotterdam") as CityKey,
      buurtCode: "synthetic",
      name: borough || "neighbourhood",
      borough: borough || null,
      centroidLng: 0,
      centroidLat: 0,
      pctLivingAlone: 0,
      pctElderly65: 0,
      pctSingleParent: 0,
      lowIncomeIndex: 0,
      amenityDistanceKm: 0,
      populationTurnover: 0,
      weatherIsolation: 0,
      socialParticipationDrop: 0,
      score: 65,
      trend: "flat",
      updatedAt: new Date().toISOString(),
    } as BuurtRecord);

  const syntheticActivity = {
    name: activityName,
    description: payload.activity?.description ?? "",
    venue: payload.activity?.venue ?? "",
    whenISO: payload.activity?.whenISO ?? new Date(Date.now() + 86400000 * 3).toISOString(),
    source: payload.activity?.source,
    targetClusters: payload.activity?.targetClusters,
  };

  const slug = slugify(borough || fallbackNeighbourhood.name);

  // ── Generate creatives + QR codes in parallel ──────────────────────────
  const creativeJobs = messages.map(async (m): Promise<CreativeDispatch> => {
    const cluster = clustersById.get(m.clusterId);
    let creativeUrl: string | null = null;
    let creativeStatus: CreativeStatus = "pending";
    if (cluster && channelNeedsCreative(m.channel)) {
      try {
        const r = await generateCreative({
          cluster,
          activity: syntheticActivity,
          neighbourhood: fallbackNeighbourhood,
        });
        creativeUrl = r.url;
        creativeStatus = r.status;
      } catch (err) {
        log.warn("creative gen threw", {
          cluster: m.clusterId,
          channel: m.channel,
          err: err instanceof Error ? err.message : err,
        });
        creativeStatus = "fallback";
      }
    }

    let qrCodeUrl: string | null = null;
    let joinUrl: string | null = null;
    if (m.channel === "leaflet") {
      // Placeholder target: the prototype has no opt-in page yet.
      joinUrl = `https://example.org/join/${slug}-${m.clusterId.replace(/^cluster_/, "")}`;
      try {
        qrCodeUrl = await QRCode.toDataURL(joinUrl, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 256,
          color: { dark: "#0f172a", light: "#ffffff" },
        });
      } catch (err) {
        log.warn("QR generation failed", {
          cluster: m.clusterId,
          err: err instanceof Error ? err.message : err,
        });
      }
    }

    return {
      clusterId: m.clusterId,
      channel: m.channel,
      creativeUrl,
      creativeStatus,
      qrCodeUrl,
      joinUrl,
    };
  });

  const creatives = await Promise.all(creativeJobs);
  log.info("creatives ready", {
    dispatchId,
    total: creatives.length,
    withCreative: creatives.filter((c) => !!c.creativeUrl).length,
    withQR: creatives.filter((c) => !!c.qrCodeUrl).length,
  });

  // ── Fire MCP campaigns for Meta / TikTok clusters ──────────────────────
  const creativeByKey = new Map(
    creatives.map((c) => [`${c.clusterId}::${c.channel}`, c]),
  );

  const mcpJobs = messages
    .filter(
      (m) =>
        m.channel === "facebook" || m.channel === "instagram" || m.channel === "tiktok",
    )
    .map(async (m): Promise<MCPDispatchResult> => {
      const cluster = clustersById.get(m.clusterId);
      const cr = creativeByKey.get(`${m.clusterId}::${m.channel}`);
      if (!cluster) {
        return {
          clusterId: m.clusterId,
          channel: m.channel,
          status: "manual_fallback",
          campaignId: `unknown_${m.clusterId}`,
          adsManagerUrl: null,
          fallback: true,
          reason: "cluster not provided in payload",
        };
      }
      const baseName = `${borough || "Neighbourhood OS"} — ${activityName}`;
      if (m.channel === "tiktok") {
        const r = await createTikTokCampaign({
          name: `${baseName} (TT)`,
          cluster,
          creativeUrl: cr?.creativeUrl ?? null,
          adCopy: m.message,
          borough,
          city: city ?? "",
        });
        return {
          clusterId: m.clusterId,
          channel: m.channel,
          status: r.fallback ? "manual_fallback" : "live",
          campaignId: r.campaignId,
          adsManagerUrl: r.adsManagerUrl,
          fallback: r.fallback,
          reason: r.reason,
        };
      }
      const r = await createMetaCampaign({
        name: `${baseName} (${m.channel.toUpperCase()})`,
        cluster,
        creativeUrl: cr?.creativeUrl ?? null,
        adCopy: m.message,
        borough,
        city: city ?? "",
      });
      return {
        clusterId: m.clusterId,
        channel: m.channel,
        status: r.fallback ? "manual_fallback" : "live",
        campaignId: r.campaignId,
        adsManagerUrl: r.adsManagerUrl,
        fallback: r.fallback,
        reason: r.reason,
      };
    });

  const mcpResults = await Promise.all(mcpJobs);
  log.info("approval dispatch complete", {
    dispatchId,
    creatives: creatives.length,
    mcpTotal: mcpResults.length,
    mcpLive: mcpResults.filter((r) => r.status === "live").length,
    mcpFallback: mcpResults.filter((r) => r.fallback).length,
  });

  return NextResponse.json({
    ok: true,
    dispatchId,
    queuedAt: new Date().toISOString(),
    creatives,
    mcpResults,
  });
}
