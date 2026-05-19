export type RiskLevel = "high-isolation" | "at-risk" | "healthy";
export type Channel = "whatsapp" | "tiktok" | "sms" | "leaflet" | "facebook" | "instagram";
export type Trend = "up" | "down" | "flat";
export type CityKey = "rotterdam" | "amsterdam" | "denhaag";

export type CityProfile = {
  key: CityKey;
  label: string;
  shortLabel: string;
  buPrefix: string;
  gmCodeFull: string;
  lastUpdatedLabel: string;
  zoomCenter: [number, number];
  zoomLevel: number;
};

export const CITIES: CityProfile[] = [
  {
    key: "rotterdam",
    label: "Rotterdam",
    shortLabel: "RDM",
    buPrefix: "BU0599",
    gmCodeFull: "GM0599",
    lastUpdatedLabel: "May 18, 2026",
    zoomCenter: [4.49, 51.917],
    zoomLevel: 2.1,
  },
  {
    key: "amsterdam",
    label: "Amsterdam",
    shortLabel: "AMS",
    buPrefix: "BU0363",
    gmCodeFull: "GM0363",
    lastUpdatedLabel: "May 18, 2026",
    zoomCenter: [4.895, 52.365],
    zoomLevel: 1.6,
  },
  {
    key: "denhaag",
    label: "The Hague",
    shortLabel: "DH",
    buPrefix: "BU0518",
    gmCodeFull: "GM0518",
    lastUpdatedLabel: "May 18, 2026",
    zoomCenter: [4.305, 52.08],
    zoomLevel: 1.3,
  },
];

export const CITY_BY_KEY: Record<CityKey, CityProfile> = Object.fromEntries(
  CITIES.map((c) => [c.key, c])
) as Record<CityKey, CityProfile>;

// Borough-level fallback scores used when the live /api/boroughs payload hasn't
// loaded yet. These are not authoritative — they only fill the map for the
// ~200ms before the first useBoroughs() response arrives.
export const BOROUGH_SCORES: Record<string, number> = {
  // Rotterdam (gebieden)
  Feijenoord: 56,
  Charlois: 58,
  Delfshaven: 62,
  IJsselmonde: 64,
  Hoogvliet: 68,
  "Kralingen-Crooswijk": 70,
  "Rotterdam Centrum": 71,
  Noord: 69,
  Overschie: 72,
  Pernis: 73,
  "Hillegersberg-Schiebroek": 84,
  "Prins Alexander": 78,
  "Hoek van Holland": 75,
  Rozenburg: 71,

  // Amsterdam (stadsdelen)
  Zuidoost: 56,
  "Nieuw-West": 62,
  Centrum: 76,
  Zuid: 82,
  West: 70,
  Oost: 71,
  Westpoort: 80,
  Weesp: 76,

  // Den Haag (stadsdelen)
  Escamp: 58,
  Laak: 62,
  Segbroek: 78,
  Scheveningen: 80,
  "Haagse Hout": 82,
  Loosduinen: 76,
  "Leidschenveen-Ypenburg": 74,
};

export const INDUSTRIAL_BOROUGH = "Haven";

export function riskLevel(score: number): RiskLevel {
  if (score < 60) return "high-isolation";
  if (score < 80) return "at-risk";
  return "healthy";
}

export function riskLabel(score: number): string {
  const l = riskLevel(score);
  if (l === "high-isolation") return "High Isolation";
  if (l === "at-risk") return "At Risk";
  return "Healthy";
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function scoreForBorough(name: string, city?: CityKey): number {
  if (name === INDUSTRIAL_BOROUGH) return -2;
  const cityKey = city === "rotterdam" && name === "Centrum" ? "Rotterdam Centrum" : name;
  if (BOROUGH_SCORES[cityKey] !== undefined) return BOROUGH_SCORES[cityKey];
  if (BOROUGH_SCORES[name] !== undefined) return BOROUGH_SCORES[name];
  const h = hashCode(name);
  return 60 + (h % 24);
}

export function colorForScore(score: number): string {
  if (score === -2) return "oklch(0.88 0.012 220)";
  if (score < 0) return "#9ca3af";
  if (score < 60) return "#dc2626";
  if (score < 80) return "#d97706";
  return "#059669";
}

export function hoverColorForScore(score: number): string {
  if (score === -2) return "oklch(0.92 0.012 220)";
  if (score < 0) return "#6b7280";
  if (score < 60) return "#ef4444";
  if (score < 80) return "#f59e0b";
  return "#10b981";
}
