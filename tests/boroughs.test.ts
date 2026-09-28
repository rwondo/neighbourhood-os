import { test } from "node:test";
import assert from "node:assert/strict";
import { applyQuartileBands, buildBoroughDetail, parseCity } from "@/lib/data/boroughs";
import type { Neighbourhood } from "@/lib/db/schema";
import type { BoroughAggregate } from "@/lib/types";

function aggregates(n: number): BoroughAggregate[] {
  // Worst first, as the SQL query returns them.
  return Array.from({ length: n }, (_, i) => ({
    borough: `B${i}`,
    city: "rotterdam",
    buurtCount: 10,
    avgScore: 40 + i,
    avgCdi: 60 - i,
    riskLevel: "high",
    color: "orange",
  }));
}

const RANK = { severe: 0, high: 1, moderate: 2, low: 3 } as const;

test("quartile bands never get worse further down a worst-first list", () => {
  for (const n of [1, 2, 3, 4, 8, 14]) {
    const banded = applyQuartileBands(aggregates(n));
    assert.equal(banded.length, n);
    assert.equal(banded[0].riskLevel, "severe");
    for (let i = 1; i < n; i++) {
      assert.ok(RANK[banded[i].riskLevel] >= RANK[banded[i - 1].riskLevel], `n=${n} i=${i}`);
    }
  }
});

test("eight boroughs split evenly into four bands", () => {
  const counts = applyQuartileBands(aggregates(8)).reduce<Record<string, number>>((acc, b) => {
    acc[b.color] = (acc[b.color] ?? 0) + 1;
    return acc;
  }, {});
  assert.deepEqual(counts, { red: 2, orange: 2, yellow: 2, green: 2 });
});

function row(i: number, cdi: number): Neighbourhood {
  return {
    id: `BU${i}`,
    city: "amsterdam",
    buurtCode: `BU${i}`,
    name: `Buurt ${i}`,
    centroidLng: 4.9,
    centroidLat: 52.37,
    pctLivingAlone: 40,
    pctElderly65: 10 + i,
    pctSingleParent: 0,
    lowIncomeIndex: 20,
    amenityDistanceKm: 1,
    populationTurnover: 0,
    weatherIsolation: 5,
    socialParticipationDrop: 0,
    score: 100 - cdi,
    cdi,
    borough: "Noord",
    cdiBreakdown: { V: 50, A: 40, S: 30, components: { E: 60, H: 40, PT: 20, W: 30, D: 50, R: 5 } },
    trend: "flat",
    raw: null,
    updatedAt: new Date(0),
    transitStops500m: 3,
    poiLibraries: 1,
    poiCommunityCentres: 0,
    poiParks: 1,
    poiBenches: 4,
    poiCafes: 2,
    poiSports: 0,
    poiIntersections: 12,
  };
}

test("borough detail averages buurten, sums infrastructure and ranks the borough", () => {
  const rows = [40, 70, 55, 30, 65, 50].map((cdi, i) => row(i, cdi));
  const detail = buildBoroughDetail({
    city: "amsterdam",
    borough: "Noord",
    rows,
    cityRanking: ["Zuidoost", "Noord", "West"],
  });
  assert.equal(detail.buurtCount, 6);
  assert.equal(detail.avgCdi, 51.7);
  assert.equal(detail.rankInCity, 2);
  assert.equal(detail.totalBoroughs, 3);
  assert.equal(detail.infrastructure.transitStops500m, 18);
  assert.equal(detail.components.V, 50);
  assert.equal(detail.topBuurten.length, 5);
  assert.deepEqual(
    detail.topBuurten.map((b) => b.cdi),
    [70, 65, 55, 50, 40],
  );
});

test("parseCity accepts the three cities only", () => {
  assert.equal(parseCity("denhaag"), "denhaag");
  assert.equal(parseCity("utrecht"), null);
  assert.equal(parseCity(null), null);
});
