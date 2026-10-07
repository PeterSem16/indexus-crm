import assert from "node:assert/strict";
import {
  ACTION_TARGETS, AUTOMATION_SERVICE_DETAILS, FIELD_OPTIONS, MODULE_EVENTS, OPERATORS,
  RECIPIENT_CAPABILITIES, RECIPIENT_TEMPLATES, compareOrderedValues, conditionValuesEqual, fieldsForEvent, matchesRuleCountryScope, operatorsForEvent,
  SCHEDULE_RECORD_MODULES,
  validateRuleCapabilities,
} from "./automation-capabilities";
import { insertWorkflowRuleSchema } from "@shared/schema";
import { validateEventDraftInput } from "./automation-event-draft";
import { INBOUND_CALL_SERVICES } from "./inbound-call-services";
import { OUTBOUND_CALL_SERVICES } from "./outbound-call-services";

const rule = (module: string, eventType: string, extras: Record<string, unknown> = {}) => ({
  module,
  trigger: { type: "event", entityType: module, eventType },
  conditions: null,
  actions: [{ type: "notify_user", config: { userId: "agent-1", title: "Notice" } }],
  ...extras,
});
const paths = (r: ReturnType<typeof rule>) => validateRuleCapabilities(r).map(i => i.path);

assert.deepEqual(Object.keys(AUTOMATION_SERVICE_DETAILS).sort(), Object.keys(ACTION_TARGETS).sort());
assert.ok(MODULE_EVENTS.call.includes("outbound.started"));
assert.ok(MODULE_EVENTS.communication.includes("sentiment.negative"));
assert.equal(ACTION_TARGETS.create_task, null);

assert.deepEqual(paths(rule("customer", "updated")), []);
assert.deepEqual(paths(rule("customer", "created")), []);
assert.ok(fieldsForEvent("customer", "created").some(field => field.value === "newValues.clientStatus"));
assert.ok(fieldsForEvent("customer", "created").some(field => field.value === "newValues.newsletter"));
assert.ok(fieldsForEvent("customer", "created").some(field => field.value === "newValues.useCorrespondenceAddress"));
assert.ok(!fieldsForEvent("customer", "created").some(field => field.value === "newValues.email"));
assert.ok(fieldsForEvent("customer", "updated").some(field => field.value === "newValues.leadScore"));
assert.ok(!fieldsForEvent("customer", "updated").some(field =>
  ["newValues.nationalId", "newValues.bankAccount", "newValues.dateOfBirth"].includes(field.value)));
assert.deepEqual(paths(rule("customer", "created", {
  conditions: { field: "newValues.email", op: "is_not_null" },
})), ["conditions.field"]);
assert.deepEqual(paths(rule("customer", "created", {
  conditions: { field: "newValues.newsletter", op: "eq", value: true },
})), []);
assert.deepEqual(paths(rule("customer", "created", {
  conditions: { field: "newValues.newsletter", op: "eq", value: "true" },
})), ["conditions.value"]);
assert.deepEqual(paths(rule("customer", "created", {
  conditions: { field: "newValues.useCorrespondenceAddress", op: "eq", value: false },
})), []);
assert.deepEqual(paths(rule("customer", "created", {
  conditions: { field: "newValues.leadScore", op: "gte", value: "25" },
})), ["conditions.value"]);
assert.deepEqual(paths(rule("customer", "created", {
  conditions: { field: "newValues.leadScore", op: "gte", value: 25 },
})), []);
assert.deepEqual(paths(rule("customer", "created", {
  conditions: { field: "newValues.registrationDate", op: "eq", value: "not-a-date" },
})), ["conditions.value"]);
assert.deepEqual(paths(rule("customer", "created", {
  conditions: { field: "newValues.registrationDate", op: "eq", value: "2026-10-04T12:00:00.000Z" },
})), []);
assert.deepEqual(paths(rule("customer", "created", {
  conditions: { field: "newValues.serviceType", op: "eq", value: "plasma" },
})), ["conditions.value"]);
assert.deepEqual(paths(rule("customer", "created", {
  conditions: { field: "newValues.status", op: "eq", value: "closed" },
})), ["conditions.value"]);
assert.deepEqual(paths(rule("customer", "created", {
  conditions: { field: "newValues.clientStatus", op: "eq", value: "in_process" },
})), []);
assert.deepEqual(paths(rule("communication", "email.received")), []);
assert.deepEqual(paths(rule("communication", "sms.received")), []);
assert.deepEqual(paths(rule("communication", "sentiment.negative", {
  conditions: { field: "newValues.sentiment", op: "eq", value: "negative" },
})), []);
assert.deepEqual(paths(rule("communication", "sentiment.negative", {
  conditions: { field: "newValues.campaignId", op: "is_not_null" },
})), ["conditions.field"]);
assert.ok(!fieldsForEvent("communication", "email.received").some(field =>
  ["newValues.callLogId", "newValues.recordingId", "newValues.sentiment"].includes(field.value)));
