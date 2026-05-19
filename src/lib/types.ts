export type CityKey = "rotterdam" | "amsterdam" | "denhaag";
export type RiskLevel = "high-isolation" | "at-risk" | "healthy";
export type Channel = "whatsapp" | "sms" | "facebook" | "instagram" | "tiktok" | "leaflet";
export type Trend = "up" | "down" | "flat";
export type CampaignStatus = "draft" | "pending" | "approved" | "sent" | "completed";

export type DigitalLiteracy = "low" | "medium" | "high";

export type ResidentCluster = {
  id: string;
  profile: string;
  ageRange: [number, number];
  digitalLiteracy: DigitalLiteracy;
  preferredChannel: Channel;
  language: string[];
  estimatedSize: number;
  notes?: string;
};

export type RecommendedActivity = {
  name: string;
  description: string;
  venue: string;
  whenISO: string;
  source?: string;
  url?: string;
  targetClusters?: string[];
};

export type InterventionStrategy = {
  neighbourhoodId: string;
  rationale: string;
  activities: RecommendedActivity[];
  clusters: ResidentCluster[];
  predictedScoreGain: number;
  predictedConnections: number;
  costPerConnectionEUR: number;
  weeks: { week: number; score: number }[];
};

export type ClusterMessage = {
  clusterId: string;
  channel: Channel;
  language: string;
  tone: string;
  message: string;
  pdfUrl?: string;
};

export type StepStatus = "active" | "completed" | "skipped" | "error";

export type AgentTraceEvent =
  | { type: "step"; id: string; label: string; status: StepStatus; detail?: string }
  | { type: "log"; message: string }
  | { type: "info"; key: string; value: string | number }
  | { type: "strategy"; strategy: InterventionStrategy }
  | { type: "cluster_message"; message: ClusterMessage }
  | { type: "done" }
  | { type: "error"; message: string };

export type BuurtRecord = {
  id: string;
  city: CityKey;
  buurtCode: string;
  name: string;
  borough: string | null;
  centroidLng: number;
  centroidLat: number;
  pctLivingAlone: number;
  pctElderly65: number;
  pctSingleParent: number;
  lowIncomeIndex: number;
  amenityDistanceKm: number;
  populationTurnover: number;
  weatherIsolation: number;
  socialParticipationDrop: number;
  score: number;
  trend: Trend;
  updatedAt: string;
};

export type BoroughAggregate = {
  borough: string;
  city: CityKey;
  buurtCount: number;
  avgScore: number;
  avgCdi: number;
  riskLevel: "low" | "moderate" | "high" | "severe";
  color: "green" | "yellow" | "orange" | "red";
  avgV?: number;
  avgA?: number;
  avgS?: number;
};
