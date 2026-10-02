import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUTOMATION_ACTION_POLICY,
  validateAutomationActions,
} from "./automation-action-policy";

test("catalogue includes the nine executable action types with explicit risk", () => {
  assert.deepEqual(
    Object.keys(AUTOMATION_ACTION_POLICY).sort(),
    ["create_task", "notify_user", "send_email", "send_sms", "webhook", "update_entity", "assign_user", "add_tag", "remove_tag"].sort(),
  );
  assert.equal(AUTOMATION_ACTION_POLICY.send_sms.risk, "external_message");
  assert.equal(AUTOMATION_ACTION_POLICY.update_entity.aiDraftEligible, false);
});

test("existing manual rules retain their supported action types", () => {
  assert.deepEqual(validateAutomationActions([
    { type: "create_task", config: { assignedUserId: "system" } },
    { type: "send_email", config: { templateId: "existing-template" } },
  ], "manual"), []);
  assert.deepEqual(
    validateAutomationActions([{ type: "invented_action", config: {} }], "manual"),
    [{ path: "actions[0].type", message: "Unsupported action type" }],
  );
});

test("AI drafts accept only fully specified internal actions", () => {
  assert.deepEqual(validateAutomationActions([
    { type: "create_task", config: { title: "Review request", assignedDepartmentId: "department-id", priority: "high", dueInHours: 48 } },
    { type: "notify_user", config: { userId: "user-id", title: "New request" } },
  ], "ai_draft"), []);
  const issues = validateAutomationActions([
    { type: "send_sms", config: { to: "123", text: "Hello" } },
    { type: "create_task", config: { title: "Review request", priority: "urgent", dueInHours: -1, unknown: "x" } },
    { type: "notify_user", config: { title: "Message" } },
  ], "ai_draft");
  assert.ok(issues.some((issue) => issue.path === "actions[0].type"));
  assert.ok(issues.some((issue) => issue.path.startsWith("actions[1].config")));
  assert.ok(issues.some((issue) => issue.path.startsWith("actions[2].config")));
});

test("malformed, empty and oversized action lists fail closed", () => {
  assert.ok(validateAutomationActions([], "manual").length);
  assert.ok(validateAutomationActions(null, "ai_draft").length);
  assert.ok(validateAutomationActions(Array.from({ length: 21 }, () => ({ type: "notify_user", config: {} })), "ai_draft").length);
  assert.ok(validateAutomationActions([{ type: "notify_user", config: null }], "manual").length);
});