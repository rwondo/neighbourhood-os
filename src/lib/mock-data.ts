export type RiskLevel = "high-isolation" | "at-risk" | "healthy";
export type Channel = "whatsapp" | "tiktok" | "sms" | "leaflet";
export type CampaignStatus = "active" | "pending";
export type Trend = "up" | "down" | "flat";
export type CityKey = "rotterdam" | "amsterdam" | "denhaag";

export type NeighbourhoodAlert = {
  id: string;
  name: string;
  score: number;
  trend: Trend;
  livingAlonePct: number;
  elderlyPct: number;
};

export type Campaign = {
  id: string;
  neighbourhood: string;
  channels: Channel[];
  status: CampaignStatus;
};

export type AgentStep = {
  id: string;
  label: string;
  status: "pending" | "active" | "completed";
};

export type ChannelPreview = {
  id: string;
  channel: Channel;
  cluster: string;
  message: string;
  statusLabel: string;
  statusTone: "pending" | "ready";
  isPdf?: boolean;
};

export type ImpactPoint = { week: number; score: number };

export type CityStats = {
  buurtenMonitored: number;
  atRisk: number;
  highIsolation: number;
  activeInterventions: number;
};

export type CityProfile = {
  key: CityKey;
  label: string;
  shortLabel: string;
  buPrefix: string;
  gmCodeFull: string;
  totalBuurten: number;
  lastUpdatedISO: string;
  lastUpdatedLabel: string;
  stats: CityStats;
  alerts: NeighbourhoodAlert[];
  campaigns: Campaign[];
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
    totalBuurten: 847,
    lastUpdatedISO: "2026-05-18",
    lastUpdatedLabel: "May 18, 2026",
    stats: {
      buurtenMonitored: 847,
      atRisk: 124,
      highIsolation: 31,
      activeInterventions: 12,
    },
    alerts: [
      { id: "feijenoord", name: "Feijenoord", score: 56, trend: "down", livingAlonePct: 35, elderlyPct: 22 },
      { id: "charlois", name: "Charlois", score: 58, trend: "down", livingAlonePct: 33, elderlyPct: 25 },
      { id: "delfshaven", name: "Delfshaven", score: 62, trend: "flat", livingAlonePct: 30, elderlyPct: 21 },
      { id: "hoogvliet", name: "Hoogvliet", score: 68, trend: "up", livingAlonePct: 25, elderlyPct: 27 },
    ],
    campaigns: [
      { id: "c1", neighbourhood: "Feijenoord", channels: ["whatsapp", "sms"], status: "active" },
      { id: "c2", neighbourhood: "Delfshaven", channels: ["whatsapp", "tiktok"], status: "active" },
      { id: "c3", neighbourhood: "Charlois", channels: ["sms", "leaflet"], status: "pending" },
    ],
    zoomCenter: [4.49, 51.917],
    zoomLevel: 2.1,
  },
  {
    key: "amsterdam",
    label: "Amsterdam",
    shortLabel: "AMS",
    buPrefix: "BU0363",
    gmCodeFull: "GM0363",
    totalBuurten: 932,
    lastUpdatedISO: "2026-05-18",
    lastUpdatedLabel: "May 18, 2026",
    stats: {
      buurtenMonitored: 932,
      atRisk: 138,
      highIsolation: 27,
      activeInterventions: 15,
    },
    alerts: [
      { id: "zuidoost", name: "Zuidoost", score: 56, trend: "down", livingAlonePct: 38, elderlyPct: 19 },
      { id: "nieuw-west", name: "Nieuw-West", score: 62, trend: "flat", livingAlonePct: 31, elderlyPct: 22 },
      { id: "noord", name: "Noord", score: 64, trend: "down", livingAlonePct: 29, elderlyPct: 24 },
      { id: "oost", name: "Oost", score: 71, trend: "up", livingAlonePct: 26, elderlyPct: 18 },
    ],
    campaigns: [
      { id: "c1", neighbourhood: "Zuidoost", channels: ["whatsapp", "tiktok"], status: "active" },
      { id: "c2", neighbourhood: "Noord", channels: ["sms", "leaflet"], status: "active" },
      { id: "c3", neighbourhood: "Nieuw-West", channels: ["whatsapp", "sms"], status: "pending" },
    ],
    zoomCenter: [4.895, 52.365],
    zoomLevel: 1.6,
  },
  {
    key: "denhaag",
    label: "The Hague",
    shortLabel: "DH",
    buPrefix: "BU0518",
    gmCodeFull: "GM0518",
    totalBuurten: 614,
    lastUpdatedISO: "2026-05-18",
    lastUpdatedLabel: "May 18, 2026",
    stats: {
      buurtenMonitored: 614,
      atRisk: 89,
      highIsolation: 14,
      activeInterventions: 9,
    },
    alerts: [
      { id: "escamp", name: "Escamp", score: 58, trend: "down", livingAlonePct: 33, elderlyPct: 20 },
      { id: "laak", name: "Laak", score: 62, trend: "flat", livingAlonePct: 31, elderlyPct: 18 },
      { id: "centrum-dh", name: "Centrum", score: 65, trend: "down", livingAlonePct: 36, elderlyPct: 16 },
      { id: "loosduinen", name: "Loosduinen", score: 76, trend: "up", livingAlonePct: 24, elderlyPct: 28 },
    ],
    campaigns: [
      { id: "c1", neighbourhood: "Escamp", channels: ["whatsapp", "sms"], status: "active" },
      { id: "c2", neighbourhood: "Laak", channels: ["tiktok", "sms"], status: "active" },
      { id: "c3", neighbourhood: "Loosduinen", channels: ["leaflet"], status: "pending" },
    ],
    zoomCenter: [4.305, 52.08],
    zoomLevel: 1.3,
  },
];

