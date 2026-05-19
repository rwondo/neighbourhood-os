import { jsonAgentCall } from "@/lib/together";
import { writeOutcome } from "@/lib/supermemory";
import { makeLogger } from "@/lib/log";
import { OUTCOME_SYSTEM } from "./prompts";

const log = makeLogger("agent:outcome");

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
}): Promise<OutcomeOut | null> {
  const user = `Campaign: ${campaignSummary}
Attended: ${attendance.attended} / Invited: ${attendance.invited}
Return JSON: { estimatedConnections, scoreImpact, notes }`;
  try {
    const o = await jsonAgentCall<OutcomeOut>({ system: OUTCOME_SYSTEM, user });
    try {
      await writeOutcome(buurtCode, o);
    } catch (err) {
      log.warn("writeOutcome failed — outcome computed but not stored", err);
    }
    return o;
  } catch (err) {
    log.error("estimateAndRecord failed", err);
    return null;
  }
}
