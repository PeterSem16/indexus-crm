import assert from "node:assert/strict";
import { composePhoneIssueDetails, phoneIssueErrorText, phoneIssueTaskCanSubmit, phoneIssueText } from "./phone-issue-workflow";

const locales = ["sk", "en", "cs", "hu", "ro", "it", "de"];
for (const locale of locales) {
  assert.ok(phoneIssueText("wrongPerson", locale).length > 0);
  assert.ok(phoneIssueText("notWorking", locale).length > 0);
  assert.ok(phoneIssueText("verify", locale).length > 0);
  for (const code of [
    "phone_issue_already_reported",
    "phone_issue_stale",
    "phone_issue_invalid",
    "phone_issue_no_source",
  ]) {
    const translated = phoneIssueErrorText(code, locale);
    assert.notEqual(translated, code);
    assert.ok(translated.length > 0);
  }
  const description = composePhoneIssueDetails("Agent note", "wrong_person", "+421 900 111 222", locale);
  assert.ok(description.includes(phoneIssueText("reportedNumber", locale)));
  assert.ok(description.includes(phoneIssueText("wrongPerson", locale)));
  assert.ok(description.includes("+421 900 111 222"));
}

const missingSource = {
  phones: [{ field: "phone" as const, number: "+421 900 111 222" }],
  pendingVerification: null,
  sourceAvailable: false,
};
const readyArgs = {
  eligible: true, loading: false, fetching: false, error: false,
  data: missingSource, phoneField: "phone" as const,
};
assert.equal(phoneIssueTaskCanSubmit({ ...readyArgs, reason: "wrong_person" }), false);
assert.equal(phoneIssueTaskCanSubmit({ ...readyArgs, reason: "not_working" }), false);
assert.equal(phoneIssueTaskCanSubmit({ ...readyArgs, reason: "verify" }), true);
assert.equal(phoneIssueTaskCanSubmit({ ...readyArgs, reason: "verify", fetching: true }), false);
