import { env } from "@/lib/env";

const TABLE = "85618NED";

// Buurten below these thresholds are industrial / harbour / barely-inhabited
// areas where percentages are statistically meaningless (e.g. Westpoort with
// ~5 residents all in single-person households -> 100% living alone). We still
// emit a row so the map can show them, but downstream code should skip them
// when computing city-wide min/max for normalisation.
export const LOW_SIGNAL_MIN_RESIDENTS = 50;
export const LOW_SIGNAL_MIN_HOUSEHOLDS = 25;

// Hard ceiling for percent-living-alone on otherwise-valid buurten. Real
// residential neighbourhoods top out around 70-75%; 85 is a generous safety
// cap to keep one or two edge cases from skewing the city normaliser.
export const PCT_LIVING_ALONE_CAP = 85;

export type CBSBuurtRow = {
  buurtCode: string;
  name: string;
  gemeenteCode: string;
  pctLivingAlone: number;
  pctElderly65: number;
  pctSingleParent: number;
  lowIncomeIndex: number;
  amenityDistanceKm: number;
  populationTurnover: number;
  centroidLng: number;
  centroidLat: number;
  // Transparency fields so callers can audit / display.
  totalResidents: number;
  totalHouseholds: number;
  // True if the buurt is below either population threshold. When true, the
  // percentage fields are emitted as NaN and must NOT be fed into per-city
  // min-max stats. Downstream CDI uses a neutral fallback (cdi=50).
  lowSignal: boolean;
};

const PAGE = 2000;

export async function fetchCbsBuurten(gemeenteCodes: string[]): Promise<CBSBuurtRow[]> {
  const base = env.CBS_BASE_URL();
  const all: CBSBuurtRow[] = [];
  for (const code of gemeenteCodes) {
    const prefix = `BU${code}`;
    let skip = 0;
    while (true) {
      const filter = `startswith(WijkenEnBuurten,'${prefix}')`;
      const url = `${base}/${TABLE}/TypedDataSet?$filter=${encodeURIComponent(filter)}&$top=${PAGE}&$skip=${skip}&$format=json`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`CBS ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { value: Record<string, unknown>[] };
      const page = data.value ?? [];
      for (const row of page) {
        const mapped = mapCbsRow(row);
        if (mapped) all.push(mapped);
      }
      if (page.length < PAGE) break;
      skip += PAGE;
    }
  }
  return all;
}

function mapCbsRow(r: Record<string, unknown>): CBSBuurtRow | null {
  const buurtCode = String(r["WijkenEnBuurten"] ?? "").trim();
  if (!buurtCode || !buurtCode.startsWith("BU") || buurtCode.length < 6) return null;
  const gemeenteCode = buurtCode.slice(2, 6);
  const name = pickName(r) ?? buurtCode;
  const num = (k: string) => {
    const v = r[k];
    if (v === null || v === undefined) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const pct = (countKey: string, totalKey: string) => {
    const c = num(countKey);
    const t = num(totalKey);
    return t > 0 ? (c / t) * 100 : 0;
  };

  const totalResidents = num("AantalInwoners_5");
  const totalHouseholds = num("HuishoudensTotaal_29");
  const lowSignal =
    totalResidents < LOW_SIGNAL_MIN_RESIDENTS || totalHouseholds < LOW_SIGNAL_MIN_HOUSEHOLDS;

  // Raw percentages from CBS, then cap pctLivingAlone for non-flagged rows.
  const rawLivingAlone = pct("Eenpersoonshuishoudens_30", "HuishoudensTotaal_29");
  const rawElderly = pct("k_65JaarOfOuder_12", "AantalInwoners_5");

  // Low-signal rows emit NaN so downstream consumers know to skip them in
  // city-wide normalisation (NaN-aware filters work uniformly).
  const pctLivingAlone = lowSignal ? Number.NaN : Math.min(rawLivingAlone, PCT_LIVING_ALONE_CAP);
  const pctElderly65 = lowSignal ? Number.NaN : rawElderly;

  return {
    buurtCode,
    name,
    gemeenteCode,
    pctLivingAlone,
    pctElderly65,
    pctSingleParent: 0,
    lowIncomeIndex: num("HuishoudensMetEenLaagInkomen_87"),
    amenityDistanceKm: num("AfstandTotHuisartsenpraktijk_115"),
    populationTurnover: 0,
    centroidLng: 0,
    centroidLat: 0,
    totalResidents,
    totalHouseholds,
    lowSignal,
  };
}

function pickName(r: Record<string, unknown>): string | null {
  const candidates = ["WijkenEnBuurten_8", "Naam_2", "Naam_33", "Gemeentenaam_1"];
  for (const key of candidates) {
    const v = r[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export const GEMEENTE_CODES = {
  rotterdam: "0599",
  amsterdam: "0363",
  denhaag: "0518",
} as const;
