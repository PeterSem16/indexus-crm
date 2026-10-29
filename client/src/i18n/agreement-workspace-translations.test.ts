import assert from "node:assert/strict";
import test from "node:test";
import { translations, type Locale } from "./translations";
import { agreementWorkspaceTranslations } from "./agreement-workspace-translations";
import { recordActivityTranslations } from "../components/record-activity-translations";

for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as Locale[]) {
  test(`agreement workspace copy is registered in the real ${locale} dictionary`, () => {
    const copy = translations[locale].agreementWorkspace;
    assert.deepEqual(copy, agreementWorkspaceTranslations[locale]);
    assert.deepEqual(translations[locale].recordActivity, recordActivityTranslations[locale]);
    for (const category of ["actions", "fields", "moduleNames"] as const) {
      for (const [key, value] of Object.entries(recordActivityTranslations.en[category])) {
        assert.ok(recordActivityTranslations[locale][category][key]?.trim(), `${locale}: ${category}.${key} is translated`);
      }
    }
    for (const [key, value] of Object.entries(copy)) {
      assert.equal(typeof value, "string", `${key} is a string`);
      assert.ok(value.trim(), `${key} is not blank`);
    }
  });
}
