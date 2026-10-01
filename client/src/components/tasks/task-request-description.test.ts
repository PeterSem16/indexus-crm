import assert from "node:assert/strict";
import { translations, type Locale } from "../../i18n/translations";
import { getTaskRequestBrief } from "../../lib/task-request-brief";
import {
  applyTaskRequestCategory,
  composeTaskRequestDescription,
} from "./task-request-description";

const locales: Locale[] = ["en", "sk", "cs", "hu", "ro", "it", "de"];
const categoryKeys = [
  "ChangeData",
  "WrongPhone",
  "WrongEmail",
  "WrongAddress",
  "Document",
  "Complaint",
  "Other",
] as const;

for (const locale of locales) {
  for (const category of categoryKeys) {
    const body = "Please use 17 Cedar Lane, not the old address.\n\nKeep the second paragraph intact.";
    const description = composeTaskRequestDescription(
      "Mila Novak",
      translations[locale].quickCreate[`req${category}`],
      body,
    );
    assert.equal(description.split("\n")[0], "Mila Novak", `${locale} ${category}: entity prefix`);
    const brief = getTaskRequestBrief(description, locale);
    assert.equal(brief.category, category, `${locale} ${category}: category`);
    assert.equal(brief.request, body, `${locale} ${category}: multiline agent body`);
  }
}

assert.equal(
  composeTaskRequestDescription(undefined, "Please update the address:", "17 Cedar Lane"),
  "Please update the address:\n17 Cedar Lane",
  "category prefix works without an entity",
);
assert.equal(
  composeTaskRequestDescription("  Mila Novak  ", undefined, "Use 17 Cedar Lane"),
  "Mila Novak\nUse 17 Cedar Lane",
  "entity works without a category",
);
assert.equal(composeTaskRequestDescription(undefined, undefined, ""), "");
assert.equal(
  getTaskRequestBrief(composeTaskRequestDescription(undefined, translations.en.quickCreate.reqOther, ""), "en").isFeatured,
  false,
  "empty agent text does not invent a featured request",
);
assert.equal(
  getTaskRequestBrief("An unrecognized request with multiple\nparagraphs.", "en").request,
  "An unrecognized request with multiple\nparagraphs.",
  "unknown content is retained unchanged",
);

const initialForm = {
  title: "Wrong address — Mila Novak",
  description: "Use 17 Cedar Lane.\n\nThis is my authored text.",
  category: "wrong_address",
  priority: "high",
};
const recategorized = applyTaskRequestCategory(initialForm, "wrong_phone", "Wrong phone — Mila Novak");
assert.equal(recategorized.description, initialForm.description, "category changes retain authored body");
assert.equal(recategorized.category, "wrong_phone");
assert.equal(recategorized.priority, "high");

const body = "Use 17 Cedar Lane.\n\nThis is my authored text.";
const composedOnce = composeTaskRequestDescription("Mila Novak", translations.en.quickCreate.reqWrongAddress, body);
assert.equal(composedOnce.split(translations.en.quickCreate.reqWrongAddress).length - 1, 1, "category preamble is composed once");
assert.equal(getTaskRequestBrief(composedOnce, "en").request, body, "submit composition is extracted once");
const trailingLineBreaks = "Use 17 Cedar Lane.\n\n";
assert.equal(
  getTaskRequestBrief(
    composeTaskRequestDescription("Mila Novak", translations.en.quickCreate.reqWrongAddress, trailingLineBreaks),
    "en",
  ).request,
  trailingLineBreaks,
  "meaningful body spacing is not trimmed during submission",
);
console.log("task request description checks passed");