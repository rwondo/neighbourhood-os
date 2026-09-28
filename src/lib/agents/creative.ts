import { together } from "@/lib/together";
import { makeLogger } from "@/lib/log";
import type {
  BuurtRecord,
  Channel,
  CreativeStatus,
  RecommendedActivity,
  ResidentCluster,
} from "@/lib/types";

const log = makeLogger("agent:creative");

export const IDEOGRAM_MODEL = process.env.IDEOGRAM_MODEL ?? "ideogram/ideogram-3.0";

export type CreativeResult = {
  url: string | null;
  status: CreativeStatus;
  prompt: string;
};

type ChannelSpec = {
  aspectRatio: "1:1" | "9:16";
  style: "REALISTIC" | "DESIGN";
  description: string;
};

const CHANNEL_SPECS: Partial<Record<Channel, ChannelSpec>> = {
  facebook: {
    aspectRatio: "1:1",
    style: "REALISTIC",
    description:
      "warm Dutch neighbourhood community photography, golden hour light, activity happening in the scene, neighbours of mixed ages chatting, candid documentary style",
  },
  instagram: {
    aspectRatio: "1:1",
    style: "REALISTIC",
    description:
      "warm Dutch neighbourhood community photography, golden hour light, activity happening in the scene, neighbours of mixed ages chatting, candid documentary style",
  },
  tiktok: {
    aspectRatio: "9:16",
    style: "REALISTIC",
    description:
      "vibrant energetic social atmosphere, young adults laughing together, vertical phone framing, bold typography in upper third, daylight bright colours",
  },
  leaflet: {
    aspectRatio: "9:16",
    style: "DESIGN",
    description:
      "A5 print-ready poster, warm welcoming design, clean editorial layout, activity name large in upper half, venue and time smaller below, ample white space, municipality logo placeholder bottom right",
  },
};

const CITY_LABEL: Record<string, string> = {
  rotterdam: "Rotterdam",
  amsterdam: "Amsterdam",
  denhaag: "The Hague",
};

type ActivityKind =
  "chess" | "walk" | "cook" | "coffee" | "garden" | "music" | "language" | "general";

function classifyActivity(activity: RecommendedActivity): ActivityKind {
  const n = activity.name.toLowerCase();
  if (n.includes("chess") || n.includes("schaak")) return "chess";
  if (n.includes("walk") || n.includes("wandel")) return "walk";
  if (n.includes("cook") || n.includes("kook") || n.includes("koken")) return "cook";
  if (n.includes("coffee") || n.includes("koffie")) return "coffee";
  if (n.includes("garden") || n.includes("tuin")) return "garden";
  if (n.includes("music") || n.includes("muziek")) return "music";
  if (n.includes("language") || n.includes("taal")) return "language";
  return "general";
}

function activityKeyword(activity: RecommendedActivity): string {
  switch (classifyActivity(activity)) {
    case "chess":
      return "chess afternoon";
    case "walk":
      return "neighbourhood walking group";
    case "cook":
      return "community cooking workshop";
    case "coffee":
      return "community coffee meetup";
    case "garden":
      return "community garden afternoon";
    case "music":
      return "neighbourhood music gathering";
    case "language":
      return "language exchange evening";
    default:
      return "neighbourhood community activity";
  }
}

// Curated short headlines — only well-known single words in each language.
// Avoid auto-truncated activity names to keep Ideogram from rendering garbled text.
const HEADLINES: Record<ActivityKind, { nl: string; en: string }> = {
  chess: { nl: "SCHAAK", en: "CHESS" },
  walk: { nl: "WANDELEN", en: "WALK" },
  cook: { nl: "KOKEN", en: "COOK" },
  coffee: { nl: "KOFFIE", en: "COFFEE" },
  garden: { nl: "TUIN", en: "GARDEN" },
  music: { nl: "MUZIEK", en: "MUSIC" },
  language: { nl: "TAAL", en: "LANGUAGE" },
  general: { nl: "BUURT", en: "LOCAL" },
};

function shortHeadline(activity: RecommendedActivity, language: string): string {
  const kind = classifyActivity(activity);
  return language === "en" ? HEADLINES[kind].en : HEADLINES[kind].nl;
}

function subline(_activity: RecommendedActivity, neighbourhood: string, language: string): string {
  // Keep subline ultra short and ASCII-safe — single neighbourhood word
  // renders far more reliably than venue + comma + city.
  return language === "en"
    ? `IN ${neighbourhood.toUpperCase()}`
    : `IN ${neighbourhood.toUpperCase()}`;
}

