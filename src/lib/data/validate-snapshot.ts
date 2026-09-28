import { CITY_KEYS, INDUSTRIAL_BOROUGHS } from "./boroughs";
import type { StaticSnapshot } from "@/lib/types";

type BoroughFeatures = { features: { properties: { city: string; borough: string } }[] };

const inRange = (v: number) => Number.isFinite(v) && v >= 0 && v <= 100;

/**
 * Sanity checks for the committed snapshot. Returns a list of problems; an
 * empty list means the snapshot covers every residential borough on the map
 * with values in range. Used by the export script and the test suite.
 */
export function validateSnapshot(
  snapshot: StaticSnapshot,
  boroughShapes: BoroughFeatures,
): string[] {
  const problems: string[] = [];
  if (!snapshot.generatedAt) problems.push("generatedAt is empty (placeholder snapshot)");

  for (const city of CITY_KEYS) {
    const data = snapshot.cities[city];
    if (!data) {
      problems.push(`${city}: missing`);
      continue;
    }
    if (data.boroughs.length === 0) problems.push(`${city}: no boroughs`);

    const inSnapshot = new Set(data.boroughs.map((b) => b.borough));
    const onMap = new Set(
      boroughShapes.features
        .filter((f) => f.properties.city === city)
        .map((f) => f.properties.borough)
        .filter((b) => !INDUSTRIAL_BOROUGHS.has(b)),
    );
    for (const b of onMap)
      if (!inSnapshot.has(b)) problems.push(`${city}/${b}: on map but not in snapshot`);
    for (const b of inSnapshot)
      if (!onMap.has(b)) problems.push(`${city}/${b}: in snapshot but not on map`);

    for (const b of data.boroughs) {
      if (!inRange(b.avgCdi))
        problems.push(`${city}/${b.borough}: avgCdi ${b.avgCdi} out of range`);
      const detail = data.details[b.borough];
      if (!detail) {
        problems.push(`${city}/${b.borough}: missing detail`);
        continue;
      }
      for (const [k, v] of Object.entries(detail.components)) {
        if (!inRange(v)) problems.push(`${city}/${b.borough}: component ${k}=${v} out of range`);
      }
      if (detail.topBuurten.length === 0 || detail.topBuurten.length > 5) {
        problems.push(`${city}/${b.borough}: ${detail.topBuurten.length} top buurten`);
      }
    }
  }
  return problems;
}
