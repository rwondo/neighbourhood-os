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
    zoomCenter: [4.49, 51.917],
    zoomLevel: 2.1,
  },
  {
    key: "amsterdam",
    label: "Amsterdam",
    shortLabel: "AMS",
    buPrefix: "BU0363",
    gmCodeFull: "GM0363",
    zoomCenter: [4.895, 52.365],
    zoomLevel: 1.6,
  },
  {
    key: "denhaag",
    label: "The Hague",
    shortLabel: "DH",
    buPrefix: "BU0518",
    gmCodeFull: "GM0518",
    zoomCenter: [4.305, 52.08],
    zoomLevel: 1.3,
  },
];

export const CITY_BY_KEY: Record<CityKey, CityProfile> = Object.fromEntries(
  CITIES.map((c) => [c.key, c])
) as Record<CityKey, CityProfile>;

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

// Map fill before /api/boroughs has answered (or when it has no row for a
// borough): -2 marks the industrial port area, -1 means "no data".
export function scoreForBorough(name: string): number {
  return name === INDUSTRIAL_BOROUGH ? -2 : -1;
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
