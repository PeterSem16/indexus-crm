import assert from "node:assert/strict";
import { test } from "node:test";
import { translations } from "../i18n/translations";
import { omniSearchMessageKey, omniSearchExportMessages, selectedOmniSearchMessages, toggleOmniSearchMessage, pruneOmniSearchSelection } from "./omni-search-selection";

const messages = omniSearchExportMessages([
  { mailbox: "A@example.test", emails: [{ id: "same", subject: "First" }, { id: "second" }, { id: "same", subject: "Duplicate" }] },
  { mailbox: "b@example.test", emails: [{ id: "same", subject: "Different mailbox" }, { id: "SAME", subject: "Case-sensitive ID" }] },
]);
test("message identity includes normalized mailbox, preserves Graph ID case and deduplicates", () => {
  assert.equal(messages.length, 4);
  assert.notEqual(omniSearchMessageKey(messages[0]), omniSearchMessageKey(messages[2]));
  assert.notEqual(omniSearchMessageKey(messages[2]), omniSearchMessageKey(messages[3]));
  assert.equal(messages[0].subject, "First");
  assert.equal(messages[1].subject, "");
});
test("default and new search select all; manual selection can be empty and toggles only the intended mailbox message", () => {
  assert.deepEqual(selectedOmniSearchMessages(messages, null, "search"), messages);
  let selection = toggleOmniSearchMessage(messages, null, "search", messages[0], false);
  assert.deepEqual(selectedOmniSearchMessages(messages, selection, "search"), messages.slice(1));
  selection = toggleOmniSearchMessage(messages, selection, "search", messages[0], true);
  assert.deepEqual(selectedOmniSearchMessages(messages, selection, "search"), messages);
  const none = { scope: "search", keys: new Set<string>() };
  assert.deepEqual(selectedOmniSearchMessages(messages, none, "search"), []);
  assert.deepEqual(selectedOmniSearchMessages(messages, none, "new-search"), messages);
  assert.equal(toggleOmniSearchMessage(messages, none, "search", { id: "not-in-results", mailbox: "a@example.test" }, true).keys.size, 0);
});
test("background results cannot silently add to custom selection; removed selections are pruned", () => {
  const selection = toggleOmniSearchMessage(messages, null, "search", messages[0], false);
  const added = { id: "new", mailbox: "a@example.test", subject: "New result" };
  assert.deepEqual(selectedOmniSearchMessages([...messages, added], selection, "search"), messages.slice(1));
  const pruned = pruneOmniSearchSelection([messages[0], added], selection, "search");
  assert.equal(pruned?.keys.size, 0);
  assert.deepEqual(selectedOmniSearchMessages(messages, pruned, "search"), []);
  assert.equal(pruneOmniSearchSelection(messages, selection, "other-search"), selection);
});
test("selection copy is registered in the real application dictionaries in all seven languages", () => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    const copy = translations[locale].omniGroups;
    for (const key of ["selectAllResults", "selectedResultsCount", "selectResult", "exportSelected", "sendZipDescription"] as const)
      assert.ok(copy[key]?.trim(), `${locale}.${key}`);
    assert.match(copy.selectedResultsCount, /\{selected\}/);
    assert.match(copy.selectedResultsCount, /\{total\}/);
    assert.match(copy.selectResult, /\{subject\}/);
  }
});
