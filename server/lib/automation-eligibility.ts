import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { workflowEvents, type WorkflowEvent, type WorkflowRule } from "../../shared/schema";
import { analysisSourceExclusion, type CommunicationAnalysisConfig } from "../../shared/automation-analysis";
import type { AnalysisEligibilityDiagnostic, EligibilitySourceEvent } from "../../shared/automation-eligibility";
import { inspectAnalysisSource } from "./automation-analysis-source";
import { eventRuleExclusion } from "./automation-engine";
import { readAutomationInputHistory } from "./automation-input-history";

/** Explicit inspection only: no ingress, event publication, dry run, AI, Graph, or actions. */
export async function diagnoseAnalysisEligibility(rule: WorkflowRule, viewerId: string,
  sourceId: string, sourceEvent: EligibilitySourceEvent): Promise<AnalysisEligibilityDiagnostic> {
  const probe = { module: "communication", eventType: sourceEvent, entityId: sourceId } as WorkflowEvent;
  // Check the viewer independently, even for admins: private chat still requires participation.
  // Missing and inaccessible originals deliberately share one answer to prevent existence leaks.
  const viewerSource = await inspectAnalysisSource(rule, probe, viewerId);
  if (!viewerSource) return { reasons: ["source_unavailable"], countryUnknown: false,
    history: { status: "unavailable", permissions: "unknown" } };
  const authorSource = await inspectAnalysisSource(rule, probe);
  const [event] = await db.select().from(workflowEvents).where(and(
    eq(workflowEvents.module, "communication"), eq(workflowEvents.entityId, sourceId),
    eq(workflowEvents.eventType, sourceEvent),
  )).orderBy(desc(workflowEvents.createdAt), desc(workflowEvents.id)).limit(1);
  const reasons: AnalysisEligibilityDiagnostic["reasons"] = [];
  if (!authorSource) reasons.push("creator_restricted");
  if (!event) reasons.push("event_missing");
  else {
    const reason = eventRuleExclusion(rule, event);
    if (reason) reasons.push(reason);
  }
  const filter = authorSource && analysisSourceExclusion((rule.trigger as any).analysis as CommunicationAnalysisConfig, authorSource);
  if (filter) reasons.push(filter);
  return { reasons: reasons.length ? reasons : ["eligible"], countryUnknown: !!event && !event.countryCode,
    history: await readAutomationInputHistory(rule.id, event) };
}
