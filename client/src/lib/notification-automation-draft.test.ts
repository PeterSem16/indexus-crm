import assert from "node:assert/strict";
import { notificationAutomationDraft } from "./notification-automation-draft";
import { validateRuleCapabilities } from "../../../server/lib/automation-capabilities";

const source = {
  name: "Synthetic analysis", triggerType: "new_sms", countryCodes: ["SK"],
  triggerConditions: { provider: ["smstools", "bulkgate"], wantsToCancel: true, hasAngryTone: false },
  notificationTitle: "Needs attention", notificationMessage: "Please review",
  targetType: "specific_users", targetUserIds: ["synthetic-agent"],
};
const original = JSON.stringify(source);
const draft = notificationAutomationDraft(source, "notify_user");
assert.equal(draft.enabled, false);
assert.equal(draft.trigger.eventType, "communication.analyzed");
assert.deepEqual(draft.countryCodes, ["SK"]);
assert.deepEqual(draft.actions[0].config.userId, "synthetic-agent");
assert.equal(JSON.stringify(source), original, "original saved rule is never changed");
assert.deepEqual(validateRuleCapabilities(draft), []);
assert.deepEqual(draft.conditions, { all: [
  { field: "newValues.type", op: "in", value: ["sms"] },
  { field: "newValues.provider", op: "in", value: ["smstools", "bulkgate"] },
  { field: "newValues.wantsToCancel", op: "eq", value: true },
  { field: "newValues.hasAngryTone", op: "eq", value: false },
] });
for (const action of ["send_email", "send_sms"] as const) {
  const next = notificationAutomationDraft(source, action);
  assert.equal(next.enabled, false);
  assert.equal(next.actions[0].type, action);
  assert.equal(next.actions[0].config.to, undefined, "never guess external recipients");
}
assert.equal(notificationAutomationDraft({ ...source, triggerConditions: null }, "notify_user").trigger.eventType, "sms.received");
assert.equal(notificationAutomationDraft({ ...source, triggerType: "new_email" }, "notify_user").trigger.eventType, "communication.analyzed");
assert.throws(() => notificationAutomationDraft({ ...source, triggerConditions: { unknown: true } }, "notify_user"));
assert.throws(() => notificationAutomationDraft({ ...source, triggerConditions: { wantsToCancel: [] } }, "notify_user"));
assert.throws(() => notificationAutomationDraft({ ...source, triggerConditions: "{invalid" }, "notify_user"));
console.log("Legacy analysis hand-off: exact AND/OR, false flags, paused drafts, no guessed recipients, original preserved PASSED");
