import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { makeLogger } from "@/lib/log";
import type { ResidentCluster } from "@/lib/types";

const log = makeLogger("mcp:pipeboard");

const META_URL = "https://mcp.pipeboard.co/meta-ads-mcp";
const TIKTOK_URL = "https://mcp.pipeboard.co/tiktok-ads-mcp";
const TIMEOUT_MS = 9000;

export type MCPCampaignResult = {
  ok: boolean;
  campaignId: string;
  adsManagerUrl: string | null;
  fallback: boolean;
  reason?: string;
};

type ToolCallContent = { type: string; text?: string; [k: string]: unknown };
type ToolCallResult = {
  isError?: boolean;
  content?: ToolCallContent[];
  [k: string]: unknown;
};

function token(): string {
  return process.env.PIPEBOARD_API_TOKEN ?? "";
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function connect(baseUrl: string): Promise<{ client: Client; close: () => Promise<void> }> {
  const url = new URL(`${baseUrl}?token=${encodeURIComponent(token())}`);
  const transport = new StreamableHTTPClientTransport(url);
  const client = new Client({ name: "neighbourhood-os", version: "0.1.0" }, { capabilities: {} });
  await client.connect(transport);
  return {
    client,
    close: async () => {
      try {
        await client.close();
      } catch {
        /* swallow */
      }
    },
  };
}

function extractJson(result: ToolCallResult): Record<string, unknown> | null {
  const first = result.content?.find((c) => c.type === "text" && typeof c.text === "string");
  if (!first?.text) return null;
  try {
    return JSON.parse(first.text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function pickString(obj: Record<string, unknown> | null, ...keys: string[]): string | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

function mockCampaignId(prefix: string): string {
  return `${prefix}_mock_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export type MetaCampaignArgs = {
  name: string;
  cluster: ResidentCluster;
  creativeUrl: string | null;
  adCopy: string;
  postcode?: string | null;
  borough: string;
  city: string;
  dailyBudgetEUR?: number;
};

export async function createMetaCampaign(args: MetaCampaignArgs): Promise<MCPCampaignResult> {
  const t = token();
  if (!t) {
    log.warn("PIPEBOARD_API_TOKEN missing — returning mock campaign");
    return {
      ok: false,
      campaignId: mockCampaignId("meta"),
      adsManagerUrl: null,
      fallback: true,
      reason: "PIPEBOARD_API_TOKEN not set",
    };
  }

  let close: (() => Promise<void>) | null = null;
  try {
    const conn = await withTimeout(connect(META_URL), TIMEOUT_MS, "meta.connect");
    close = conn.close;
    const tools = await withTimeout(conn.client.listTools(), TIMEOUT_MS, "meta.listTools");
    log.info("meta MCP tools", { count: tools.tools.length, names: tools.tools.map((t) => t.name) });

    const toolName =
      tools.tools.find((t) => /create.*campaign/i.test(t.name))?.name ??
      tools.tools.find((t) => /campaign/i.test(t.name))?.name ??
      "create_campaign";

    const params: Record<string, unknown> = {
      name: args.name,
      objective: "OUTCOME_AWARENESS",
      status: "PAUSED",
      daily_budget: Math.round((args.dailyBudgetEUR ?? 10) * 100),
      special_ad_categories: [],
      ad_set: {
        targeting: {
          geo_locations: {
            countries: ["NL"],
            location_types: ["home"],
          },
          age_min: args.cluster.ageRange[0],
          age_max: args.cluster.ageRange[1],
        },
        daily_budget: Math.round((args.dailyBudgetEUR ?? 10) * 100),
        geofence_radius_m: 500,
      },
      creative: {
        image_url: args.creativeUrl,
        primary_text: args.adCopy,
      },
      meta: { borough: args.borough, city: args.city },
    };

    const raw = (await withTimeout(
      conn.client.callTool({ name: toolName, arguments: params }),
      TIMEOUT_MS,
      "meta.createCampaign",
    )) as ToolCallResult;

    if (raw.isError) {
      throw new Error(`MCP returned error: ${JSON.stringify(raw.content)}`);
    }
    const json = extractJson(raw);
    // Only report success when the MCP reply actually contains a campaign ID;
    // anything else goes through the fallback path below.
    const campaignId = pickString(json, "campaign_id", "id", "campaignId");
    if (!campaignId) throw new Error("MCP reply contained no campaign ID");
    const adsManagerUrl =
      pickString(json, "ads_manager_url", "campaign_url", "url") ??
      `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${encodeURIComponent(
        process.env.META_AD_ACCOUNT_ID ?? "",
      )}&selected_campaign_ids=${encodeURIComponent(campaignId)}`;

    log.info("meta campaign created", { campaignId, hasUrl: !!adsManagerUrl });
    return { ok: true, campaignId, adsManagerUrl, fallback: false };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log.warn("meta MCP failed — falling back", { reason });
    return {
      ok: false,
      campaignId: mockCampaignId("meta"),
      adsManagerUrl: null,
      fallback: true,
      reason,
    };
  } finally {
    if (close) await close();
  }
}

export type TikTokCampaignArgs = {
  name: string;
  cluster: ResidentCluster;
  creativeUrl: string | null;
  adCopy: string;
  borough: string;
  city: string;
  dailyBudgetEUR?: number;
};

export async function createTikTokCampaign(args: TikTokCampaignArgs): Promise<MCPCampaignResult> {
  const t = token();
  if (!t) {
    log.warn("PIPEBOARD_API_TOKEN missing — returning mock TikTok campaign");
    return {
      ok: false,
      campaignId: mockCampaignId("tt"),
      adsManagerUrl: null,
      fallback: true,
      reason: "PIPEBOARD_API_TOKEN not set",
    };
  }

  let close: (() => Promise<void>) | null = null;
  try {
    const conn = await withTimeout(connect(TIKTOK_URL), TIMEOUT_MS, "tiktok.connect");
    close = conn.close;
    const tools = await withTimeout(conn.client.listTools(), TIMEOUT_MS, "tiktok.listTools");
    log.info("tiktok MCP tools", {
      count: tools.tools.length,
      names: tools.tools.map((t) => t.name),
    });

    const toolName =
      tools.tools.find((t) => /create.*campaign/i.test(t.name))?.name ??
      tools.tools.find((t) => /campaign/i.test(t.name))?.name ??
      "create_campaign";

    const params: Record<string, unknown> = {
      campaign_name: args.name,
      objective_type: "REACH",
      status: "DISABLE",
      budget_mode: "BUDGET_MODE_DAY",
      budget: args.dailyBudgetEUR ?? 10,
      targeting: {
        age_groups: ["AGE_18_24", "AGE_25_34"],
        location_ids: ["NL"],
      },
      creative: {
        image_url: args.creativeUrl,
        ad_text: args.adCopy,
        aspect_ratio: "9:16",
      },
      meta: { borough: args.borough, city: args.city, cluster: args.cluster.id },
    };

    const raw = (await withTimeout(
      conn.client.callTool({ name: toolName, arguments: params }),
      TIMEOUT_MS,
      "tiktok.createCampaign",
    )) as ToolCallResult;

    if (raw.isError) {
      throw new Error(`MCP returned error: ${JSON.stringify(raw.content)}`);
    }
    const json = extractJson(raw);
    // Only report success when the MCP reply actually contains a campaign ID;
    // anything else goes through the fallback path below.
    const campaignId = pickString(json, "campaign_id", "id", "campaignId");
    if (!campaignId) throw new Error("MCP reply contained no campaign ID");
    const adsManagerUrl =
      pickString(json, "ads_manager_url", "campaign_url", "url") ??
      `https://ads.tiktok.com/i18n/perf/campaign?aadvid=${encodeURIComponent(
        process.env.TIKTOK_ADVERTISER_ID ?? "",
      )}`;

    log.info("tiktok campaign created", { campaignId, hasUrl: !!adsManagerUrl });
    return { ok: true, campaignId, adsManagerUrl, fallback: false };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log.warn("tiktok MCP failed — falling back", { reason });
    return {
      ok: false,
      campaignId: mockCampaignId("tt"),
      adsManagerUrl: null,
      fallback: true,
      reason,
    };
  } finally {
    if (close) await close();
  }
}
