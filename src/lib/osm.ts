import { countStopsWithin, type StopPoint } from "@/lib/gtfs";

// OpenStreetMap social-infrastructure counts via the Overpass API.
//
// Instead of one radius query per buurt (hundreds of heavy requests), we fetch
// every point of each category once per city bounding box and count the ones
// within 500 m of each buurt centroid locally, with the same haversine helper
// the GTFS transit counts use. Area features (parks, larger venues mapped as
// ways) are represented by their centre point.

const OVERPASS_ENDPOINT = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
export const DEFAULT_RADIUS_M = 500;
const REQUEST_TIMEOUT_MS = 180_000;
// The public Overpass server regularly answers 429/504 under load.
const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 5_000;

export type POICounts = {
  libraries: number;
  community_centres: number;
  parks: number;
  benches: number;
  cafes: number;
  sports: number;
  intersections: number;
};

export type POICategory = keyof POICounts;

/** Overpass selectors per category. Benches and crossings are node-only by tagging convention. */
const SELECTORS: Record<POICategory, string[]> = {
  libraries: ['node["amenity"="library"]', 'way["amenity"="library"]'],
  community_centres: ['node["amenity"="community_centre"]', 'way["amenity"="community_centre"]'],
  parks: ['node["leisure"="park"]', 'way["leisure"="park"]'],
  benches: ['node["amenity"="bench"]'],
  cafes: ['node["amenity"="cafe"]', 'way["amenity"="cafe"]'],
  sports: ['node["leisure"="sports_centre"]', 'way["leisure"="sports_centre"]'],
  // highway=crossing is the walkability proxy (pedestrian crossings).
  intersections: ['node["highway"="crossing"]'],
};

export const POI_CATEGORIES = Object.keys(SELECTORS) as POICategory[];

export type BBox = { south: number; west: number; north: number; east: number };

export type CityPOIs = Record<POICategory, StopPoint[]>;

type OverpassElement = {
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
};

class RetryableError extends Error {}

async function overpass(query: string): Promise<OverpassElement[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "neighbourhood-os/0.1 (hackathon prototype)",
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
  } catch (err) {
    // Network error or our own timeout abort.
    throw new RetryableError(`Overpass request failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    const message = `Overpass HTTP ${response.status} ${response.statusText}`;
    if (response.status === 429 || response.status >= 500) throw new RetryableError(message);
    throw new Error(message);
  }
  const data = (await response.json()) as { elements?: OverpassElement[] };
  return data.elements ?? [];
}

async function overpassWithRetry(query: string): Promise<OverpassElement[]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await overpass(query);
    } catch (err) {
      if (!(err instanceof RetryableError) || attempt >= MAX_ATTEMPTS) throw err;
      await new Promise((r) => setTimeout(r, RETRY_BASE_MS * 2 ** (attempt - 1)));
    }
  }
}

/** All points of one category inside a bounding box (ways reduced to their centre). */
export async function fetchCategoryPoints(category: POICategory, bbox: BBox): Promise<StopPoint[]> {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const query = `[out:json][timeout:170];
(
${SELECTORS[category].map((s) => `  ${s}(${box});`).join("\n")}
);
out center qt;`;
  const points: StopPoint[] = [];
  for (const el of await overpassWithRetry(query)) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (typeof lat === "number" && typeof lng === "number") points.push({ lat, lng });
  }
  return points;
}

/** Counts each category's points within `radiusM` of a centroid. */
export function countPOIsWithin(
  pois: CityPOIs,
  lat: number,
  lng: number,
  radiusM = DEFAULT_RADIUS_M,
): POICounts {
  const counts = {} as POICounts;
  for (const category of POI_CATEGORIES) {
    counts[category] = countStopsWithin(pois[category], lat, lng, radiusM);
  }
  return counts;
}
