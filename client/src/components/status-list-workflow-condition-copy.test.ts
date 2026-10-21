import assert from "node:assert/strict";
import { getStatusListWorkflowConditionCopy } from "./status-list-workflow-condition-copy";

const english = getStatusListWorkflowConditionCopy("en");
for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
  const copy = getStatusListWorkflowConditionCopy(locale);
  assert.deepEqual(Object.keys(copy).sort(), Object.keys(english).sort(), locale);
  for (const [key, value] of Object.entries(copy)) {
    assert.equal(typeof value, "string", `${locale}:${key}`);
    assert.ok(value.trim(), `${locale}:${key}`);
  }
  assert.ok(copy.savedValue.includes("{value}"), locale);
}
assert.equal(getStatusListWorkflowConditionCopy("sk").clinic, "Ambulancia");
assert.equal(getStatusListWorkflowConditionCopy("unknown").choose, english.choose);
console.log("Workflow IF choices: all seven translations and saved-value placeholders passed");
