import assert from "node:assert/strict";
import { test } from "node:test";
import { runActivity, safeActionLog, safeRunSummary } from "./automation-run-activity";
import type { WorkflowActionLog, WorkflowEvent, WorkflowRule, WorkflowRun } from "../../shared/schema";

const run = {
  id: "run", ruleId: "rule", eventId: "event", status: "failed", skippedReason: null,
  startedAt: new Date(), finishedAt: new Date(), error: "PRIVATE vendor",
  payload: { event: { content: "PRIVATE message" }, rule: { actions: [{ config: "PRIVATE" }] } },
  actionResults: [{ output: "/internal/PRIVATE" }], causationChain: ["PRIVATE"],
} as unknown as WorkflowRun;
const action = {
  id: "action", runId: "run", actionIndex: 0, actionType: "send_email", status: "failed",
  executedAt: new Date(), retryCount: 2, error: "PRIVATE vendor error",
  output: { body: "PRIVATE recipient body", path: "/internal/PRIVATE" },
} as WorkflowActionLog;
const rule = { id: "rule", trigger: { type: "event" } } as WorkflowRule;
const event = { id: "event", module: "communication", eventType: "chat.received", entityId: "PRIVATE" } as WorkflowEvent;
const deps = {
  rule: async () => rule, event: async () => event,
  canRead: async (_rule: WorkflowRule, _event: WorkflowEvent, viewer: string) => viewer === "participant",
  actions: async () => [action],
};

test("non-analysis runs expose persisted action states and times, never payloads, errors or source IDs", async () => {
  const detail = await runActivity(run, "participant", deps);
  assert.equal(detail.sourceAccess, "available");
  assert.deepEqual(detail.actions, [{ id: action.id, actionIndex: 0, actionType: "send_email",
    status: "failed", executedAt: action.executedAt, retryCount: 2 }]);
  assert.equal(detail.event, null);
  assert.doesNotMatch(JSON.stringify(detail), /PRIVATE|internal|payload|error|output|causation|entityId/);
});

test("denial, removed event, removed rule and failed authorization all hide action evidence", async () => {
  let actionReads = 0;
  const tracked = { ...deps, actions: async () => { actionReads++; return [action]; } };
  for (const detail of [
    await runActivity(run, "outsider-admin", tracked),
    await runActivity(run, "participant", { ...tracked, event: async () => undefined }),
    await runActivity(run, "participant", { ...tracked, rule: async () => undefined }),
    await runActivity(run, "participant", { ...tracked, canRead: async () => { throw new Error("PRIVATE"); } }),
  ]) {
    assert.equal(detail.sourceAccess, "unavailable");
    assert.deepEqual(detail.actions, []);
    assert.equal(detail.event, null);
    assert.doesNotMatch(JSON.stringify(detail), /PRIVATE|internal/);
  }
  assert.equal(actionReads, 0);
});

test("editing current rule to analysis does not rewrite non-analysis historical runs", async () => {
  const detail = await runActivity(run, "participant", {
    ...deps, rule: async () => ({ ...rule, trigger: { analysis: { channels: ["email"] } } }),
  });
  assert.equal(detail.sourceAccess, "available");
  assert.equal(detail.actions.length, 1);
  assert.equal("attachmentAnalysis" in detail, false);
  const analyzed = await runActivity({ ...run, payload: { analysis: {
    attachmentOutcomes: [{ position: 1, result: "invoice" }], summary: "PRIVATE",
  } } }, "participant", deps);
  assert.deepEqual(analyzed.attachmentAnalysis, { status: "available", outcomes: [{ position: 1, result: "invoice" }] });
});

test("every read reauthorizes the persisted event, never the current rule's event or cached payload", async () => {
  let permitted = true;
  const guarded = { ...deps, canRead: async (_rule: WorkflowRule, actual: WorkflowEvent) => {
    assert.equal(actual, event);
    return permitted;
  } };
  assert.equal((await runActivity(run, "participant", guarded)).sourceAccess, "available");
  permitted = false;
  assert.equal((await runActivity(run, "participant", guarded)).sourceAccess, "unavailable");
});

test("untrusted historic status, skipped reason and action type cannot become diagnostic text", () => {
  assert.equal(safeRunSummary({ ...run, status: "PRIVATE", skippedReason: "/internal/PRIVATE" }).status, "unknown");
  assert.equal(safeRunSummary({ ...run, skippedReason: "PRIVATE" }).skippedReason, null);
  assert.deepEqual(safeActionLog({ ...action, status: "PRIVATE", actionType: "PRIVATE", retryCount: -1, actionIndex: -1 }),
    { id: "action", actionIndex: 0, actionType: "unknown", status: "unknown", executedAt: action.executedAt, retryCount: 0 });
});

test("scheduled evidence uses only the persisted schedule context, with no guessed ordinary event", async () => {
  const scheduled = { ...run, eventId: null, payload: { source: "schedule", module: "task",
    entityType: "task", entityId: "source", countryCode: "SK", newValues: { content: "PRIVATE" } } };
  let checked = false;
  const detail = await runActivity(scheduled, "participant", { ...deps, canRead: async (_rule, source) => {
    checked = true;
    assert.equal(source.entityId, "source");
    assert.equal("newValues" in source, false);
    return true;
  } });
  assert.equal(checked, true);
  assert.equal(detail.actions.length, 1);
  assert.equal((await runActivity({ ...run, eventId: null }, "participant", deps)).sourceAccess, "unavailable");
});
