import { env } from "@/lib/env";

export async function sendSms({ to, body }: { to: string; body: string }) {
  const apiKey = env.MESSAGEBIRD_API_KEY();
  if (!apiKey) return { simulated: true, body };
  const res = await fetch("https://rest.messagebird.com/messages", {
    method: "POST",
    headers: {
      Authorization: `AccessKey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ originator: "NeighbourhoodOS", recipients: [to], body }),
  });
  if (!res.ok) throw new Error(`MessageBird ${res.status}: ${await res.text()}`);
  return res.json();
}
