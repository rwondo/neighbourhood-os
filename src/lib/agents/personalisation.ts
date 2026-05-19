import { jsonAgentCall } from "@/lib/together";
import { renderLeafletPdf } from "@/lib/channels/leaflet";
import { PERSONALISATION_SYSTEM } from "./prompts";
import type { BuurtRecord, ClusterMessage, RecommendedActivity, ResidentCluster } from "@/lib/types";

type Out = {
  message: string;
  tone: string;
  language: string;
  pdf?: { title: string; body: string; whenLabel: string; venue: string };
};

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
  const out = await jsonAgentCall<Out>({ system: PERSONALISATION_SYSTEM, user });

  let pdfUrl: string | undefined;
  if (cluster.preferredChannel === "leaflet" && out.pdf) {
    const buf = await renderLeafletPdf({
      neighbourhood: neighbourhood.name,
      activityName: out.pdf.title,
      whenLabel: out.pdf.whenLabel,
      venue: out.pdf.venue,
      body: out.pdf.body,
    });
    pdfUrl = `data:application/pdf;base64,${buf.toString("base64")}`;
  }

  return {
    clusterId: cluster.id,
    channel: cluster.preferredChannel,
    language: out.language,
    tone: out.tone,
    message: out.message,
    pdfUrl,
  };
}
