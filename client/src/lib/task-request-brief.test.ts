import assert from "node:assert/strict";
import { getTaskRequestBrief } from "./task-request-brief";
import { translations, type Locale } from "@/i18n/translations";

const locales: Locale[] = ["en", "sk", "cs", "hu", "ro", "it", "de"];
const prompt = (locale: Locale, key: string) => translations[locale].quickCreate[`req${key}` as keyof typeof translations[Locale]["quickCreate"]];

const mixed = getTaskRequestBrief(
  `Customer: Mila Novak\n${translations.en.quickCreate.reqChangeData}Prosím zmeniť názov spoločnosti\nAdditional context (ID: 12345678-1234-1234-1234-123456789abc)`,
  "en",
);
assert.equal(mixed.request, "Prosím zmeniť názov spoločnosti\nAdditional context");
assert.equal(mixed.category, "ChangeData");
assert.equal(mixed.original, "Customer: Mila Novak\nI request the following customer data change:Prosím zmeniť názov spoločnosti\nAdditional context");

const sameLine = getTaskRequestBrief(`${translations.sk.quickCreate.reqWrongPhone}0912 345 678`, "sk");
assert.equal(sameLine.request, "0912 345 678");
assert.equal(sameLine.category, "WrongPhone");

const lineSeparated = getTaskRequestBrief(`Zákazník\n  ${translations.cs.quickCreate.reqDocument}\n  Potvrzení o platbě\nDoručit e-mailem`, "cs");
assert.equal(lineSeparated.request, "Potvrzení o platbě\nDoručit e-mailem");
assert.equal(lineSeparated.category, "Document");

for (const locale of locales) {
  for (const key of ["ChangeData", "WrongPhone", "WrongEmail", "WrongAddress", "Document", "Complaint", "Other"]) {
    const actual = `Requested value for ${key}`;
    const result = getTaskRequestBrief(`${prompt(locale, key)}${actual}`, locale);
    assert.equal(result.request, actual, `${locale} ${key}`);
    assert.equal(result.category, key, `${locale} ${key}`);
  }
}

const unknown = "Client: A\nPlease update the address: keep this whole narrative.";
assert.deepEqual(getTaskRequestBrief(unknown, "en"), {
  original: unknown,
  request: unknown,
  category: null,
  isFeatured: false,
});
const narrative = "A narrative begins here\nContext: Request: this is user-written, not a template";
assert.equal(getTaskRequestBrief(narrative, "en").request, narrative);
const emptyTail = getTaskRequestBrief(`Customer\n${translations.en.quickCreate.reqOther}   `, "en");
assert.equal(emptyTail.request, emptyTail.original);
assert.equal(emptyTail.isFeatured, false);

const duplicated = `${translations.en.quickCreate.reqOther}First request\n${translations.en.quickCreate.reqOther}Second line is user text`;
assert.equal(getTaskRequestBrief(duplicated, "en").request, `First request\n${translations.en.quickCreate.reqOther}Second line is user text`);

const longText = "Change " + "field ".repeat(500) + "\nsecond paragraph";
assert.equal(getTaskRequestBrief(`${translations.de.quickCreate.reqChangeData}${longText}`, "de").request, longText);
assert.equal(getTaskRequestBrief("", "hu").request, "");
console.log("task request brief extraction checks passed");