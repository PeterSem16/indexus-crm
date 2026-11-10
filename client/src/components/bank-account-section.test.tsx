import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BankAccountSection } from "./bank-account-section";
import { translations } from "@/i18n/translations";

const props = {
  countryCode: "SK", t: translations.sk,
  bankAccountName: "Clinic agreement account", accountNumber: "19-8742637541", bankCode: "1200",
  bankAccountIban: "SK3112000000198742637541", swiftCode: "TESTSKBX",
  isHidden: () => false, isReadonly: () => false,
  onIbanChange: () => {}, onSwiftChange: () => {}, onAccountNameChange: () => {},
};
test("clinic preview shows all saved bank fields without editable controls", () => {
  const html = renderToStaticMarkup(<BankAccountSection {...props} isReadonly={() => true} />);
  for (const value of [props.bankAccountName, props.accountNumber, props.bankCode, props.bankAccountIban, props.swiftCode]) assert(html.includes(value));
  const inputs = html.match(/<input\b[^>]*>/g) || [];
  assert.equal(inputs.length, 5);
  assert(inputs.every(input => /\bdisabled=/.test(input)), "Preview must disable every input");
  assert.match(html, /<button[^>]*disabled=""/);
});
test("Persons reuse the same layout without an unrelated clinic account-name field", () => {
  const html = renderToStaticMarkup(<BankAccountSection {...props} bankAccountName={undefined} />);
  assert(!html.includes('input-clinic-bank-account-name'));
  assert(html.includes('wizard-input-collaborator-iban'));
  assert(html.includes('wizard-input-account-number'));
});
test("field-level privacy hides all bank information, including conversion inputs", () => {
  assert.equal(renderToStaticMarkup(<BankAccountSection {...props} isHidden={() => true} />), "");
});
test("all banking labels are translated in all supported languages", () => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    const t = translations[locale];
    assert(t.clinicBanking.accountName && t.clinicBanking.description && t.wizard.steps.banking);
    for (const key of ["accountAndBankCode", "accountNumber", "bankCode", "calculateIban", "bankAccountIban", "swiftCode"] as const) assert(t.collaborators.fields[key], `${locale}:${key}`);
  }
});
