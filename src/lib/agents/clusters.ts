import type { BuurtRecord, Channel, ResidentCluster } from "@/lib/types";

type ClusterCandidate = {
  priority: number;
  cluster: ResidentCluster;
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function estSize(n: BuurtRecord, share: number): number {
  // Estimated cluster size derived from buurt-scale demographics. We don't have
  // a population column on neighbourhoods, so we approximate from CDI inputs by
  // assuming a typical Dutch buurt of ~3,500 households (~7,000 residents).
  const baseResidents = 7000;
  return Math.max(40, Math.round(baseResidents * clamp(share, 0.02, 0.6)));
}

export function identifyClusters(n: BuurtRecord): ResidentCluster[] {
  const candidates: ClusterCandidate[] = [];

  // Elderly 65+
  if (n.pctElderly65 >= 12) {
    const lowDigital = n.pctElderly65 >= 22;
    const channel: Channel = lowDigital ? "leaflet" : "sms";
    candidates.push({
      priority: n.pctElderly65 * 1.4,
      cluster: {
        id: "cluster_elderly",
        profile: lowDigital ? "Elderly 65+, low digital literacy" : "Elderly 65+, moderate digital",
        ageRange: [65, 90],
        digitalLiteracy: lowDigital ? "low" : "medium",
        preferredChannel: channel,
        language: ["nl"],
        estimatedSize: estSize(n, n.pctElderly65 / 100),
        notes: lowDigital
          ? "Unreachable via digital — print-ready leaflet through municipal postal run."
          : "Reads SMS daily, watches Facebook occasionally.",
      },
    });
  }

  // Single-adult households (living alone, working age)
  if (n.pctLivingAlone >= 22) {
    candidates.push({
      priority: n.pctLivingAlone * 1.1,
      cluster: {
        id: "cluster_singles",
        profile: "Single-adult households, working age",
        ageRange: [30, 55],
        digitalLiteracy: "high",
        preferredChannel: "whatsapp",
        language: ["nl", "en"],
        estimatedSize: estSize(n, Math.max(0, (n.pctLivingAlone - n.pctElderly65 * 0.6) / 100)),
        notes: "High WhatsApp usage; values low-friction local recommendations.",
      },
    });
  }

  // Single parents
  if (n.pctSingleParent >= 6) {
    candidates.push({
      priority: n.pctSingleParent * 1.6,
      cluster: {
        id: "cluster_single_parents",
        profile: "Single parents, time-constrained",
        ageRange: [28, 48],
        digitalLiteracy: "high",
        preferredChannel: "facebook",
        language: ["nl"],
        estimatedSize: estSize(n, n.pctSingleParent / 100),
        notes: "Facebook parent groups remain the dominant channel in NL.",
      },
    });
  }

  // Low-income, all ages
  if (n.lowIncomeIndex >= 25) {
    candidates.push({
      priority: n.lowIncomeIndex * 0.9,
      cluster: {
        id: "cluster_low_income",
        profile: "Low-income, mixed ages",
        ageRange: [25, 70],
        digitalLiteracy: "medium",
        preferredChannel: "sms",
        language: ["nl"],
        estimatedSize: estSize(n, n.lowIncomeIndex / 200),
        notes: "Smartphone access uneven; SMS is near-universal and free to receive.",
      },
    });
  }

  // Young adults (heuristic: under-35 share approximated from inverse elderly)
  // We don't have direct young-adult share, but high turnover + low elderly is a fair proxy
  const youngAdultLikelihood = clamp(100 - n.pctElderly65 - n.lowIncomeIndex / 2, 0, 100);
  if (youngAdultLikelihood >= 55 || n.populationTurnover >= 12) {
    candidates.push({
      priority: youngAdultLikelihood * 0.55,
      cluster: {
        id: "cluster_young_adults",
        profile: "Young adults 18–35",
        ageRange: [18, 35],
        digitalLiteracy: "high",
        preferredChannel: "tiktok",
        language: ["nl", "en"],
        estimatedSize: estSize(n, youngAdultLikelihood / 250),
        notes: "Spend most attention on TikTok and Instagram, not Facebook.",
      },
    });
  }

  // International / mobile residents (high population turnover)
  if (n.populationTurnover >= 10) {
    candidates.push({
      priority: n.populationTurnover * 0.8,
      cluster: {
        id: "cluster_internationals",
        profile: "International students & recent movers",
        ageRange: [19, 32],
        digitalLiteracy: "high",
        preferredChannel: "instagram",
        language: ["en", "nl"],
        estimatedSize: estSize(n, n.populationTurnover / 200),
        notes: "Visual content converts; defaults to English; high WhatsApp penetration.",
      },
    });
  }

  // Always-on fallback so we never emit fewer than 3 clusters
  candidates.push({
    priority: 5,
    cluster: {
      id: "cluster_general",
      profile: "Mixed adult residents",
      ageRange: [25, 65],
      digitalLiteracy: "high",
      preferredChannel: "whatsapp",
      language: ["nl"],
      estimatedSize: estSize(n, 0.12),
      notes: "Broad-reach baseline cluster for routine activity invitations.",
    },
  });

  // Dedupe by id, keep highest-priority entries, return top 3
  const seen = new Map<string, ClusterCandidate>();
  for (const c of candidates) {
    const prev = seen.get(c.cluster.id);
    if (!prev || c.priority > prev.priority) seen.set(c.cluster.id, c);
  }
  return [...seen.values()]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3)
    .map((c) => c.cluster);
}
