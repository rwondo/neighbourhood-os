import { jsonAgentCall } from "@/lib/together";
import { writeOutcome } from "@/lib/supermemory";
import { OUTCOME_SYSTEM } from "./prompts";

type OutcomeOut = {
  estimatedConnections: number;
  scoreImpact: number;
  notes: string;
};

export async function estimateAndRecord({
  buurtCode,
  campaignSummary,
  attendance,
}: {
  buurtCode: string;
  campaignSummary: string;
  attendance: { attended: number; invited: number };
}) {
  const user = `Campaign: ${campaignSummary}
Attended: ${attendance.attended} / Invited: ${attendance.invited}
Return JSON: { estimatedConnections, scoreImpact, notes }`;
  const o = await jsonAgentCall<OutcomeOut>({ system: OUTCOME_SYSTEM, user });
  await writeOutcome(buurtCode, o);
  return o;
}
