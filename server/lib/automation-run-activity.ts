import type { WorkflowActionLog, WorkflowEvent, WorkflowRule, WorkflowRun } from "../../shared/schema";
import { attachmentActivity, privateRunSummary } from "./automation-attachment-activity";
import { AUTOMATION_ACTION_POLICY } from "./automation-action-policy";

type ActionEvidence = Pick<WorkflowActionLog, "id" | "actionIndex" | "actionType" | "status" | "executedAt" | "retryCount">;
type Dependencies = {
  rule: (id: string) => Promise<WorkflowRule | undefined>;
  event: (id: string) => Promise<WorkflowEvent | undefined>;
  canRead: (rule: WorkflowRule, event: WorkflowEvent, viewer: string) => Promise<unknown>;
  actions: (id: string) => Promise<ActionEvidence[]>;
};

const states = new Set(["success", "failed", "skipped", "running", "pending"]);
const reasons = new Set(["condition_false", "loop_guard", "analysis_source_not_eligible",
  "analysis_trigger_unknown", "analysis_trigger_not_matched", "analysis_condition_unknown",
  "run_limit_reached", "duplicate_event"]);

export function safeRunSummary(run: WorkflowRun) {
  return { ...privateRunSummary(run), status: states.has(run.status) ? run.status : "unknown",
    skippedReason: run.skippedReason && reasons.has(run.skippedReason) ? run.skippedReason : null };
}

/** Logs are evidence of what executed, not the rule's current action definitions. */
export function safeActionLog(action: ActionEvidence) {
  return {
    id: action.id,
    actionIndex: Number.isSafeInteger(action.actionIndex) && action.actionIndex >= 0 ? action.actionIndex : 0,
    actionType: Object.hasOwn(AUTOMATION_ACTION_POLICY, action.actionType) ? action.actionType : "unknown",
    status: states.has(action.status) ? action.status : "unknown",
    executedAt: action.executedAt,
    retryCount: Number.isSafeInteger(action.retryCount) && action.retryCount >= 0 ? action.retryCount : 0,
  };
}

/** Every branch is an allowlist. Neither source access nor an admin role exposes raw diagnostics. */
export async function runActivity(run: WorkflowRun, viewer: string, deps: Dependencies) {
  const hidden = { run: safeRunSummary(run), actions: [], event: null,
    sourceAccess: "unavailable" as const };
  try {
    const rule = await deps.rule(run.ruleId);
    // A later edit to the rule must never reclassify historical execution evidence.
    const payload = run.payload as any;
    const analyzed = Boolean(payload?.analysis || payload?.rule?.trigger?.analysis);
    const event = run.eventId ? await deps.event(run.eventId)
      : payload?.source === "schedule" ? {
        source: "schedule", module: payload.module, entityType: payload.entityType,
        entityId: payload.entityId, eventType: payload.eventType, countryCode: payload.countryCode,
      } as WorkflowEvent : undefined;
    if (!rule || !event || !await deps.canRead(rule, event, viewer)) return {
      ...hidden, ...(analyzed ? { attachmentAnalysis: { status: "unavailable" as const, outcomes: [] } } : {}),
    };
    const actions = (await deps.actions(run.id)).map(safeActionLog);
    const attachmentAnalysis = analyzed ? await attachmentActivity(run, viewer, {
      rule: async () => rule, event: async () => event, canRead: async () => true,
    }) : undefined;
    return { run: safeRunSummary(run), actions, event: null, sourceAccess: "available" as const,
      ...(attachmentAnalysis ? { attachmentAnalysis } : {}) };
  } catch {
    return hidden;
  }
}
