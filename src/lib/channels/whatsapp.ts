import { env } from "@/lib/env";

export async function sendWhatsappTemplate({
  to,
  template,
  language,
  components,
}: {
  to: string;
  template: string;
  language: string;
  components?: unknown;
}) {
  const token = env.WHATSAPP_TOKEN();
  const phoneId = env.WHATSAPP_PHONE_NUMBER_ID();
  if (!token || !phoneId) return { simulated: true, to, template };
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: template, language: { code: language }, components },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${await res.text()}`);
  return res.json();
}