export function buildIdeogramPrompt({
  cluster,
  activity,
  neighbourhood,
  channel,
  language,
}: {
  cluster: ResidentCluster;
  activity: RecommendedActivity;
  neighbourhood: BuurtRecord;
  channel: Channel;
  language: string;
}): string {
  const spec = CHANNEL_SPECS[channel];
  if (!spec) return "";
  const cityLabel = CITY_LABEL[neighbourhood.city] ?? neighbourhood.city;
  const keyword = activityKeyword(activity);
  const head = shortHeadline(activity, language);
  const sub = subline(activity, neighbourhood.name, language);
  const cohortHint =
    cluster.ageRange[0] >= 65
      ? "older residents, retirees, warm intergenerational atmosphere"
      : cluster.ageRange[1] <= 35
        ? "young adults and students, lively diverse group"
        : "mixed-age local residents, families and adults";

  return [
    `A ${spec.style === "DESIGN" ? "poster" : "photograph"} for a ${keyword} in ${cityLabel}.`,
    spec.description,
    `Scene includes ${cohortHint}.`,
    // Single, simple, high-contrast headline. Quoted text + explicit spelling
    // guidance dramatically reduces Ideogram's tendency to invent letterforms.
    `The image contains exactly ONE line of text reading "${head}" rendered in clean bold uppercase sans-serif letters.`,
    `Below it a smaller second line reads "${sub}" in the same font.`,
    `Spelling must be EXACTLY as written, letter for letter. Do not add, remove, or alter any character. Use only standard Latin letters A to Z.`,
    `No other text anywhere in the image. No watermark, no logos, no decorative scribbles, no jumbled letters, no foreign characters, no misspelled words.`,
  ].join(" ");
}

type IdeogramResponse = {
  data?: Array<{ url?: string; b64_json?: string }>;
};

export async function generateCreative({
  cluster,
  activity,
  neighbourhood,
}: {
  cluster: ResidentCluster;
  activity: RecommendedActivity;
  neighbourhood: BuurtRecord;
}): Promise<CreativeResult> {
  const channel = cluster.preferredChannel;
  const spec = CHANNEL_SPECS[channel];
  const language = cluster.language[0] ?? "nl";

  if (!spec) {
    return { url: null, status: "pending", prompt: "" };
  }

  const prompt = buildIdeogramPrompt({ cluster, activity, neighbourhood, channel, language });
  log.info("generating creative", {
    cluster: cluster.id,
    channel,
    aspect: spec.aspectRatio,
    style: spec.style,
    promptChars: prompt.length,
  });

  const started = Date.now();
  try {
    // OpenAI-compatible images.generate. Together AI accepts model-specific
    // extras (aspect_ratio, style_type) as additional fields per its Ideogram
    // docs; the OpenAI SDK forwards unknown keys verbatim.
    const raw = (await together.images.generate({
      model: IDEOGRAM_MODEL,
      prompt,
      n: 1,
      // Cast to allow Ideogram-specific extras through the OpenAI SDK.
      ...({
        aspect_ratio: spec.aspectRatio,
        style_type: spec.style,
        // DEFAULT trades a few seconds of latency for noticeably sharper
        // letterforms; TURBO frequently mangles text in posters/ads.
        rendering_speed: "DEFAULT",
        magic_prompt: "OFF",
        negative_prompt:
          "misspelled words, garbled text, fake characters, extra letters, missing letters, duplicate text, jumbled letters, foreign script, gibberish",
      } as Record<string, unknown>),
    } as unknown as Parameters<typeof together.images.generate>[0])) as unknown as IdeogramResponse;

    const first = raw.data?.[0];
    const url = first?.url ?? (first?.b64_json ? `data:image/png;base64,${first.b64_json}` : null);
    log.info("creative ok", {
      cluster: cluster.id,
      channel,
      ms: Date.now() - started,
      hasUrl: !!url,
    });
    if (!url) return { url: null, status: "failed", prompt };
    return { url, status: "ready", prompt };
  } catch (err) {
    log.warn("creative failed — fallback placeholder", {
      cluster: cluster.id,
      channel,
      err: err instanceof Error ? err.message : String(err),
      ms: Date.now() - started,
    });
    return { url: null, status: "fallback", prompt };
  }
}

export function channelNeedsCreative(channel: Channel): boolean {
  return Boolean(CHANNEL_SPECS[channel]);
}
