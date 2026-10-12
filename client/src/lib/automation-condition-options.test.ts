import assert from "node:assert/strict";
import { conditionValueOptions, usesConditionChoices, SENTIMENT_OPTIONS, TONE_OPTIONS } from "./automation-condition-options";
import { getConditionChoiceCopy } from "../i18n/automation-condition-choice-copy";
const gateway = { value: "newValues.provider", label: "Gateway", type: "string",
  options: ["smstools", "bulkgate"], optionLabels: { smstools: "SMS.to", bulkgate: "BulkGate" } };
assert.ok(usesConditionChoices(gateway, "eq"), "String catalog fields must use predefined values");
assert.ok(usesConditionChoices(gateway, "in"));
assert.ok(!usesConditionChoices(gateway, "contains"), "Partial matching must retain text semantics");
assert.ok(!usesConditionChoices({ value: "summary", label: "Summary", type: "string" }, "eq"));
assert.deepEqual(conditionValueOptions(gateway, "smstools", "Saved"), [
  { value: "smstools", label: "SMS.to" }, { value: "bulkgate", label: "BulkGate" },
]);
const original = structuredClone(gateway);
assert.deepEqual(conditionValueOptions(gateway, ["legacy", "bulkgate"], "Saved")[2], { value: "legacy", label: "legacy · Saved" });
assert.deepEqual(gateway, original);
assert.equal(conditionValueOptions(gateway, "", "Saved").length, 2);
assert.equal(conditionValueOptions({ ...gateway, options: [] }, "old", "Saved")[0].value, "old");
assert.deepEqual(SENTIMENT_OPTIONS, ["positive", "neutral", "negative", "angry"]);
assert.deepEqual(TONE_OPTIONS, ["calm", "concerned", "angry", "rude"]);
for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
  const copy = getConditionChoiceCopy(locale);
  assert.ok(copy.saved && copy.choose && copy.values.calm && copy.values.web_form);
}
console.log("IF choice tests passed: catalog string options, scalar/multiple values, legacy preservation, text operators, immutability and seven locales.");
