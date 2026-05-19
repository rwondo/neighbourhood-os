import { env } from "@/lib/env";

export type CityWeatherSignal = {
  city: string;
  isolationPenalty: number;
  rainMmNext24h: number;
  minTempC: number;
};

const CENTROIDS: Record<string, { lat: number; lng: number }> = {
  rotterdam: { lat: 51.92, lng: 4.48 },
  amsterdam: { lat: 52.37, lng: 4.89 },
  denhaag: { lat: 52.08, lng: 4.31 },
};

export async function fetchCityWeather(city: keyof typeof CENTROIDS): Promise<CityWeatherSignal> {
  const c = CENTROIDS[city];
  const base = env.OPEN_METEO_BASE_URL();
  const url = `${base}/forecast?latitude=${c.lat}&longitude=${c.lng}&hourly=temperature_2m,precipitation&forecast_days=2`;
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as {
    hourly: { temperature_2m: number[]; precipitation: number[] };
  };
  const minTemp = Math.min(...data.hourly.temperature_2m.slice(0, 24));
  const rain = data.hourly.precipitation.slice(0, 24).reduce((a, b) => a + b, 0);
  let penalty = 0;
  if (minTemp < 2) penalty += 4;
  if (rain > 10) penalty += 3;
  if (minTemp < -3) penalty += 5;
  return { city, isolationPenalty: penalty, rainMmNext24h: rain, minTempC: minTemp };
}
