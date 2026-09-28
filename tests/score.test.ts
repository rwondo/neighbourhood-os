import { test } from "node:test";
import assert from "node:assert/strict";
import {
  colorForCDI,
  computeCDIBreakdown,
  computeCityStats,
  riskLevelCDI,
  type CDIInputs,
} from "@/lib/score";

const base: CDIInputs = {
  pctElderly65: 15,
  pctLivingAlone: 40,
  amenityDistanceKm: 1,
  weatherIsolation: 5,
  transitStops500m: 10,
  poiLibraries: 1,
  poiCommunityCentres: 1,
  poiParks: 2,
  poiBenches: 10,
  poiCafes: 5,
  poiSports: 1,
  poiIntersections: 20,
};

const worst: CDIInputs = {
  ...base,
  pctElderly65: 35,
  pctLivingAlone: 70,
  amenityDistanceKm: 3,
  transitStops500m: 0,
  poiLibraries: 0,
  poiCommunityCentres: 0,
  poiParks: 0,
  poiBenches: 0,
  poiCafes: 0,
  poiSports: 0,
  poiIntersections: 0,
};

const best: CDIInputs = {
  ...base,
  pctElderly65: 5,
  pctLivingAlone: 20,
  amenityDistanceKm: 0.2,
  transitStops500m: 40,
  poiLibraries: 3,
  poiCommunityCentres: 3,
  poiParks: 6,
  poiBenches: 40,
  poiCafes: 20,
  poiSports: 4,
  poiIntersections: 80,
};

const city = [worst, base, best];
const stats = computeCityStats(city);

test("CDI and its sub-scores stay within 0-100", () => {
  for (const b of city) {
    const r = computeCDIBreakdown(b, stats);
    for (const v of [r.cdi, r.V, r.A, r.S, ...Object.values(r.components)]) {
      assert.ok(v >= 0 && v <= 100, `value ${v} out of range`);
    }
  }
});

test("min-max normalisation puts the extremes of a city at 0 and 100", () => {
  const w = computeCDIBreakdown(worst, stats);
  const b = computeCDIBreakdown(best, stats);
  assert.equal(w.components.E, 100);
  assert.equal(b.components.E, 0);
  assert.equal(w.S, 0);
  assert.equal(b.S, 100);
});

test("the worst buurt scores a higher CDI than the best", () => {
  assert.ok(computeCDIBreakdown(worst, stats).cdi > computeCDIBreakdown(best, stats).cdi);
});

test("more transit stops and crossings lower the access barrier (reverse coding)", () => {
  const more = computeCDIBreakdown({ ...base, transitStops500m: 40, poiIntersections: 80 }, stats);
  const fewer = computeCDIBreakdown({ ...base, transitStops500m: 0, poiIntersections: 0 }, stats);
  assert.ok(more.components.PT < fewer.components.PT);
  assert.ok(more.components.W < fewer.components.W);
  assert.ok(more.A < fewer.A);
});

test("more social infrastructure lowers the CDI", () => {
  const rich = computeCDIBreakdown({ ...base, poiLibraries: 3, poiCommunityCentres: 3 }, stats);
  const poor = computeCDIBreakdown({ ...base, poiLibraries: 0, poiCommunityCentres: 0 }, stats);
  assert.ok(rich.S > poor.S);
  assert.ok(rich.cdi < poor.cdi);
});

test("identical buurten normalise to the midpoint", () => {
  const same = computeCityStats([base, base]);
  const r = computeCDIBreakdown(base, same);
  assert.equal(r.components.E, 50);
  assert.equal(r.components.H, 50);
});

test("weather isolation is clamped to 100", () => {
  assert.equal(computeCDIBreakdown({ ...base, weatherIsolation: 500 }, stats).components.R, 100);
});

test("risk bands and colours switch at 30, 50 and 70", () => {
  assert.equal(riskLevelCDI(29.99), "low");
  assert.equal(riskLevelCDI(30), "moderate");
  assert.equal(riskLevelCDI(49.99), "moderate");
  assert.equal(riskLevelCDI(50), "high");
  assert.equal(riskLevelCDI(69.99), "high");
  assert.equal(riskLevelCDI(70), "severe");
  assert.equal(colorForCDI(10), "green");
  assert.equal(colorForCDI(85), "red");
});
