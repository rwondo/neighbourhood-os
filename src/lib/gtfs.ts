import { promises as fs } from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { makeLogger } from "@/lib/log";

const log = makeLogger("gtfs");

const GTFS_URL = "https://gtfs.ovapi.nl/nl/gtfs-nl.zip";
const CACHE_DIR = path.resolve(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "gtfs-nl.zip");
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// NL bbox covering Rotterdam, Amsterdam, Den Haag with margin
const NL_BBOX = { minLat: 51.7, maxLat: 52.7, minLng: 4.0, maxLng: 5.2 } as const;

export type StopPoint = { lat: number; lng: number };

let cachedStops: StopPoint[] | null = null;

async function fileAgeMs(file: string): Promise<number | null> {
  try {
    const st = await fs.stat(file);
    return Date.now() - st.mtimeMs;
  } catch {
    return null;
  }
}

async function downloadGtfs(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  log.info(`downloading ${GTFS_URL} -> ${CACHE_FILE}`);
  const res = await fetch(GTFS_URL);
  if (!res.ok) {
    throw new Error(`gtfs download failed: ${res.status} ${res.statusText}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(CACHE_FILE, buf);
  log.info(`saved ${buf.byteLength} bytes`);
}

// OVapi rows are wrapped in outer double-quotes; inner fields with commas
// get an additional quoted layer ("...,"Roermond, Karel Doormanplein",..."),
// so a naive split(",") on the raw line falls apart on ~94% of rows. This
// parser strips the outer wrap if present, then walks the row tracking
// quote state.
function parseCsvRow(line: string): string[] {
  let s = line;
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1);
  }
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else if (ch === '"') {
      inQuotes = true;
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseStopsCsv(csv: string): StopPoint[] {
  const out: StopPoint[] = [];
  const text = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) return out;
  const headers = parseCsvRow(lines[0]).map((h) => h.trim());
  const latIdx = headers.indexOf("stop_lat");
  const lngIdx = headers.indexOf("stop_lon");
  if (latIdx < 0 || lngIdx < 0) {
    throw new Error(`stops.txt missing stop_lat/stop_lon columns; got: ${headers.join(",")}`);
  }
  let totalParsed = 0;
  let totalKept = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = parseCsvRow(line);
    if (cols.length <= Math.max(latIdx, lngIdx)) continue;
    const lat = Number(cols[latIdx]);
    const lng = Number(cols[lngIdx]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    totalParsed++;
    if (
      lat >= NL_BBOX.minLat &&
      lat <= NL_BBOX.maxLat &&
      lng >= NL_BBOX.minLng &&
      lng <= NL_BBOX.maxLng
    ) {
      out.push({ lat, lng });
      totalKept++;
    }
  }
  log.info(`parsed ${totalParsed} stop rows, kept ${totalKept} inside NL bbox`);
  return out;
}

/**
 * Ensure the GTFS zip is cached locally and return all stops inside the NL bbox.
 * Re-uses an in-memory cache between calls in the same process.
 */
export async function ensureGtfsStops(): Promise<StopPoint[]> {
  if (cachedStops) return cachedStops;

  const ageMs = await fileAgeMs(CACHE_FILE);
  if (ageMs === null || ageMs > SEVEN_DAYS_MS) {
    if (ageMs === null) log.info(`no cached zip at ${CACHE_FILE}`);
    else log.info(`cached zip is ${Math.round(ageMs / 86_400_000)}d old (> 7d), refreshing`);
    await downloadGtfs();
  } else {
    log.info(`using cached zip (${Math.round(ageMs / 3_600_000)}h old)`);
  }

  const stat = await fs.stat(CACHE_FILE);
  log.info(`zip size: ${(stat.size / (1024 * 1024)).toFixed(1)} MiB`);

  const zip = new AdmZip(CACHE_FILE);
  const entry = zip.getEntry("stops.txt");
  if (!entry) {
    const names = zip
      .getEntries()
      .map((e) => e.entryName)
      .join(", ");
    throw new Error(`stops.txt not found in GTFS zip; entries: ${names}`);
  }
  const csv = entry.getData().toString("utf8");
  const stops = parseStopsCsv(csv);
  cachedStops = stops;
  return stops;
}

/**
 * Count GTFS stops within `radiusM` meters of the given centroid, using haversine.
 */
export function countStopsWithin(
  stops: ReadonlyArray<StopPoint>,
  centroidLat: number,
  centroidLng: number,
  radiusM: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat1Rad = toRad(centroidLat);
  const cosLat1 = Math.cos(lat1Rad);
  let count = 0;
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    const dLat = toRad(s.lat - centroidLat);
    const dLon = toRad(s.lng - centroidLng);
    const sinLat = Math.sin(dLat / 2);
    const sinLon = Math.sin(dLon / 2);
    const a = sinLat * sinLat + cosLat1 * Math.cos(toRad(s.lat)) * sinLon * sinLon;
    const dist = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (dist <= radiusM) count++;
  }
  return count;
}
