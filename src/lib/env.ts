function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  CBS_BASE_URL: () => optional("CBS_BASE_URL", "https://opendata.cbs.nl/ODataFeed/odata"),
  OPEN_METEO_BASE_URL: () => optional("OPEN_METEO_BASE_URL", "https://api.open-meteo.com/v1"),
};
