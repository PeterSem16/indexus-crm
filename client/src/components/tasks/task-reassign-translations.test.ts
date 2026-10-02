import assert from "node:assert/strict";
import { translations, type Locale } from "../../i18n/translations";

const locales: Locale[] = ["sk", "cs", "en", "hu", "ro", "it", "de"];
const keys = Object.keys(translations.en.tasks.reassignDialog).sort();
assert.equal(keys.length, 21);
for (const locale of locales) {
  const copy = translations[locale].tasks.reassignDialog;
  assert.deepEqual(Object.keys(copy).sort(), keys, `Incomplete reassignment copy for ${locale}`);
  for (const [key, value] of Object.entries(copy)) {
    assert.ok(typeof value === "string" && value.trim(), `${locale}.${key} must contain translated text`);
  }
  assert.ok(copy.memberCount.includes("{count}"), `${locale} must retain the member count placeholder`);
  assert.ok(copy.currentGroup.trim(), `${locale}.currentGroup must contain translated text`);
}
console.log("Task reassignment translations verified in all seven language objects.");