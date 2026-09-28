import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// Force static mode before any route module is loaded (dynamic imports below,
// so this assignment runs first).
process.env.STATIC_SNAPSHOT = "1";

test("GET /api/boroughs serves the snapshot in static mode", async () => {
  const { GET } = await import("@/app/api/boroughs/route");
  const res = await GET(new NextRequest("http://localhost/api/boroughs?city=amsterdam"));
  assert.equal(res.status, 200);
  const body = (await res.json()) as { boroughs: unknown[] };
  assert.ok(Array.isArray(body.boroughs));
});

test("GET /api/boroughs rejects an unknown city", async () => {
  const { GET } = await import("@/app/api/boroughs/route");
  const res = await GET(new NextRequest("http://localhost/api/boroughs?city=utrecht"));
  assert.equal(res.status, 400);
});

test("POST /api/simulate answers 503 static_mode instead of calling the agents", async () => {
  const { POST } = await import("@/app/api/simulate/route");
  const res = await POST(
    new NextRequest("http://localhost/api/simulate", {
      method: "POST",
      body: JSON.stringify({ borough: "Noord", city: "amsterdam" }),
    }),
  );
  assert.equal(res.status, 503);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, "static_mode");
});
