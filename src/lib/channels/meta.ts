import { env } from "@/lib/env";

export async function createMetaAd({
  message,
  postcode,
  channel,
}: {
  message: string;
  postcode: string;
  channel: "facebook" | "instagram";
}) {
  const token = env.META_GRAPH_TOKEN();
  const accountId = env.META_AD_ACCOUNT_ID();
  if (!token || !accountId) return { simulated: true, message, channel };
  const res = await fetch(`https://graph.facebook.com/v21.0/act_${accountId}/ads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: token,
      name: `NbOS-${channel}-${postcode}`,
      status: "PAUSED",
      creative: { body: message },
      targeting: { geo_locations: { zips: [{ key: `NL:${postcode}` }] } },
    }),
  });
  if (!res.ok) throw new Error(`Meta ${res.status}: ${await res.text()}`);
  return res.json();
}
