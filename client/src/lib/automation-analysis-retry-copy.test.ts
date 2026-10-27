import assert from "node:assert/strict";
import test from "node:test";
import { automationRetryTranslations } from "../i18n/automation-retry-translations";

test("single-source retry has complete nonempty copy and every status in all seven languages", () => {
  const locales = ["en", "sk", "cs", "hu", "ro", "it", "de"] as const;
  assert.deepEqual(Object.keys(automationRetryTranslations).sort(), [...locales].sort());
  const keys = Object.keys(automationRetryTranslations.en).sort();
  for (const locale of locales) {
    const copy = automationRetryTranslations[locale];
    assert.deepEqual(Object.keys(copy).sort(), keys, locale);
    assert.deepEqual(Object.keys(copy.status).sort(), Object.keys(automationRetryTranslations.en.status).sort(), locale);
    for (const [key, value] of Object.entries(copy)) {
      for (const text of typeof value === "string" ? [value] : Object.values(value))
        assert.ok(text.trim().length > 0, `${locale}.${key}`);
    }
  }
});
