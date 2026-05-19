import { NOORD_SNAPSHOT } from "./noord";
import type { DemoSnapshot } from "./types";
import type { ApprovalResult } from "@/components/dashboard/activity-approval-dialog";

// Registry of pre-canned boroughs. Each entry is keyed by `${city}::${borough}`
// for unambiguous lookup (boroughs can repeat across cities — e.g. Noord exists
// in multiple Dutch municipalities).
const REGISTRY: DemoSnapshot[] = [NOORD_SNAPSHOT];

function keyFor(city: string, borough: string): string {
  return `${city.toLowerCase()}::${borough.toLowerCase()}`;
}

const BY_KEY = new Map(REGISTRY.map((s) => [keyFor(s.city, s.borough), s]));

/** Returns the demo snapshot for a given borough+city, or null if not registered. */
export function getDemoSnapshot(borough: string | null, city: string | null): DemoSnapshot | null {
  if (!borough || !city) return null;
  return BY_KEY.get(keyFor(city, borough)) ?? null;
}

/** All registered demo borough+city combos. Useful for surfacing them in chrome. */
export function listDemoBoroughs(): { borough: string; city: string }[] {
  return REGISTRY.map((s) => ({ borough: s.borough, city: s.city }));
}

/**
 * Reads the active demo-mode flag from the browser URL (`?demo=1`, `?demo=noord`,
 * or `?demo=*`). Returns the raw value so callers can scope to a specific borough.
 * Empty/absent → null. Always null on the server.
 */
export function readDemoFlag(): string | null {
  if (typeof window === "undefined") return null;
  const sp = new URLSearchParams(window.location.search);
  const v = sp.get("demo");
  if (!v) return null;
  return v.trim().toLowerCase();
}

/**
 * Resolves whether to use a snapshot for the given target.
 * - `?demo=1` or `?demo=on` → use snapshot if registered
 * - `?demo=<borough>` → only use snapshot when borough matches
 * - no flag → never use snapshot
 */
export function resolveDemoSnapshot(borough: string | null, city: string | null): DemoSnapshot | null {
  const flag = readDemoFlag();
  if (!flag) return null;
  const snapshot = getDemoSnapshot(borough, city);
  if (!snapshot) return null;
  if (flag === "1" || flag === "on" || flag === "true" || flag === "*") return snapshot;
  return flag === snapshot.borough.toLowerCase() ? snapshot : null;
}

/** Look up the preset ApprovalResult for an activity within a snapshot. */
export function approvalForActivity(snapshot: DemoSnapshot, activityName: string): ApprovalResult {
  return snapshot.approval.byActivityName[activityName] ?? snapshot.approval.default;
}

export type { DemoSnapshot };
