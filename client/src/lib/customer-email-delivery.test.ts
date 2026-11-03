import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { translations } from "../i18n/translations";

const keys = ["emailProviderNotConfigured", "emailProviderRejected", "emailProviderNetworkError"] as const;
for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
  for (const key of keys) {
    assert.ok(translations[locale].customers.details[key]?.trim(), `${locale}: ${key}`);
  }
}
const source = readFileSync(new URL("../pages/customers.tsx", import.meta.url), "utf8");
for (const [code, key] of [
  ["EMAIL_PROVIDER_NOT_CONFIGURED", "emailProviderNotConfigured"],
  ["EMAIL_PROVIDER_REJECTED", "emailProviderRejected"],
  ["EMAIL_PROVIDER_NETWORK_ERROR", "emailProviderNetworkError"],
]) {
  assert.ok(source.includes(`${code}: t.customers.details.${key}`));
}
console.log("Customer email delivery: all seven runtime locales and error-code mappings passed");
