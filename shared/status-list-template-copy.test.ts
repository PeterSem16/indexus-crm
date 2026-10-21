import assert from "node:assert/strict";
import { ACTIVITY_TEMPLATE_LANGUAGES, activityTemplateLabel } from "./automation-activity-template-copy";

for (const locale of ACTIVITY_TEMPLATE_LANGUAGES) {
  assert.ok(activityTemplateLabel(locale, "status_list").trim(), `Status List source label in ${locale}`);
}
assert.throws(() => activityTemplateLabel("en", "unknown-source"), /Missing activity template label/);
console.log("Status List template source labels are available in every locale; unknown sources still fail explicitly.");
