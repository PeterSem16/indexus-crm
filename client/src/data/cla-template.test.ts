import assert from "node:assert/strict";
import { CLA_TEMPLATE, CLB_TEMPLATE, MPN_TEMPLATE } from "./cla-template";

let checks = 0;
const check = (value: unknown, message: string) => { assert.ok(value, message); checks++; };
for (const rows of [CLA_TEMPLATE, CLB_TEMPLATE, MPN_TEMPLATE]) {
  check(new Set(rows.map(row => row.stepId)).size === rows.length, "Template IDs stay unique");
  for (const row of rows) {
    check(!row.parentStepId || rows.some(parent => parent.stepId === row.parentStepId), `${row.stepId} has an existing parent`);
    check(new Set(row.automations.map(auto => auto.triggerId)).size === row.automations.length, `${row.stepId} action IDs are unique`);
  }
}
for (const id of ["MPN-03d", "MPN-03e", "MPN-03f", "MPN-05b1", "MPN-05b2"]) {
  const row = MPN_TEMPLATE.find(step => step.stepId === id)!;
  check(!!row && row.confirmationType === "radio" && !row.isHidden, `${id} is a selectable visible addition`);
  check(row.automations.length === 0, "Adding yellow questions does not install new runtime actions");
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
    check(!!row.labelL10n?.[locale]?.trim(), `${id} label exists in ${locale}`);
    check(!!row.descriptionL10n?.[locale]?.trim(), `${id} instructions exist in ${locale}`);
    if (row.callbackTimingL10n) check(!!row.callbackTimingL10n[locale], `${id} timing exists in ${locale}`);
  }
}
const root = MPN_TEMPLATE.find(row => row.stepId === "MPN-03")!;
check(!root.isHidden, "Coordinator choices have a visible parent");
check(root.description.includes("five") && root.description.includes("six"), "v04 replaces the old ten-attempt/one-year policy");
check(!root.description.match(/\b10\b|1 year/), "No obsolete reachability policy is exported");
check(root.automations.length === 1 && root.automations[0].taskDescription?.includes("5"), "Existing task template is retained with corrected instructions");
check(MPN_TEMPLATE.find(row => row.stepId === "MPN-03b")?.isHidden, "Automatic unreachable choice retains its identity and visibility");
check(MPN_TEMPLATE.find(row => row.stepId === "MPN-03c")?.isHidden, "Automatic reachable choice retains its identity and visibility");
const question = MPN_TEMPLATE.find(row => row.stepId === "MPN-03e")!.questions![0];
check(question.fieldType === "text" && question.required === false, "Proposed contact is a real optional text question");
for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
  check(!!question.questionTextL10n?.[locale] && !!question.descriptionL10n?.[locale], `Contact question is localized in ${locale}`);
}
for (const id of ["MPN-05b1", "MPN-05b2"]) check(MPN_TEMPLATE.find(row => row.stepId === id)?.parentStepId === "MPN-05b", "Considering variants belong to considering, not agreed or disagreed");
check(MPN_TEMPLATE.find(row => row.stepId === "MPN-05b1")?.callbackTimingL10n?.en === "+1 month", "No-call request has document's one-month follow-up instruction");
check(MPN_TEMPLATE.find(row => row.stepId === "MPN-05b2")?.callbackTimingL10n?.en === "+1 week", "Allowed follow-up has document's one-week instruction");
check(MPN_TEMPLATE.some(row => row.stepId === "MPN-06a"), "Existing no-contract cooperation choice is retained");
console.log(`CLA/CLB/MPN template data: ${checks} assertions passed`);
