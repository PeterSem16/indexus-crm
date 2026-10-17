import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";
import type { RegistryComparison } from "../../../shared/healthcare-legal-entity";

test("comparison renders baseline, unchanged and changed states safely in all seven languages", async () => {
  // Use Vite's automatic JSX transform and aliases without booting the entire CRM.
  const bundled = await build({
    stdin: {
      contents: `
        import React from "react";
        import { renderToStaticMarkup } from "react-dom/server";
        import { RegistryComparisonPanel } from "./client/src/components/healthcare-legal-entity-comparison";
        import { healthcareLegalEntityTranslations as copies, getRegistryCopy, withRegistryCopy } from "./client/src/i18n/healthcare-legal-entity-translations";
        export function render(comparison, locale, canReview = false, download = false, pending = false) {
          return renderToStaticMarkup(React.createElement(RegistryComparisonPanel, { comparison, c: copies[locale],
            onReview: canReview ? () => {} : undefined, onDownload: download ? () => {} : undefined, downloadPending: pending }));
        }
        export { copies, getRegistryCopy, withRegistryCopy };
      `,
      resolveDir: process.cwd(), loader: "tsx",
    },
    bundle: true, platform: "node", format: "cjs", jsx: "automatic", packages: "external", write: false,
  });
  const module = { exports: {} as any };
  new Function("require", "module", "exports", bundled.outputFiles[0].text)(
    createRequire(import.meta.url), module, module.exports,
  );
  const { render, copies, getRegistryCopy, withRegistryCopy } = module.exports;
  const summary = { id: "new", checkedAt: "2026-10-15T12:00:00Z", sourceUpdatedAt: "2026-10-13T19:00:00Z" };
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
    const c = copies[locale];
    for (const [country, source] of [["SK", "OR SR"], ["CZ", "ARES"], ["RO", "ANAF"]] as const) {
      const provider = getRegistryCopy(c, country);
      assert.equal(provider.sourceLabel, source);
      assert.equal(provider.identifierLabel, country === "RO" ? "CUI" : c.ico);
      assert.equal(provider.sourceTimeLabel, c.registrySourceTime);
      const contextual = withRegistryCopy(c, country);
      if (country === "SK") assert.equal(contextual, c);
      else {
        assert.ok(Object.values(contextual).every((value) => !/OR[\s-]*SR/i.test(value)));
        if (country === "RO") assert.ok(Object.values(contextual).every((value) => !/IČO/i.test(value)));
        assert.ok(contextual.siteComparisonNotice.startsWith(c.siteComparisonSourceNotice));
        assert.ok(contextual.siteComparisonNotice.includes(source));
        assert.ok(contextual.recordSource.includes(source));
      }
    }
    const baseline: RegistryComparison = { current: summary, previous: null, fields: [], roles: { added: [], removed: [] } };
    assert.ok(render(baseline, locale).includes(c.firstVerification));
    assert.ok(!render(baseline, locale).includes("button-download-registry-comparison"));
    assert.ok(render(baseline, locale, false, true).includes(c.downloadComparison));
    const pendingHtml = render(baseline, locale, false, true, true);
    assert.ok(pendingHtml.includes(c.downloading));
    assert.ok(pendingHtml.includes('disabled=""'));
    const unchanged = { ...baseline, previous: { ...summary, id: "old" } };
    assert.ok(render(unchanged, locale).includes(c.registryUnchanged));
    const changed: RegistryComparison = {
      ...unchanged,
      fields: [{ field: "status", before: "active", after: "terminated" }],
      roles: { removed: [], added: [{ key: "x", name: "<script>alert(1)</script>", role: "Konateľ",
        kind: "statutoryBody", current: false, validFrom: null, validTo: "2026-10-15" }] },
    };
    const html = render(changed, locale);
    for (const label of [c.active, c.terminated, c.registrySourceTime, c.checkedAt, c.rolesAdded, c.comparisonReadOnly, c.ended])
      assert.ok(html.includes(label), `${locale}: ${label}`);
    assert.ok(!html.includes("<script>"));
    assert.ok(!html.includes(c.registryUnchanged));
    assert.ok(html.includes(c.changesPending));
    const taxFields = {
      ...changed,
      fields: [
        { field: "vatRegistered", before: "false", after: "true" },
        { field: "taxInactive", before: "null", after: "false" },
      ] as any,
    };
    const taxHtml = render(taxFields, locale);
    for (const label of [c.taxRegistered, c.taxInactive, c.yes, c.no])
      assert.ok(taxHtml.includes(label), `${locale}: ${label}`);
    assert.ok(!html.includes('data-testid="button-review-registry-changes"'));
    assert.ok(!html.includes('data-testid="input-registry-review-note"'));
    assert.ok(render(changed, locale, true).includes('data-testid="button-review-registry-changes"'));
    const editableHtml = render(changed, locale, true);
    assert.ok(editableHtml.includes(c.reviewNoteOptional));
    assert.ok(editableHtml.includes('maxLength="2000"') || editableHtml.includes('maxlength="2000"'));
    assert.ok(!render(unchanged, locale, true).includes('data-testid="button-review-registry-changes"'));
    assert.ok(!render(baseline, locale, true).includes('data-testid="button-review-registry-changes"'));
    const reviewed = { ...changed, current: { ...summary, review: {
      reviewedBy: "reviewer", reviewedByName: "<b>Reviewer</b>", reviewedAt: "2026-10-15T14:30:00Z",
      note: '<img src=x onerror="alert(1)">\nSecond line & reason',
    } } };
    const reviewedHtml = render(reviewed, locale, true);
    for (const label of [c.changesReviewed, c.reviewedBy, c.reviewedAt])
      assert.ok(reviewedHtml.includes(label));
    assert.ok(reviewedHtml.includes("&lt;b&gt;Reviewer&lt;/b&gt;"));
    assert.ok(reviewedHtml.includes(c.reviewNote));
    assert.ok(reviewedHtml.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'));
    assert.ok(reviewedHtml.includes("\nSecond line &amp; reason"));
    assert.ok(!reviewedHtml.includes("<img"));
    assert.ok(!reviewedHtml.includes('data-testid="input-registry-review-note"'));
    const legacyHtml = render({ ...reviewed, current: { ...reviewed.current, review: {
      ...reviewed.current.review, note: null,
    } } }, locale);
    assert.ok(!legacyHtml.includes('data-testid="registry-review-note"'));
    assert.ok(!reviewedHtml.includes('data-testid="button-review-registry-changes"'));
  }
});
