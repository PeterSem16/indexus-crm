import assert from "node:assert/strict";
import test from "node:test";
import { hospitalAgreementTranslations } from "./hospital-agreement-copy";

test("all seven locales have complete nonempty hospital agreement and destructive-confirmation copy", () => {
  const keys = Object.keys(hospitalAgreementTranslations.en).sort();
  assert.deepEqual(Object.keys(hospitalAgreementTranslations).sort(), ["cs", "de", "en", "hu", "it", "ro", "sk"]);
  for (const [locale, copy] of Object.entries(hospitalAgreementTranslations)) {
    assert.deepEqual(Object.keys(copy).sort(), keys, locale);
    for (const [key, value] of Object.entries(copy)) assert.ok(value.trim(), `${locale}.${key}`);
    assert.notEqual(copy.deleteConfirm, copy.deleteCancel, `${locale}: delete and cancel must be distinct`);
  }
});
