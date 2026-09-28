import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { validateSnapshot } from "@/lib/data/validate-snapshot";
import type { StaticSnapshot } from "@/lib/types";

const read = (p: string) => JSON.parse(readFileSync(path.resolve(process.cwd(), p), "utf-8"));

test("the committed static snapshot covers every residential borough on the map", () => {
  const snapshot = read("src/lib/data/static-snapshot.json") as StaticSnapshot;
  const shapes = read("public/boroughs.geojson");
  assert.deepEqual(validateSnapshot(snapshot, shapes), []);
});
