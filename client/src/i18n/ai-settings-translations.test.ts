import assert from "node:assert/strict";
import { test } from "node:test";
import { translations } from "./translations";
import { AI_SERVICES } from "../../../server/lib/ai/service-catalog";
const languages = ["en", "sk", "cs", "hu", "ro", "it", "de"] as const;
for (const locale of languages) test(`AI settings runtime dictionary is complete and nonempty: ${locale}`, () => {
  const copy = translations[locale].aiSettings;
  assert.deepEqual(Object.keys(copy).sort(), Object.keys(translations.en.aiSettings).sort());
  for (const [key, value] of Object.entries(copy)) {
    if (key === "operations") {
      for (const operation of new Set(Object.values(AI_SERVICES))) assert((value as Record<string, string>)[operation]?.trim());
    } else assert(typeof value === "string" && value.trim(), `${locale}.${key}`);
  }
});
