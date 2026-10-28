import assert from "node:assert/strict";
import test from "node:test";
import { translations, type Locale } from "./translations";
import { automationAttachmentTranslations } from "./automation-attachment-translations";

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
}
