const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const DEFAULT_RADIUS_M = 500;
const REQUEST_TIMEOUT_MS = 60_000;

export type POICounts = {
  libraries: number;
  community_centres: number;
  parks: number;
  benches: number;
  cafes: number;
  sports: number;
  intersections: number;
};

type OverpassTags = Record<string, string | undefined>;

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  tags?: OverpassTags;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

function emptyCounts(): POICounts {
  return {
    libraries: 0,
    community_centres: 0,
    parks: 0,
    benches: 0,
    cafes: 0,
    sports: 0,
    intersections: 0,
  };
}

function buildQuery(lat: number, lng: number, radiusM: number): string {
  // Single Overpass query — all 7 categories around the centroid.
  // benches and intersections (highway=crossing) are node-only by tagging convention.
  // For the rest we include both nodes and ways.
  return `[out:json][timeout:30];
(
  node["amenity"="library"](around:${radiusM},${lat},${lng});
  way["amenity"="library"](around:${radiusM},${lat},${lng});
  node["amenity"="community_centre"](around:${radiusM},${lat},${lng});
  way["amenity"="community_centre"](around:${radiusM},${lat},${lng});
  node["leisure"="park"](around:${radiusM},${lat},${lng});
  way["leisure"="park"](around:${radiusM},${lat},${lng});
  node["amenity"="bench"](around:${radiusM},${lat},${lng});
  node["amenity"="cafe"](around:${radiusM},${lat},${lng});
  way["amenity"="cafe"](around:${radiusM},${lat},${lng});
  node["leisure"="sports_centre"](around:${radiusM},${lat},${lng});
  way["leisure"="sports_centre"](around:${radiusM},${lat},${lng});
  node["highway"="crossing"](around:${radiusM},${lat},${lng});
);
out tags;`;
}

function countCategory(el: OverpassElement, counts: POICounts): void {
  const tags = el.tags;
  if (!tags) return;
  const amenity = tags.amenity;
  const leisure = tags.leisure;
  const highway = tags.highway;

  if (amenity === "library") counts.libraries += 1;
  else if (amenity === "community_centre") counts.community_centres += 1;
  else if (amenity === "bench") counts.benches += 1;
  else if (amenity === "cafe") counts.cafes += 1;
  else if (leisure === "park") counts.parks += 1;
  else if (leisure === "sports_centre") counts.sports += 1;
  else if (highway === "crossing") counts.intersections += 1;
}

export async function fetchPOICountsForBuurt(
  centroidLat: number,
  centroidLng: number,
  radiusM = DEFAULT_RADIUS_M,
): Promise<POICounts> {
  const query = buildQuery(centroidLat, centroidLng, radiusM);
  const body = `data=${encodeURIComponent(query)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OVERPASS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "neighbourhood-os/0.1 (hackathon demo)",
      },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Overpass HTTP ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as OverpassResponse;
  const counts = emptyCounts();
  const elements = data.elements ?? [];
  for (const el of elements) {
    countCategory(el, counts);
  }
  return counts;
}
