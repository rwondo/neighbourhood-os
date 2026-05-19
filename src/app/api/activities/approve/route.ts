import { NextRequest, NextResponse } from "next/server";
import { makeLogger } from "@/lib/log";

const log = makeLogger("api:activities/approve");

export const runtime = "nodejs";

type ApprovePayload = {
  activity?: {
    name?: string;
    venue?: string;
    whenISO?: string;
    source?: string;
    targetClusters?: string[];
  };
  borough?: string;
  city?: string;
};

// Stub endpoint — front of the future creative-generation + event-research agent.
// Returns a deterministic dispatch id so the UI can show "approved · queued".
// When the real agent lands, replace the body with the dispatch call.
export async function POST(req: NextRequest) {
  let payload: ApprovePayload = {};
  try {
    payload = (await req.json()) as ApprovePayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const name = payload.activity?.name ?? "unnamed activity";
  const dispatchId = `disp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  log.info("activity approved — dispatching agent stub", {
    dispatchId,
    activity: name,
    venue: payload.activity?.venue,
    when: payload.activity?.whenISO,
    targetClusters: payload.activity?.targetClusters ?? [],
    borough: payload.borough,
    city: payload.city,
  });
  return NextResponse.json({
    ok: true,
    dispatchId,
    queuedAt: new Date().toISOString(),
    nextSteps: [
      "creative generation for each target cluster channel",
      "venue and timing verification",
      "audience reachability estimate",
    ],
  });
}
