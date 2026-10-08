import { test } from "node:test";
import assert from "node:assert/strict";
import { taskAutomationTranslations } from "../i18n/task-automation-translations";

test("task rule copy has every field and event in all seven languages", () => {
  const expected = taskAutomationTranslations.en;
  assert.equal(Object.keys(taskAutomationTranslations).length, 7);
  for (const [locale, copy] of Object.entries(taskAutomationTranslations)) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(expected).sort(), locale);
    assert.deepEqual(Object.keys(copy.fieldLabels).sort(), Object.keys(expected.fieldLabels).sort(), locale);
    assert.deepEqual(Object.keys(copy.eventDescriptions).sort(), Object.keys(expected.eventDescriptions).sort(), locale);
    for (const value of [...Object.values(copy.fieldLabels), ...Object.values(copy.eventDescriptions)]) {
      assert.equal(typeof value, "string", locale);
      assert.ok(value.trim().length > 0, locale);
    }
  }
});

test("Status changed explains the completion exception in all seven languages", () => {
  const exceptionNotes = {
    en: /except.*Completed/,
    sk: /okrem.*Completed/,
    cs: /kromě.*Completed/,
    hu: /kivéve.*Befejezett/,
    ro: /excepția.*Finalizată/,
    it: /tranne.*Completata/,
    de: /außer.*Abgeschlossen/,
  };
  for (const locale of Object.keys(exceptionNotes) as (keyof typeof exceptionNotes)[]) {
    assert.match(taskAutomationTranslations[locale].eventDescriptions.status_changed, exceptionNotes[locale], locale);
  }
});
