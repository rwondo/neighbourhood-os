import type { RiskLevel, Trend } from "@/lib/types";

// =============================================================================
// Legacy social-fabric scoring (kept for backward compatibility)
// =============================================================================
// The legacy score is direction-inverted vs. CDI: higher = healthier neighbourhood.
// `recalculate/route.ts` and `seed-neighbourhoods.ts` still consume this shape.
// Do not change semantics without updating those callers.

export type ScoreInputs = {
  pctLivingAlone: number;
  pctElderly65: number;
  pctSingleParent: number;
  lowIncomeIndex: number;
  amenityDistanceKm: number;
  populationTurnover: number;
  weatherIsolation: number;
  socialParticipationDrop: number;
};

const WEIGHTS = {
  pctLivingAlone: 0.25,
  pctElderly65: 0.15,
  pctSingleParent: 0.15,
  lowIncomeIndex: 0.1,
  amenityDistanceKm: 0.1,
  populationTurnover: 0.1,
  weatherIsolation: 0.08,
  socialParticipationDrop: 0.07,
};

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function computeSocialFabricScore(inp: ScoreInputs): number {
  const penalty =
    inp.pctLivingAlone * WEIGHTS.pctLivingAlone +
    inp.pctElderly65 * WEIGHTS.pctElderly65 +
    inp.pctSingleParent * WEIGHTS.pctSingleParent +
    inp.lowIncomeIndex * WEIGHTS.lowIncomeIndex +
    inp.amenityDistanceKm * WEIGHTS.amenityDistanceKm +
    inp.populationTurnover * WEIGHTS.populationTurnover +
    inp.weatherIsolation * WEIGHTS.weatherIsolation +
    inp.socialParticipationDrop * WEIGHTS.socialParticipationDrop;
  return clamp(Math.round(100 - penalty), 0, 100);
}

export function riskLevel(score: number): RiskLevel {
  if (score < 60) return "high-isolation";
  if (score < 80) return "at-risk";
  return "healthy";
}

export function compareTrend(prev: number, curr: number): Trend {
  if (curr > prev + 1) return "up";
  if (curr < prev - 1) return "down";
  return "flat";
}

// =============================================================================
// Connection Desert Index (CDI)
// =============================================================================
// CDI is the new headline metric. HIGHER = WORSE (more "connection desert").
// All component scores are 0-100 and produced by min-max normalization
// across a single city's buurten.
//
//   V_i = 0.55·E_i + 0.45·H_i                              (vulnerability)
//   A_i = 0.30·PT_i + 0.25·W_i + 0.30·D_i + 0.15·R_i       (accessibility barrier)
//   S_i = minmaxNorm(infra_points)                          (social infrastructure)
//   CDI = 0.40·V_i + 0.35·A_i + 0.25·(100 - S_i)
//
// We drop T_i (turnover) and M_i (migrant share) from V_i because CBS removed
// them at buurt level; the remaining weights are renormalized
// (0.35/(0.35+0.30) ~= 0.538 -> rounded to 0.55, 0.30/0.65 ~= 0.461 -> 0.45).

export type CDIInputs = {
  pctElderly65: number;
  pctLivingAlone: number;
  amenityDistanceKm: number;
  weatherIsolation: number;
  transitStops500m: number;
  poiLibraries: number;
  poiCommunityCentres: number;
  poiParks: number;
  poiBenches: number;
  poiCafes: number;
  poiSports: number;
  poiIntersections: number;
};

export type CityStats = {
  pctElderly65: { min: number; max: number };
  pctLivingAlone: { min: number; max: number };
  amenityDistanceKm: { min: number; max: number };
  transitStops500m: { min: number; max: number };
  poiIntersections: { min: number; max: number };
  infraPoints: { min: number; max: number };
};

export type CDIRiskLevel = "low" | "moderate" | "high" | "severe";
export type CDIColor = "green" | "yellow" | "orange" | "red";

