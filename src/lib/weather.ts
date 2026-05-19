import { env } from "@/lib/env";
import { makeLogger } from "@/lib/log";

const log = makeLogger("weather");

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

// Open-Meteo is open and key-less, but a transient 5xx or DNS hiccup must never
// crash the seed/recalc pipeline. Always return a safe baseline signal.
function neutralSignal(city: string): CityWeatherSignal {
  return { city, isolationPenalty: 0, rainMmNext24h: 0, minTempC: 10 };
}

export async function fetchCityWeather(city: keyof typeof CENTROIDS): Promise<CityWeatherSignal> {
  const c = CENTROIDS[city];
  const base = env.OPEN_METEO_BASE_URL();
  const url = `${base}/forecast?latitude=${c.lat}&longitude=${c.lng}&hourly=temperature_2m,precipitation&forecast_days=2`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      log.warn("Open-Meteo non-ok", { city, status: res.status });
      return neutralSignal(city);
    }
    const data = (await res.json()) as {
      hourly?: { temperature_2m?: number[]; precipitation?: number[] };
    };
    const temps = data.hourly?.temperature_2m ?? [];
    const precip = data.hourly?.precipitation ?? [];
    if (!temps.length) return neutralSignal(city);
    const minTemp = Math.min(...temps.slice(0, 24));
    const rain = precip.slice(0, 24).reduce((a, b) => a + b, 0);
    let penalty = 0;
    if (minTemp < 2) penalty += 4;
    if (rain > 10) penalty += 3;
    if (minTemp < -3) penalty += 5;
    return { city, isolationPenalty: penalty, rainMmNext24h: rain, minTempC: minTemp };
  } catch (err) {
    log.warn("Open-Meteo fetch failed", { city, err: err instanceof Error ? err.message : err });
    return neutralSignal(city);
  }
}
