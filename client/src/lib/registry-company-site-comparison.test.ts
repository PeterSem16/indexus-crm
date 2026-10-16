import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { healthcareLegalEntityTranslations as copies } from "../i18n/healthcare-legal-entity-translations";

const require = createRequire(import.meta.url);
const bundled = await build({
  entryPoints: [path.resolve("client/src/components/healthcare-legal-entities/RegistryCompanySiteComparison.tsx")],
  bundle: true, platform: "node", format: "cjs", write: false,
  loader: { ".css": "empty" }, external: ["react", "react-dom", "lucide-react"],
  alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared") },
  jsx: "automatic",
});
const loaded = { exports: {} as Record<string, React.ComponentType<any>> };
new Function("require", "module", "exports", bundled.outputFiles[0].text)(require, loaded, loaded.exports);
const Component = loaded.exports.RegistryCompanySiteComparison;
const site = { name: "Orion Health", address: "Clinic street 1", city: "Trnava", postalCode: "917 01", ico: "12 345 678" };
const company = { name: "Orion Health", registeredAddress: "Registered street 2", city: "Trnava", postalCode: "917 01", ico: "12345678" };
const render = (locale: keyof typeof copies, props: Record<string, unknown> = {}) =>
  renderToStaticMarkup(React.createElement(Component, { site, registryCompany: company, c: copies[locale], ...props }));

test("approved comparison preserves five source-labeled read-only pairs in all seven languages", () => {
  for (const locale of Object.keys(copies) as Array<keyof typeof copies>) {
    const html = render(locale);
    assert.equal((html.match(/class="ler-compare-row ler-row-match"/g) || []).length, 4, locale);
    assert.equal((html.match(/class="ler-compare-row ler-row-different"/g) || []).length, 1, locale);
    assert.equal((html.match(/class="ler-value-card /g) || []).length, 10, locale);
    assert.ok(html.includes(copies[locale].comparisonSummary));
    assert.ok(html.includes(copies[locale].comparedFields.replace("{count}", "5")));
    assert.ok(html.includes("Clinic street 1") && html.includes("Registered street 2"));
    assert.doesNotMatch(html, /<(input|button|select)\b|role="checkbox"/);
    assert.equal((render(locale, { embedded: false }).match(/<h3/g) || []).length, 0);
  }
});

test("missing and empty fields remain distinct from differences; missing sources are explicit", () => {
  const html = render("sk", { site: { ...site, address: "", city: "", postalCode: "" }, registryCompany: { ...company, city: "", postalCode: "" } });
  assert.equal((html.match(/class="ler-compare-row ler-row-missing"/g) || []).length, 1);
  assert.equal((html.match(/class="ler-compare-row ler-row-empty"/g) || []).length, 2);
  assert.ok(render("sk", { registryCompany: null }).includes(copies.sk.siteComparisonSourceUnavailable));
  assert.ok(render("sk", { site: null }).includes(copies.sk.siteComparisonSiteUnavailable));
  assert.match(render("sk", { loading: true }), /aria-busy="true"/);
});

test("all new flow labels are present in every language and preserve the field-count placeholder", () => {
  for (const c of Object.values(copies)) {
    for (const key of ["operatorTitle", "operatorSubtitle", "verifiedLink", "noSavedVerification", "icoReady",
      "previewNotSaved", "confirmationSaved", "confirmationSavedHint", "savedShort", "comparisonKicker",
      "verificationKicker", "reviewFoundRecord", "reviewFoundRecordHint", "verificationHint", "icoFromCardHint",
      "fromCard", "recordFound", "confirmOperatorTitle", "advancedOptions", "replaceOperatorHint",
      "comparisonSummary", "comparedFields"] as const) assert.ok(c[key]?.trim(), key);
    assert.ok(c.comparedFields.includes("{count}"));
  }
});
