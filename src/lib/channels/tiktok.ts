import { env } from "@/lib/env";

export async function createTikTokAd({ message, postcode }: { message: string; postcode: string }) {
  const token = env.TIKTOK_ADS_ACCESS_TOKEN();
  const advertiserId = env.TIKTOK_ADVERTISER_ID();
  if (!token || !advertiserId) return { simulated: true, message };
  const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/ad/create/", {
    method: "POST",
    headers: { "Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({
      advertiser_id: advertiserId,
      ad_name: `NbOS-${postcode}`,
      ad_text: message,
      status: "DISABLE",
    }),
  });
  if (!res.ok) throw new Error(`TikTok ${res.status}: ${await res.text()}`);
  return res.json();
}
