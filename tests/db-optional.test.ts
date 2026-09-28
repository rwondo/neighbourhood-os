import { test } from "node:test";
import assert from "node:assert/strict";

test("importing the DB module without DATABASE_URL does not throw; querying does", async () => {
  // dotenv never overrides variables that are already set, so an empty value
  // keeps a developer's .env out of this test.
  process.env.DATABASE_URL = "";
  const { getDb, DatabaseNotConfiguredError } = await import("@/lib/db");
  assert.throws(() => getDb(), DatabaseNotConfiguredError);
});
