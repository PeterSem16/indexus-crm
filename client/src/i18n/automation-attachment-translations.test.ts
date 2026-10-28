import assert from "node:assert/strict";
import test from "node:test";
import { translations, type Locale } from "./translations";
import { automationAttachmentTranslations } from "./automation-attachment-translations";
import { automationEligibilityTranslations } from "./automation-eligibility-translations";

for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as Locale[]) {
  test(`run attachment copy is registered in the real ${locale} application dictionary`, () => {
    const copy = translations[locale].automationAttachments;
    assert.ok(copy, "Run history must not read an undefined attachment namespace");
    assert.deepEqual(copy, automationAttachmentTranslations[locale]);
    for (const value of Object.values(copy)) {
      if (typeof value === "string") assert.ok(value.trim());
      else for (const reason of Object.values(value)) assert.ok(reason.trim());
    }
  });
  test(`run eligibility diagnostic copy is registered in the real ${locale} application dictionary`, () => {
    const copy = translations[locale].automationEligibility;
    assert.ok(copy, "Global Runs mounts the diagnostic even before a run is selected");
    assert.deepEqual(copy, automationEligibilityTranslations[locale]);
    assert.ok(copy.title.trim());
    assert.ok(copy.sources["email.received"]);
  });
}
