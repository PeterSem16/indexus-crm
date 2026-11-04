import { test } from "node:test";
import assert from "node:assert/strict";
import { actionDisplayName, activityActionKey, activityDetailEntries, moduleDisplayName } from "./record-activity-display";
import { statusListConfirmationLabel } from "../../../shared/status-list-history-display";

test("known events and modules get human-readable localized names", () => {
  assert.equal(actionDisplayName("status_list_background", "en", "Other event"), "Background automation ran");
  assert.equal(actionDisplayName("agreement_updated", "sk", "Iná udalosť"), "Zmluva upravená");
  assert.equal(moduleDisplayName("status_list", "en", "Module"), "Status list");
});

test("opposite confirmation events have explicit localized badges and distinct filter/search keys", () => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    const confirmed = activityActionKey("status_list_confirmation", true);
    const removed = activityActionKey("status_list_confirmation", false);
    assert.notEqual(confirmed, removed);
    assert.equal(actionDisplayName(confirmed, locale, "fallback"), statusListConfirmationLabel(true, locale));
    assert.equal(actionDisplayName(removed, locale, "fallback"), statusListConfirmationLabel(false, locale));
    assert.notEqual(actionDisplayName(confirmed, locale, "fallback"), actionDisplayName(removed, locale, "fallback"));
    assert.equal(actionDisplayName(removed, locale, "fallback", "send_email"), statusListConfirmationLabel(false, locale));
  }
});
test("missing or malformed legacy confirmation flags are not invented as positive confirmations", () => {
  for (const flag of [undefined, null, "false", "true", 0, 1, {}]) {
    assert.equal(activityActionKey("status_list_confirmation", flag), "status_list_confirmation");
    assert.equal(actionDisplayName("status_list_confirmation", "en", "fallback"), "Action recorded");
  }
  assert.equal(actionDisplayName(activityActionKey("status_list_confirmation", false), "en", "fallback"), "Step confirmation removed");
  assert.equal(activityActionKey("agreement_updated", false), "agreement_updated");
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
