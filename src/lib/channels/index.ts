import type { Channel, ClusterMessage } from "@/lib/types";
import { sendSms } from "./messagebird";
import { createMetaAd } from "./meta";
import { createTikTokAd } from "./tiktok";
import { sendWhatsappTemplate } from "./whatsapp";

export async function routeMessage(
  message: ClusterMessage,
  ctx: { phone?: string; postcode: string; status: "draft" | "pending" | "approved" }
): Promise<{ delivered: boolean; result?: unknown; reason?: string }> {
  if (ctx.status !== "approved") return { delivered: false, reason: "awaiting_approval" };
  switch (message.channel as Channel) {
    case "sms": {
      if (!ctx.phone) return { delivered: false, reason: "no_phone" };
      const r = await sendSms({ to: ctx.phone, body: message.message });
      return { delivered: true, result: r };
    }
    case "facebook":
    case "instagram": {
      const r = await createMetaAd({ message: message.message, postcode: ctx.postcode, channel: message.channel as "facebook" | "instagram" });
      return { delivered: true, result: r };
    }
    case "tiktok": {
      const r = await createTikTokAd({ message: message.message, postcode: ctx.postcode });
      return { delivered: true, result: r };
    }
    case "whatsapp": {
      if (!ctx.phone) return { delivered: false, reason: "no_phone" };
      const r = await sendWhatsappTemplate({ to: ctx.phone, template: "local_activity_v1", language: message.language });
      return { delivered: true, result: r };
    }
    case "leaflet":
      return { delivered: false, reason: "leaflet_offline" };
    default:
      return { delivered: false, reason: "unknown_channel" };
  }
}
