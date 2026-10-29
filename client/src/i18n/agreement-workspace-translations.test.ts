import assert from "node:assert/strict";
import test from "node:test";
import { translations, type Locale } from "./translations";
import { agreementWorkspaceTranslations } from "./agreement-workspace-translations";

for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as Locale[]) {
  test(`agreement workspace copy is registered in the real ${locale} dictionary`, () => {
    const copy = translations[locale].agreementWorkspace;
    assert.deepEqual(copy, agreementWorkspaceTranslations[locale]);
    for (const [key, value] of Object.entries(copy)) {
      assert.equal(typeof value, "string", `${key} is a string`);
      assert.ok(value.trim(), `${key} is not blank`);
    }
  });
}
