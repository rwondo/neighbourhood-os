/**
 * CDI risk-band color palette for borough/buurt fills.
 *
 * Maps the API's `riskLevelCDI` color tokens to hex values that match the
 * saturation of the legacy `colorForScore` palette in `src/lib/mock-data.ts`.
 *
 * Absolute CDI bands (see riskLevelCDI in src/lib/score.ts):
 *   - low      0-30   -> green
 *   - moderate 30-50  -> yellow
 *   - high     50-70  -> orange
 *   - severe   70-100 -> red
 */

export type CdiColorToken = "green" | "yellow" | "orange" | "red";

const BASE: Record<CdiColorToken, string> = {
  green: "#059669",
  yellow: "#ca8a04",
  orange: "#d97706",
  red: "#dc2626",
};

const HOVER: Record<CdiColorToken, string> = {
  green: "#10b981",
  yellow: "#eab308",
  orange: "#f59e0b",
  red: "#ef4444",
};

export function cdiColorHex(token: CdiColorToken): string {
  return BASE[token];
}

export function cdiHoverColorHex(token: CdiColorToken): string {
  return HOVER[token];
}