assert.deepEqual(paths(rule("communication", "email.received", {
  conditions: { field: "newValues.sentiment", op: "eq", value: "negative" },
})), ["conditions.field"]);
assert.deepEqual(paths(rule("task", "task.assigned")), []);
assert.deepEqual(paths(rule("task", "task.assigned", {
  conditions: { field: "newValues.assignedUserId", op: "changed_to", value: "agent-id" },
})), []);
assert.deepEqual(paths(rule("clinic", "status_changed")), ["trigger.eventType"]);
assert.deepEqual(paths(rule("collaborator", "created")), []);
assert.deepEqual(paths(rule("contract", "contract.completed")), []);
assert.deepEqual(paths(rule("call", "call.timeout")), []);
assert.deepEqual(paths(rule("task", "call.answered")), ["trigger.eventType"]);
assert.equal(insertWorkflowRuleSchema.safeParse({
  name: "Country scoped", module: "task", trigger: { type: "event", entityType: "task", eventType: "created" },
  actions: [], countryCodes: ["SK", "CZ"],
}).success, true);
assert.equal(insertWorkflowRuleSchema.safeParse({
  name: "Empty country scope", module: "task", trigger: { type: "event", entityType: "task", eventType: "created" },
  actions: [], countryCodes: [],
}).success, false);
assert.equal(insertWorkflowRuleSchema.safeParse({
  name: "Duplicate country scope", module: "task", trigger: { type: "event", entityType: "task", eventType: "created" },
  actions: [], countryCodes: ["SK", "SK"],
}).success, false);
assert.equal(insertWorkflowRuleSchema.safeParse({
  name: "Invalid country", module: "task", trigger: { type: "event", entityType: "task", eventType: "created" },
  actions: [], countryCodes: ["PL"],
}).success, false);
assert.equal(insertWorkflowRuleSchema.safeParse({
  name: "Global", module: "task", trigger: { type: "event", entityType: "task", eventType: "created" },
  actions: [], countryCodes: null,
}).success, true);
assert.equal(matchesRuleCountryScope(["SK", "CZ"], null, "CZ"), true);
assert.equal(matchesRuleCountryScope(["SK", "CZ"], null, "HU"), false);
assert.equal(matchesRuleCountryScope(null, "SK", "SK"), true);
assert.equal(matchesRuleCountryScope(null, "SK", "CZ"), false);
assert.equal(matchesRuleCountryScope(null, null, "HU"), true);
assert.equal(conditionValuesEqual("2026-09-29T10:30:00.000Z", "2026-09-29"), true);
assert.equal(conditionValuesEqual("2026-09-30T10:30:00.000Z", "2026-09-29"), false);
assert.equal(conditionValuesEqual(12, "12"), false);
assert.deepEqual(paths(rule("task", "updated", {
  trigger: { type: "event", entityType: "customer", eventType: "updated" },
})), ["trigger.entityType"]);

