import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import copy from "../i18n/omni-group-translations";
import { translations } from "../i18n/translations";
test("all seven locales register the complete group copy in the real provider dictionary", () => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    assert.deepEqual(Object.keys(copy[locale]).sort(), Object.keys(copy.en).sort());
    for (const value of Object.values(copy[locale])) assert.ok(value.trim());
    assert.equal(translations[locale].omniGroups, copy[locale]);
  }
});
test("AI scope cannot override the selected scope, and search cache includes membership", () => {
  const source = readFileSync("client/src/pages/email-client.tsx", "utf8");
  const ai = source.slice(source.indexOf("const executeAiResult ="), source.indexOf("const toggleAiSearch ="));
  assert.match(ai, /setSearchMailbox\(smartSearchMailbox\)/);
  assert.doesNotMatch(ai, /result\.searchScope/);
  assert.match(source, /resolveMailboxScope\(searchMailbox, mailboxGroups, mailboxes\)/);
  assert.match(source, /searchDateTo, mailboxScopeFingerprint, groupScopeFingerprint/);
});
