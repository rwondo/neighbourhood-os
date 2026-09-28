import { test } from "node:test";
import assert from "node:assert/strict";
import { identifyClusters } from "@/lib/agents/clusters";
import type { BuurtRecord } from "@/lib/types";

function buurt(overrides: Partial<BuurtRecord>): BuurtRecord {
  return {
    id: "BU0000",
    city: "rotterdam",
    buurtCode: "BU0000",
    name: "Test",
    borough: "Test",
    centroidLng: 0,
    centroidLat: 0,
    pctLivingAlone: 0,
    pctElderly65: 0,
    pctSingleParent: 0,
    lowIncomeIndex: 0,
    amenityDistanceKm: 0,
    populationTurnover: 0,
    weatherIsolation: 0,
    socialParticipationDrop: 0,
    score: 50,
    trend: "flat",
    updatedAt: new Date(0),
    ...overrides,
  };
}

test("returns one to three clusters with unique ids and a minimum size", () => {
  for (const b of [
    buurt({}),
    buurt({ pctElderly65: 30, pctLivingAlone: 45, lowIncomeIndex: 40 }),
    buurt({ pctElderly65: 15, pctLivingAlone: 25 }),
  ]) {
    const clusters = identifyClusters(b);
    assert.ok(clusters.length >= 1 && clusters.length <= 3, `${clusters.length} clusters`);
    assert.equal(new Set(clusters.map((c) => c.id)).size, clusters.length);
    for (const c of clusters) assert.ok(c.estimatedSize >= 40);
  }
});

test("a very old buurt gets a low-digital elderly cluster reached by leaflet", () => {
  const elderly = identifyClusters(buurt({ pctElderly65: 30 })).find(
    (c) => c.id === "cluster_elderly",
  );
  assert.ok(elderly);
  assert.equal(elderly.preferredChannel, "leaflet");
  assert.equal(elderly.digitalLiteracy, "low");
});

test("a moderately old buurt reaches its elderly cluster by SMS", () => {
  const elderly = identifyClusters(buurt({ pctElderly65: 15 })).find(
    (c) => c.id === "cluster_elderly",
  );
  assert.ok(elderly);
  assert.equal(elderly.preferredChannel, "sms");
});

test("a buurt that only crosses the elderly threshold gets elderly + general clusters", () => {
  const ids = identifyClusters(buurt({ pctElderly65: 50, lowIncomeIndex: 10 })).map((c) => c.id);
  assert.deepEqual(ids.sort(), ["cluster_elderly", "cluster_general"].sort());
});
