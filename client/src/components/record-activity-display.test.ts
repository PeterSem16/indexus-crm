import { test } from "node:test";
import assert from "node:assert/strict";
import { actionDisplayName, activityDetailEntries, moduleDisplayName } from "./record-activity-display";

test("known events and modules get human-readable localized names", () => {
  assert.equal(actionDisplayName("status_list_background", "en", "Other event"), "Background automation ran");
  assert.equal(actionDisplayName("agreement_updated", "sk", "Iná udalosť"), "Zmluva upravená");
  assert.equal(moduleDisplayName("status_list", "en", "Module"), "Status list");
});

test("automation action types use specific localized names without exposing unknown codes", () => {
  assert.equal(actionDisplayName("status_list_action", "en", "Other event", "send_email_group"), "Email sent to group");
  assert.equal(actionDisplayName("status_list_action", "de", "Sonstiges Ereignis", "set_callback"), "Rückruf geplant");
  assert.equal(actionDisplayName("status_list_action", "en", "Other event", "internal_future_code"), "Activity recorded");
  assert.equal(actionDisplayName("internal_future_code", "en", "Other event"), "Activity recorded");
});

test("changed fields are localized and booleans and dates are readable", () => {
  const entries = activityDetailEntries({
    before: { validFrom: "2025-01-02", active: false },
    after: { validFrom: "2025-03-04", active: true },
  }, "en", "Before", "After");
  assert.deepEqual(entries.map(([label]) => label), ["Valid from", "Active"]);
  assert.match(entries[0][1], /Before: Jan 2, 2025 · After: Mar 4, 2025/);
  assert.equal(entries[1][1], "Before: No · After: Yes");
});

test("identifier and sensitive fields are omitted, while resolved campaign names can be shown", () => {
  const entries = activityDetailEntries({
    campaignId: "campaign-secret-id",
    before: { id: "row-id", email: "private@example.test", validFrom: "2024-01-01" },
    campaign: { id: "campaign-id", name: "Spring outreach" },
  }, "en", "Before", "After");
  assert.deepEqual(entries, [
    ["Valid from", "Before: Jan 1, 2024 · After: —"],
    ["Campaign", "Spring outreach"],
  ]);
  assert.equal(JSON.stringify(entries).includes("campaign-id"), false);
});
