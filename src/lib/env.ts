function need(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  TOGETHER_AI_API_KEY: () => need("TOGETHER_AI_API_KEY"),
  SCALEWAY_API_KEY: () => process.env.SCALEWAY_API_KEY,
  SCALEWAY_BASE_URL: () => optional("SCALEWAY_BASE_URL", "https://api.scaleway.ai/v1"),
  SCALEWAY_MODEL: () => optional("SCALEWAY_MODEL", "gpt-oss-120b"),
  SUPERMEMORY_API_KEY: () => process.env.SUPERMEMORY_API_KEY,
  OPENAI_API_KEY: () => need("OPENAI_API_KEY"),
  DATABASE_URL: () => need("DATABASE_URL"),
  MESSAGEBIRD_API_KEY: () => process.env.MESSAGEBIRD_API_KEY,
  META_GRAPH_TOKEN: () => process.env.META_GRAPH_TOKEN,
  META_AD_ACCOUNT_ID: () => process.env.META_AD_ACCOUNT_ID,
  META_PAGE_ID: () => process.env.META_PAGE_ID,
  TIKTOK_ADS_ACCESS_TOKEN: () => process.env.TIKTOK_ADS_ACCESS_TOKEN,
  TIKTOK_ADVERTISER_ID: () => process.env.TIKTOK_ADVERTISER_ID,
  WHATSAPP_PHONE_NUMBER_ID: () => process.env.WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_TOKEN: () => process.env.WHATSAPP_TOKEN,
  CBS_BASE_URL: () => optional("CBS_BASE_URL", "https://opendata.cbs.nl/ODataFeed/odata"),
  OPEN_METEO_BASE_URL: () => optional("OPEN_METEO_BASE_URL", "https://api.open-meteo.com/v1"),
};
