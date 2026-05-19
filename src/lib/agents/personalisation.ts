import { jsonAgentCall } from "@/lib/together";
import { renderLeafletPdf } from "@/lib/channels/leaflet";
import { makeLogger } from "@/lib/log";
import { PERSONALISATION_SYSTEM } from "./prompts";
import type { BuurtRecord, ClusterMessage, RecommendedActivity, ResidentCluster } from "@/lib/types";

const log = makeLogger("agent:personalisation");

type Out = {
  message: string;
  tone: string;
  language: string;
  pdf?: { title: string; body: string; whenLabel: string; venue: string };
};

const WHEN_OPTS: Intl.DateTimeFormatOptions = {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
};

function whenLabel(activity: RecommendedActivity, locale: string): string {
  try {
    return new Date(activity.whenISO).toLocaleDateString(locale, WHEN_OPTS);
  } catch {
    return activity.whenISO;
  }
}

function fallbackMessage(cluster: ResidentCluster, activity: RecommendedActivity): Out {
  const language = cluster.language[0] ?? "nl";
  const locale = language === "en" ? "en-GB" : "nl-NL";
  const when = whenLabel(activity, locale);
  const tone = `${cluster.profile.split(",")[0]} · ${cluster.preferredChannel}`;
  if (cluster.preferredChannel === "leaflet") {
    return {
      language,
      tone,
      message: `Print-ready: ${activity.name} — ${activity.venue}, ${when}.`,
      pdf: {
        title: activity.name,
        body: `${activity.description}\n\nGratis koffie en thee. Iedereen welkom. Geen aanmelding nodig.`,
        whenLabel: when,
        venue: activity.venue,
      },
    };
  }
  if (cluster.preferredChannel === "sms") {
    const msg = `Tip: ${activity.name} ${when} bij ${activity.venue}. Gratis & vlakbij.`;
    return { language, tone, message: msg.slice(0, 158) };
  }
  if (cluster.preferredChannel === "tiktok") {
    return {
      language,
      tone,
      message: `${activity.name} ${language === "en" ? "near you this week" : "deze week om de hoek"}. Free coffee, meet your block. 👋`,
    };
  }
  if (language === "en") {
    return {
      language,
      tone,
      message: `Hey neighbour — ${activity.name} ${when} at ${activity.venue}. Free coffee, friendly faces. 5 mins from home.`,
    };
  }
  return {
    language,
    tone,
    message: `Hallo buurtgenoot! ${activity.name} ${when} bij ${activity.venue}. Gratis koffie, gezellige sfeer, op loopafstand.`,
  };
}

export async function personaliseCluster({
  cluster,
  activity,
  neighbourhood,
}: {
  cluster: ResidentCluster;
  activity: RecommendedActivity;
  neighbourhood: BuurtRecord;
}): Promise<ClusterMessage> {
  const user = `Cluster: ${JSON.stringify(cluster)}
Activity: ${JSON.stringify(activity)}
Neighbourhood: ${neighbourhood.name} (${neighbourhood.city})

Channel for this cluster: ${cluster.preferredChannel}.
Constraints:
- Activity-framed only, never mention loneliness.
- WhatsApp: warm, 2-3 sentences, Dutch or English based on cluster.language.
- SMS: <=160 chars.
- TikTok: short, casual, can use one emoji.
- Facebook/Instagram: friendly local-event tone.
- Leaflet: include pdf field with title, body, whenLabel, venue.

Return JSON: { message, tone, language, pdf? }`;

  log.info("personalising cluster", {
    cluster: cluster.id,
    channel: cluster.preferredChannel,
    activity: activity.name,
    buurt: neighbourhood.name,
  });
  let out: Out;
  try {
    out = await jsonAgentCall<Out>({
      system: PERSONALISATION_SYSTEM,
      user,
      label: `personalise:${cluster.id}`,
    });
    if (!out || typeof out.message !== "string" || !out.message.trim()) {
      throw new Error("empty message");
    }
    log.info("personalisation ok", {
      cluster: cluster.id,
      messageChars: out.message.length,
      language: out.language,
    });
  } catch (err) {
    log.warn("personalisation failed — using template", { cluster: cluster.id, err: err instanceof Error ? err.message : err });
    out = fallbackMessage(cluster, activity);
  }

  let pdfUrl: string | undefined;
  if (cluster.preferredChannel === "leaflet") {
    const pdf = out.pdf ?? fallbackMessage(cluster, activity).pdf;
    if (pdf) {
      try {
        const buf = await renderLeafletPdf({
          neighbourhood: neighbourhood.name,
          activityName: pdf.title,
          whenLabel: pdf.whenLabel,
          venue: pdf.venue,
          body: pdf.body,
        });
        pdfUrl = `data:application/pdf;base64,${buf.toString("base64")}`;
        log.info("leaflet PDF rendered", { cluster: cluster.id, bytes: buf.length });
      } catch (err) {
        log.warn("leaflet PDF render failed", { cluster: cluster.id, err: err instanceof Error ? err.message : err });
      }
    }
  }

  return {
    clusterId: cluster.id,
    channel: cluster.preferredChannel,
    language: out.language || cluster.language[0] || "nl",
    tone: out.tone || cluster.profile,
    message: out.message,
    pdfUrl,
  };
}
