import type { AgentTraceEvent, CityKey } from "@/lib/types";

export type DemoStreamStep = {
  /** Wall-clock delay before this event is dispatched, ms from the previous step. */
  delayMs: number;
  event: AgentTraceEvent;
};

/** Where a replayed run came from, shown in the UI so a replay is never mistaken for a live run. */
export type DemoProvenance =
  | { kind: "recorded"; capturedAt: string; originalDurationMs: number; buurt: string }
  | { kind: "illustrative"; note: string };

export type DemoSnapshot = {
  /** Borough name as it appears in the boroughs.geojson + DB. Case-sensitive. */
  borough: string;
  city: CityKey;
  provenance: DemoProvenance;
  /** Full sequence of SSE events to replay, with inter-event delays. */
  stream: DemoStreamStep[];
};
