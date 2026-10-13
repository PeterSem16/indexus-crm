import assert from "node:assert/strict";
import { automationBranch, automationBranchIssue, automationExecutableActions, automationAnalysisUnknown } from "./automation-branches";
import { validateRuleCapabilities } from "../server/lib/automation-capabilities";
import { validateAutomationActions } from "../server/lib/automation-action-policy";
import { noMatchRoutingIssue } from "../server/lib/automation-no-match";
import { buildAutomationFlowModel, type FlowLabels } from "../client/src/lib/automation-flow-model";
import { automationBlockEditorCopy } from "../client/src/i18n/automation-block-editor-copy";
import { insertWorkflowRuleSchema } from "./schema";

const actions = [{ type: "notify_user", config: { userId: "test-user", title: "Test", message: "Test" } }];
const trigger = { type: "event", entityType: "task", eventType: "status_changed", noMatchActions: actions };
assert.equal(automationBranch(trigger, true, true).branch, "then");
assert.deepEqual(automationBranch(trigger, true, false).actions, actions);
assert.equal(automationBranch(trigger, false, false).branch, "stop");
assert.equal(automationBranch(trigger, true, null).branch, "stop");
assert.equal(automationAnalysisUnknown({ field: "analysis.hasInvoice", op: "eq", value: true }, { hasInvoice: null }), true);
assert.equal(automationAnalysisUnknown({ all: [{ field: "analysis.hasInvoice", op: "eq", value: true }] }, { hasInvoice: false }), false);
assert.equal(automationAnalysisUnknown({ field: "analysis.hasInvoice", op: "is_null" }, { hasInvoice: null }), false);
assert.equal(automationAnalysisUnknown({ field: "countryCode", op: "eq", value: "SK" }, {}), false);
assert.equal(automationBranch({}, true, false).branch, "stop");
assert.equal(automationBranch({ noMatchRuleId: "next" }, true, false).ruleId, "next");
assert.equal(automationBranch({ noMatchRuleId: "next" }, false, false).ruleId, null);
assert.equal(automationBranch({ noMatchRuleId: "next" }, true, null).ruleId, null);
assert.equal(automationBranchIssue(trigger), null);
assert.ok(automationBranchIssue({ ...trigger, noMatchRuleId: "next" }));
assert.ok(automationBranchIssue({ ...trigger, type: "schedule" }));
assert.ok(automationBranchIssue({ ...trigger, noMatchActions: [] }));
assert.ok(automationBranchIssue({ ...trigger, noMatchActions: "bad" }));
const rule = { module: "task", trigger, actions };
const persisted = insertWorkflowRuleSchema.parse({ ...rule, name: "Branch persistence" });
assert.deepEqual(JSON.parse(JSON.stringify(persisted.trigger)), trigger, "Existing trigger JSON schema preserves ELSE actions");
assert.equal(automationExecutableActions(rule).length, 2);
assert.equal(validateRuleCapabilities(rule).length, 0);
assert.equal(validateAutomationActions(automationExecutableActions(rule), "manual").length, 0);
assert.ok(validateRuleCapabilities({ ...rule, trigger: { ...trigger, noMatchActions: [{ type: "forward_message", config: {} }] } }).length);
assert.ok(validateAutomationActions(automationExecutableActions({ ...rule, trigger: { ...trigger, noMatchActions: [{ type: "not_an_action", config: {} }] } }), "manual").length);
assert.ok(noMatchRoutingIssue({ ...rule, trigger: { ...trigger, noMatchRuleId: "next" } }, []));
const labels: FlowLabels = { field: String, operator: String, event: String, action: String, value: String,
  analysis: "Analysis", schedule: "Schedule", allCountries: "All", yes: "Yes", no: "No", unknown: "Unknown" };
const model = buildAutomationFlowModel({ ...rule, name: "Test", enabled: false }, labels);
assert.equal(model.elseActions?.length, 1);
assert.ok(!model.trigger.details.some(item => item.label === "noMatchActions"));
for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
  assert.deepEqual(Object.keys(automationBlockEditorCopy[locale]).sort(), Object.keys(automationBlockEditorCopy.en).sort());
  assert.ok(Object.values(automationBlockEditorCopy[locale]).every(value => value.length));
}
console.log("Automation branches: THEN/ELSE/Stop, unknown/error, eligibility, links, validation, preview and seven-language parity passed.");
