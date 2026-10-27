import type { WorkflowEvent, WorkflowRule, WorkflowRun } from "../../shared/schema";
import { attachmentOutcomesForActivity } from "../../shared/automation-attachment-outcomes";

export function privateRunSummary(run: WorkflowRun) {
  return { id: run.id, ruleId: run.ruleId, status: run.status, skippedReason: run.skippedReason,
    startedAt: run.startedAt, finishedAt: run.finishedAt };
}

type Dependencies = {
  rule: (id: string) => Promise<WorkflowRule | undefined>;
  event: (id: string) => Promise<WorkflowEvent | undefined>;
  canRead: (rule: WorkflowRule, event: WorkflowEvent, viewer: string) => Promise<unknown>;
};

/** Read persisted evidence only. Never refresh a mailbox, analyze, or replay actions. */
export async function attachmentActivity(run: WorkflowRun, viewer: string, deps: Dependencies) {
  const unavailable = { status: "unavailable" as const, outcomes: [] };
  try {
    const rule = await deps.rule(run.ruleId);
    const event = run.eventId ? await deps.event(run.eventId) : undefined;
    if (!rule || !event || !await deps.canRead(rule, event, viewer)) return unavailable;
    const analysis = (run.payload as any)?.analysis;
    if (!analysis) return { status: "not_recorded" as const, outcomes: [] };
    return { status: "available" as const, outcomes: attachmentOutcomesForActivity(analysis) };
  } catch {
    // Missing, revoked and failed authorization deliberately have the same response.
    return unavailable;
  }
}
