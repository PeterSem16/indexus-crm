import assert from "node:assert/strict";
import { buildAutomationFlowModel, type FlowLabels, type FlowRule } from "./automation-flow-model";
import { getFlowchartCopy } from "../i18n/automation-flowchart-copy";
import { getFlowExtraLabels } from "../i18n/automation-flow-labels";
const labels: FlowLabels = {
  field: value => `field:${value}`, operator: value => `operator:${value}`,
  event: value => `event:${value}`, action: value => `action:${value}`,
  value: value => String(value), analysis: "Analysis", schedule: "Scheduled",
  allCountries: "All countries", yes: "Yes", no: "No", unknown: "Unknown",
};
const rule: FlowRule = {
  name: "Invoice handling", enabled: false, module: "communication", countryCodes: ["SK", "CZ"],
  trigger: { type: "event", eventType: "communication.received", entityType: "communication",
    analysis: { analyzeContent: true, analyzeAttachments: true, channels: ["email"], mailboxUserIds: ["owner"], senderEmails: ["billing@example.test"] } },
  conditions: { all: [{ field: "analysis.hasInvoice", op: "eq", value: true },
    { any: [{ field: "analysis.invoiceCount", op: "gte", value: 2 },
      { not: { field: "analysis.failedAttachmentCount", op: "gt", value: 0 } }] }] },
  actions: [{ type: "create_task", config: { taskActionVersion: 2, title: "Check invoice",
    recipients: [{ kind: "group", id: "back-office" }], attachmentSelectionMode: "invoices",
    taskText: "Please review the original attached document.", dueInHours: 24 } },
    { type: "webhook", config: { url: "https://example.test/hook", headers: { Authorization: "not-a-real-secret" }, body: { acknowledged: true } } }],
  rateLimitPerHour: 10,
};
const original = structuredClone(rule);
const model = buildAutomationFlowModel(rule, labels);
assert.deepEqual(rule, original, "Preview must never mutate source rule or its config");
assert.equal(model.enabled, false);
assert.equal(model.trigger.title, "event:communication.received");
assert.ok(model.analysis?.details.some(item => item.label.endsWith("senderEmails") && item.value === "billing@example.test"));
assert.equal(model.conditions?.kind, "all");
if (model.conditions?.kind === "all") {
  assert.equal(model.conditions.children.length, 2);
  const any = model.conditions.children[1];
  assert.equal(any.kind, "any");
  if (any.kind === "any") {
    assert.equal(any.children[1].kind, "not");
    const not = any.children[1];
    if (not.kind === "not") assert.deepEqual(not.children[0], { kind: "leaf", field: "field:analysis.failedAttachmentCount", operator: "operator:gt", value: "0" });
  }
}
assert.equal(model.actions.length, 2);
assert.ok(model.actions[0].details.some(item => item.value === "back-office"));
assert.ok(model.actions[0].details.some(item => item.value === "invoices"));
assert.ok(!model.actions[0].details.some(item => item.label.includes("ActionVersion")));
assert.ok(model.actions[1].details.some(item => item.value === "••••••••"));
assert.ok(model.actions[1].details.some(item => item.label.endsWith("acknowledged") && item.value === "Yes"));
assert.ok(!JSON.stringify(model).includes("not-a-real-secret"));
assert.equal(buildAutomationFlowModel({ ...rule, conditions: null }, labels).conditions, null);
assert.deepEqual(buildAutomationFlowModel({ ...rule, conditions: { any: [] } }, labels).conditions, { kind: "any", children: [] });
assert.deepEqual(buildAutomationFlowModel({ ...rule, conditions: { all: [] } }, labels).conditions, { kind: "all", children: [] });
assert.equal(buildAutomationFlowModel({ ...rule, trigger: { type: "schedule", interval: "daily" } }, labels).conditionsIgnored, true);
assert.equal(buildAutomationFlowModel({ ...rule, trigger: { type: "schedule", interval: "daily", mode: "per_record" } }, labels).conditionsIgnored, false);
const allOwners = buildAutomationFlowModel({ ...rule, trigger: { ...rule.trigger,
  analysis: { ...rule.trigger.analysis, mailboxMode: "all", mailboxUserIds: [], senderEmails: [] } } }, labels);
assert.ok(!allOwners.analysis?.details.some(item => item.label === "field:mailboxUserIds"));
assert.ok(allOwners.analysis?.details.some(item => item.value === "any_sender"));
const long = "x".repeat(2000);
assert.ok(buildAutomationFlowModel({ ...rule, actions: [{ type: "notify_user", config: { message: long } }] }, labels).actions[0].details.some(item => item.value === long));
for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
  const copy = getFlowchartCopy(locale);
  assert.ok(copy.preview && copy.conditionsIgnored && copy.emptyAny && copy.boolean.yes);
  assert.ok(getFlowExtraLabels(locale)["analysis.hasInvoice"]);
}
console.log("Rule flow model: nested ALL/ANY/NOT, all actions, source filters, schedule parity, masking, full values, immutability and seven-language copy passed.");
