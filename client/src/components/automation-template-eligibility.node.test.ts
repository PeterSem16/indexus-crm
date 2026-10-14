import assert from "node:assert/strict";
import test from "node:test";
import { templateEligibility } from "./automation-template-eligibility";
import { classifySource } from "./automation-template-classification";
import { ACTIVITY_TEMPLATE_FIELDS } from "../../../shared/automation-activity-context";
import { ANALYSIS_FIELDS } from "../../../shared/automation-analysis";
import { COMMUNICATION_SOURCE_FIELDS } from "../../../shared/automation-communication-context";
import { templateFieldLabel } from "./automation-template-field-label";

const all = [...ACTIVITY_TEMPLATE_FIELDS, ...ANALYSIS_FIELDS, ...COMMUNICATION_SOURCE_FIELDS];
test("legacy deadline is a task source, not an email source; allowed optional fields alone do not make it usable", () => {
  const deadline = { id: "indexus-automation-email-deadline-en", name: "Deadline reminder", content: "{{activity.title}} {{activity.id}} {{activity.dueDate}}" };
  assert.equal(classifySource(deadline), "tasks");
  assert.equal(templateEligibility(deadline, all, "task").usable, true);
  const wrong = templateEligibility(deadline, all, "call");
  assert.equal(wrong.usable, false);
  assert.equal(wrong.sourceMismatch, true);
  assert.deepEqual(wrong.missing, []);
});
test("generic instructions work for any source, but deactivated templates and unknown variables are unavailable", () => {
  const generic = { id: "indexus-task-template-check-data-en", name: "Check data", content: "{{activity.id}}" };
  assert.equal(templateEligibility(generic, all, "clinic").usable, true);
  assert.equal(templateEligibility({ ...generic, isActive: false }, all, "clinic").usable, false);
  assert.deepEqual(templateEligibility({ ...generic, content: "{{analysis.privateField}}" }, all, "communication").missing, ["analysis.privateField"]);
});
test("call lifecycle and analyzed call templates use distinct requirements", () => {
  const call = { id: "indexus-activity-email-analysis-inbound-tone-angry-en", name: "Call tone", content: "{{analysis.tone}} {{communication.id}}" };
  const before = templateEligibility(call, ACTIVITY_TEMPLATE_FIELDS, "call");
  assert.equal(before.usable, false);
  assert.equal(before.analysisRequired, true);
  assert.equal(templateEligibility(call, all, "communication").usable, true);
  assert.equal(templateEligibility(call, all, "call").usable, true); // Native call with an analysis stage.
});
test("institution templates do not become usable for a different institution type", () => {
  const clinic = { id: "indexus-activity-email-clinic-created-en", name: "Clinic", content: "{{activity.id}}" };
  assert.equal(templateEligibility(clinic, all, "clinic").usable, true);
  assert.equal(templateEligibility(clinic, all, "hospital").usable, false);
});
test("known missing fields have readable localized labels, not unmapped technical keys", () => {
  assert.equal(templateFieldLabel("analysis.tone", "sk", []), "Tón");
  assert.equal(templateFieldLabel("activity.dueDate", "sk", []), "Termín");
  assert.equal(templateFieldLabel("activity.title", "sk", []), "Predmet / názov");
  assert.equal(templateFieldLabel("analysis.privateField", "sk", []), "{{analysis.privateField}}");
});