export type CDIBreakdown = {
  cdi: number;
  V: number;
  A: number;
  S: number;
  components: {
    E: number;
    H: number;
    PT: number;
    W: number;
    D: number;
    R: number;
  };
  risk: CDIRiskLevel;
  color: CDIColor;
};

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function minmaxNorm(v: number, min: number, max: number): number {
  if (max === min) return 50; // degenerate: all equal, return midpoint
  return Math.max(0, Math.min(100, (100 * (v - min)) / (max - min)));
}

function infraPoints(inp: CDIInputs): number {
  return (
    3 * num(inp.poiLibraries) +
    3 * num(inp.poiCommunityCentres) +
    2 * num(inp.poiParks) +
    1 * num(inp.poiCafes) +
    1 * num(inp.poiBenches) +
    2 * num(inp.poiSports)
  );
}

function range(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 0 };
  let min = values[0];
  let max = values[0];
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

export function computeCityStats(buurten: CDIInputs[]): CityStats {
  const elderly = buurten.map((b) => num(b.pctElderly65));
  const alone = buurten.map((b) => num(b.pctLivingAlone));
  const dist = buurten.map((b) => num(b.amenityDistanceKm));
  const stops = buurten.map((b) => num(b.transitStops500m));
  const inters = buurten.map((b) => num(b.poiIntersections));
  const infra = buurten.map((b) => infraPoints(b));
  return {
    pctElderly65: range(elderly),
    pctLivingAlone: range(alone),
    amenityDistanceKm: range(dist),
    transitStops500m: range(stops),
    poiIntersections: range(inters),
    infraPoints: range(infra),
  };
}

export function computeCDIBreakdown(inputs: CDIInputs, stats: CityStats): CDIBreakdown {
  // Vulnerability V_i
  const E = minmaxNorm(num(inputs.pctElderly65), stats.pctElderly65.min, stats.pctElderly65.max);
  const H = minmaxNorm(
    num(inputs.pctLivingAlone),
    stats.pctLivingAlone.min,
    stats.pctLivingAlone.max,
  );
  const V = 0.55 * E + 0.45 * H;

  // Accessibility barrier A_i
  // Reverse-coded inputs (more stops / more intersections => lower barrier):
  const PT =
    100 -
    minmaxNorm(
      num(inputs.transitStops500m),
      stats.transitStops500m.min,
      stats.transitStops500m.max,
    );
  const W =
    100 -
    minmaxNorm(
      num(inputs.poiIntersections),
      stats.poiIntersections.min,
      stats.poiIntersections.max,
    );
  const D = minmaxNorm(
    num(inputs.amenityDistanceKm),
    stats.amenityDistanceKm.min,
    stats.amenityDistanceKm.max,
  );
  const R = Math.max(0, Math.min(100, num(inputs.weatherIsolation)));
  const A = 0.3 * PT + 0.25 * W + 0.3 * D + 0.15 * R;

  // Social infrastructure S_i
  const points = infraPoints(inputs);
  const S = minmaxNorm(points, stats.infraPoints.min, stats.infraPoints.max);

  // CDI: higher = worse
  const cdi = 0.4 * V + 0.35 * A + 0.25 * (100 - S);
  const cdiClamped = Math.max(0, Math.min(100, cdi));

  return {
    cdi: cdiClamped,
    V,
    A,
    S,
    components: { E, H, PT, W, D, R },
    risk: riskLevelCDI(cdiClamped),
    color: colorForCDI(cdiClamped),
  };
}

export function computeCDI(inputs: CDIInputs, stats: CityStats): number {
  return computeCDIBreakdown(inputs, stats).cdi;
}

export function riskLevelCDI(cdi: number): CDIRiskLevel {
  if (cdi < 30) return "low";
  if (cdi < 50) return "moderate";
  if (cdi < 70) return "high";
  return "severe";
}

export function colorForCDI(cdi: number): CDIColor {
  if (cdi < 30) return "green";
  if (cdi < 50) return "yellow";
  if (cdi < 70) return "orange";
  return "red";
}
