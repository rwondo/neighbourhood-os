import type {
  AgentTraceEvent,
  CityKey,
  ClusterMessage,
  CreativeStatus,
  InterventionStrategy,
  MCPCampaignStatus,
} from "@/lib/types";
import type { ApprovalResult } from "@/components/dashboard/activity-approval-dialog";

export type DemoStreamStep = {
  /** Wall-clock delay before this event is dispatched, ms from the previous step. */
  delayMs: number;
  event: AgentTraceEvent;
};

export type DemoApprovalPreset = {
  /** Match key: `${activityName}` → preset ApprovalResult for that activity. Falls back to default. */
  byActivityName: Record<string, ApprovalResult>;
  /** Used when the approved activity has no specific preset. */
  default: ApprovalResult;
};

export type DemoSnapshot = {
  /** Borough name as it appears in the boroughs.geojson + DB. Case-sensitive. */
  borough: string;
  city: CityKey;
  /** Full sequence of SSE events to replay, with inter-event delays. */
  stream: DemoStreamStep[];
  /** Preset approval responses keyed by activity name. */
  approval: DemoApprovalPreset;
};

export type { AgentTraceEvent, ClusterMessage, InterventionStrategy, CreativeStatus, MCPCampaignStatus };