assert.deepEqual(paths(rule("clinic", "updated", {
  conditions: { all: [{ field: "newValues.contractStatus", op: "changed_to", value: "signed" }] },
})), []);
assert.deepEqual(paths(rule("clinic", "created", {
  conditions: { all: [{ field: "newValues.contractStatus", op: "changed_to", value: "signed" }] },
})), ["conditions.all[0].op"]);
assert.deepEqual(paths(rule("call", "call.answered", {
  conditions: { field: "newValues.queueName", op: "eq", value: "any" },
})), ["conditions.field"]);
assert.deepEqual(paths(rule("task", "status_changed", {
  conditions: { field: "newValues.priority", op: "eq", value: "high" },
})), []);
assert.deepEqual(paths(rule("task", "updated", {
  conditions: { not: { any: [{ field: "newValues.status", op: "eq", value: "completed" }] } },
})), []);
assert.deepEqual(paths(rule("task", "updated", {
  conditions: { all: [] },
})), ["conditions"]);

assert.deepEqual(paths(rule("contract", "updated", {
  actions: [{ type: "update_entity", config: { fields: { status: "active" } } }],
})), ["actions[0].type"]);
assert.deepEqual(paths(rule("clinic", "updated", {
  actions: [{ type: "assign_user", config: { userId: "agent-1", strategy: "specific" } }],
})), ["actions[0].type"]);
assert.deepEqual(paths(rule("task", "created", {
  actions: [{ type: "sys_webhook", config: {} }],
})), ["actions[0].type"]);
assert.deepEqual(paths(rule("task", "created", {
  actions: [{ type: "send_sms", config: { text: "Hello" } }],
})), ["actions[0].config.to"]);
assert.deepEqual(paths(rule("task", "created", {
  actions: [{ type: "notify_user", config: { title: "Hello" } }],
})), ["actions[0].config.userId"]);
assert.deepEqual(paths(rule("task", "status_changed", {
  actions: [{ type: "notify_user", config: { userId: "{{newValues.assignedUserId}}" } }],
})), []);
assert.deepEqual(paths(rule("call", "call.timeout", {
  actions: [{ type: "notify_user", config: { userId: "{{newValues.assignedUserId}}" } }],
})), ["actions[0].config.userId"]);
assert.deepEqual(paths(rule("customer", "updated", {
  actions: [{ type: "send_email", config: { to: "{{newValues.email}}" } }],
})), []);
assert.deepEqual(RECIPIENT_TEMPLATES.task.status_changed, ["newValues.assignedUserId", "newValues.createdByUserId"]);
assert.deepEqual(RECIPIENT_TEMPLATES.call["call.abandoned"], ["newValues.assignedAgentId"]);
assert.deepEqual(RECIPIENT_TEMPLATES.call["outbound.started"], ["newValues.agentId"]);
for (const service of INBOUND_CALL_SERVICES) {
  const config = service.id === "missed_group_task"
    ? { ...service.config, assignedDepartmentId: "approved-department" }
    : service.config;
  assert.deepEqual(validateRuleCapabilities({
    module: "call",
    trigger: { type: "event", entityType: "call", eventType: service.eventType },
    conditions: service.conditions,
    actions: [{ type: service.actionType, config }],
  }), [], `Inbound service ${service.id} must be executable`);
  assert.deepEqual(validateRuleCapabilities({
    module: "call",
    trigger: { type: "event", entityType: "call", eventType: service.eventType },
    conditions: service.conditions,
    actions: [{ type: service.actionType, config }],
    countryCodes: ["SK", "CZ"],
  }), [], `Inbound service ${service.id} must support multi-country rule scope`);
}
assert.deepEqual(OUTBOUND_CALL_SERVICES.map(service => service.id), [
  "started_notice", "unanswered_agent_notice", "completed_review_task", "unanswered_followup_task",
]);
for (const serviceId of ["started_notice", "unanswered_agent_notice"]) {
  const service = OUTBOUND_CALL_SERVICES.find(item => item.id === serviceId)!;
  assert.deepEqual(service.conditions, { field: "newValues.agentId", op: "is_not_null" });
}
for (const service of OUTBOUND_CALL_SERVICES) {
  assert.equal(service.enabled, false);
  assert.deepEqual(validateRuleCapabilities({
    module: "call",
    trigger: { type: "event", entityType: "call", eventType: service.eventType },
    conditions: service.conditions,
    actions: [{ type: service.actionType, config: service.config }],
  }), [], `Outbound service ${service.id} must be executable`);
  assert.deepEqual(validateRuleCapabilities({
    module: "call",
    trigger: { type: "event", entityType: "call", eventType: service.eventType },
    conditions: service.conditions,
    actions: [{ type: service.actionType, config: service.config }],
    countryCodes: ["SK", "CZ"],
  }), [], `Outbound service ${service.id} must support multi-country rule scope`);
}
assert.ok(validateRuleCapabilities({
  module: "call",
  trigger: { type: "event", entityType: "call", eventType: "call.timeout" },
  actions: [{ type: "create_task", config: INBOUND_CALL_SERVICES[2].config }],
}).some(issue => issue.path === "actions[0].config.assignedUserId"));
assert.deepEqual(paths(rule("call", "call.assigned", {
  actions: [{ type: "send_sms", config: { to: "{{newValues.callerNumber}}", text: "Hello" } }],
})), ["actions[0].config.to"]);
assert.deepEqual(paths(rule("call", "call.timeout", {
  actions: [{ type: "notify_user", config: { userId: "{{newValues.agentId}}", title: "Notice" } }],
})), ["actions[0].config.userId"]);
assert.deepEqual(paths(rule("task", "created", {
  actions: [{ type: "send_email", config: { to: "{{newValues.email}}" } }],
})), ["actions[0].config.to"]);
assert.deepEqual(paths(rule("clinic", "updated", {
  conditions: { field: "newValues.isActive", op: "in", value: [true] },
})), ["conditions.op"]);
assert.deepEqual(paths(rule("task", "updated", {
  conditions: { field: "newValues.status", op: "in", value: "pending,done" },
})), ["conditions.value"]);
assert.equal(compareOrderedValues("2026-09-26T10:00:00.000Z", "2026-09-25T10:00:00.000Z", "gt"), true);
assert.equal(compareOrderedValues(new Date("2026-09-26T10:00:00.000Z"), "2026-09-26", "gte"), true);
assert.equal(compareOrderedValues("2026-09-25", "2026-09-26", "gt"), false);
assert.equal(compareOrderedValues(null, "2026-09-26", "lt"), false);
assert.deepEqual(paths(rule("clinic", "updated", {
  actions: [{ type: "add_tag", config: { tags: ["checked"] } }],
})), []);
assert.deepEqual(paths(rule("clinic", "updated", {
  actions: [{ type: "update_entity", config: { entityType: "customer", fields: {} } }],
})), ["actions[0].config.entityType"]);
assert.deepEqual(paths(rule("task", "task.completed", {
  trigger: { type: "schedule", interval: "daily" },
  actions: [{ type: "update_entity", config: {} }],
})), ["actions[0].type"]);