export const CITY_BY_KEY: Record<CityKey, CityProfile> = Object.fromEntries(
  CITIES.map((c) => [c.key, c])
) as Record<CityKey, CityProfile>;

export const AGENT_STEPS: AgentStep[] = [
  { id: "s1", label: "Analysing neighbourhood signals", status: "pending" },
  { id: "s2", label: "Retrieving CBS buurt profile", status: "pending" },
  { id: "s3", label: "Searching local activities", status: "pending" },
  { id: "s4", label: "Querying past interventions", status: "pending" },
  { id: "s5", label: "Identifying resident clusters", status: "pending" },
  { id: "s6", label: "Generating strategy", status: "pending" },
];

export const CHANNEL_PREVIEWS: ChannelPreview[] = [
  {
    id: "p1",
    channel: "whatsapp",
    cluster: "Elderly Dutch 65+",
    message:
      "Goedemiddag! Er is woensdag een gezellig schaaknamiddag bij u in de buurt. Gratis koffie, op 5 minuten lopen.",
    statusLabel: "Pending Approval",
    statusTone: "pending",
  },
  {
    id: "p2",
    channel: "tiktok",
    cluster: "Young Adults 18–35",
    message: "Chess afternoon this Wednesday near you. Free coffee. Meet some locals. 👋",
    statusLabel: "Pending Approval",
    statusTone: "pending",
  },
  {
    id: "p3",
    channel: "sms",
    cluster: "Low-income All Ages",
    message: "Tip: schaakavond do 19:00, Crooswijk. Goed gezelschap, gratis.",
    statusLabel: "Pending Approval",
    statusTone: "pending",
  },
  {
    id: "p4",
    channel: "leaflet",
    cluster: "Elderly Low-Digital",
    message: "Print-ready PDF generated",
    statusLabel: "Ready to Print",
    statusTone: "ready",
    isPdf: true,
  },
];

export const IMPACT_PROJECTION: ImpactPoint[] = [
  { week: 1, score: 58 },
  { week: 2, score: 61 },
  { week: 3, score: 65 },
  { week: 4, score: 68 },
  { week: 5, score: 71 },
  { week: 6, score: 74 },
];

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