const scheduledRule = (module: string, mode?: string, extras: Record<string, unknown> = {}) => ({
  module,
  trigger: { type: "schedule", interval: "daily", ...(mode === undefined ? {} : { mode }) },
  conditions: null,
  actions: [],
  ...extras,
});
assert.deepEqual(paths(scheduledRule("customer")), [], "legacy schedule mode defaults to once");
assert.deepEqual(paths(scheduledRule("customer", "once", {
  conditions: { field: "newValues.status", op: "eq", value: "active" },
})), ["conditions"]);
assert.deepEqual(paths(scheduledRule("customer", "once", {
  actions: [{ type: "send_email", config: { to: "ops@example.test", subject: "Daily", body: "Hello" } }],
})), ["countryCodes"], "one-shot provider sends require exactly one country");
assert.deepEqual(paths(scheduledRule("customer", "once", {
  countryCodes: ["SK"],
  actions: [{ type: "send_sms", config: { to: "+421000000000", text: "Hello" } }],
})), []);
assert.deepEqual(paths(scheduledRule("customer", "per_record", {
  conditions: { field: "newValues.status", op: "eq", value: "active" },
})), []);
assert.deepEqual(paths(scheduledRule("customer", "per_record", {
  conditions: null,
})), ["conditions"]);
assert.ok(paths(scheduledRule("contract", "per_record", {
  conditions: { field: "newValues.status", op: "eq", value: "active" },
})).includes("module"));
assert.deepEqual(paths(scheduledRule("task", "per_record", {
  conditions: { field: "newValues.status", op: "changed_to", value: "completed" },
})), ["conditions.op"]);
assert.deepEqual(paths(scheduledRule("task", "per_record", {
  conditions: { field: "newValues.status", op: "eq", value: "pending" },
  actions: [{ type: "update_entity", config: { entityId: "other-task", fields: { status: "done" } } }],
})), ["actions[0].config.entityId"]);
assert.ok(SCHEDULE_RECORD_MODULES.includes("hospital"));
assert.ok(fieldsForEvent("customer", "schedule.tick").some(field => field.value === "newValues.leadScore"));
assert.ok(!fieldsForEvent("customer", "schedule.tick").some(field =>
  ["newValues.email", "newValues.firstName", "newValues.nationalId"].includes(field.value)));

// Group/role delivery is shared by task, in-app notice and group email.
assert.deepEqual(paths(rule("call", "call.timeout", {
  actions: [{ type: "create_task", config: { title: "Follow up", taskGroupId: "group-1" } }],
})), []);
assert.deepEqual(paths(rule("task", "created", {
  actions: [{ type: "notify_user", config: { title: "Review", targetRole: "role:Back Office" } }],
})), []);
assert.deepEqual(paths(rule("customer", "updated", {
  actions: [{ type: "send_email", config: { taskGroupId: "group-1", subject: "Update", body: "Hello" } }],
})), []);
assert.deepEqual(paths(rule("task", "created", {
  actions: [{ type: "create_task", config: { title: "Review", taskGroupId: "group-1", assignedUserId: "user-1" } }],
})), ["actions[0].config"]);
assert.deepEqual(paths(rule("task", "created", {
  actions: [{ type: "notify_user", config: { title: "Review", taskGroupId: "group-1", targetRole: "role:Manager" } }],
})), ["actions[0].config"]);
assert.deepEqual(paths(rule("task", "created", {
  actions: [{ type: "send_email", config: { to: "person@example.com", targetRole: "role:Manager" } }],
})), ["actions[0].config"]);
assert.deepEqual(paths(rule("task", "created", {
  actions: [{ type: "webhook", config: { url: "https://example.com", taskGroupId: "group-1" } }],
})), ["actions[0].config"]);

for (const [module, events] of Object.entries(MODULE_EVENTS)) {
  assert.ok(FIELD_OPTIONS[module], `missing fields for ${module}`);
  for (const event of events) {
    assert.deepEqual(paths(rule(module, event)), [], `${module}/${event} should be valid`);
    assert.ok(fieldsForEvent(module, event).length, `${module}/${event} should expose a checked condition field`);
  }
}
for (const op of OPERATORS) {
  assert.ok(Object.keys(MODULE_EVENTS).some(module =>
    MODULE_EVENTS[module].some(event =>
      fieldsForEvent(module, event).some(field =>
        operatorsForEvent(event, field.type).some(o => o.value === op.value)))), `unavailable operator ${op.value}`);
}
for (const recipient of RECIPIENT_CAPABILITIES) {
  assert.ok(recipient.actions.every(action => action in ACTION_TARGETS), `unsupported recipient action ${recipient.value}`);
  assert.ok(recipient.modules.every(module => module in MODULE_EVENTS), `unsupported recipient module ${recipient.value}`);
}
assert.throws(() => validateEventDraftInput({
  module: "task", eventType: "status_changed", countryCode: "SK",
  conditionField: "newValues.description", conditionValue: "high",
  instruction: "Notify my agent when this changes",
}, { role: "admin" }), /Unsupported condition field/);
console.log("Automation capability catalog tests passed");