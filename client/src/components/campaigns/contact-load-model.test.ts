import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { canApplyContactLoad, contactLoadPage, ContactLoadError, contactLoadErrorCopy } from "./contact-load-model";
import type { LoadPreview } from "./contact-load-model";
import { contactLoadTranslations } from "./contact-load-translations";

const preview: LoadPreview = {
  id: "batch-17", source: "crm", status: "preview", createdAt: "2026-03-17T10:00:00Z",
  expiresAt: "2026-03-17T11:00:00Z", counts: { new: 7, existing: 13, invalid: 0 }, items: [],
};
const now = Date.parse("2026-03-17T10:30:00Z");
test("valid zero-new batches can finish, but invalid and expired batches never apply", () => {
  assert.equal(canApplyContactLoad(preview, now), true);
  assert.equal(canApplyContactLoad({ ...preview, counts: { new: 0, existing: 13, invalid: 0 } }, now), true);
  assert.equal(canApplyContactLoad({ ...preview, counts: { ...preview.counts, invalid: 1 } }, now), false);
  assert.equal(canApplyContactLoad(preview, Date.parse(preview.expiresAt)), false);
  assert.equal(canApplyContactLoad({ ...preview, expiresAt: "invalid" }, now), false);
});
test("row pagination caps rendering at 5000 and retains original row numbers", () => {
  const batch = { ...preview, items: Array.from({ length: 5100 }, (_, row) => ({ row: row + 1, name: "Elena", country: "SK", disposition: "new" as const })) };
  assert.equal(contactLoadPage(batch, 0).length, 50);
  assert.equal(contactLoadPage(batch, 1)[0].row, 51);
  assert.equal(contactLoadPage(batch, 99).at(-1)?.row, 5000);
  assert.equal(contactLoadPage(batch, 100).length, 0);
});
test("every locale has typed, nonempty safe messages and never leaks unknown errors", () => {
  for (const copy of Object.values(contactLoadTranslations)) {
    assert.deepEqual(Object.keys(copy).sort(), Object.keys(contactLoadTranslations.en).sort());
    for (const value of Object.values(copy)) assert.ok(value.trim());
    assert.equal(contactLoadErrorCopy(new Error("SQL private detail"), copy), copy.error);
    assert.equal(contactLoadErrorCopy(new Error("preview_expired"), copy), copy.stale);
    assert.equal(contactLoadErrorCopy(new Error("stale_preview"), copy), copy.stale);
    assert.equal(contactLoadErrorCopy(new Error("invalid_rows"), copy), copy.invalidError);
    assert.equal(contactLoadErrorCopy(new Error("phase_policy_required"), copy), copy.policy);
    assert.equal(contactLoadErrorCopy(new ContactLoadError("detail", 403), copy), copy.forbidden);
    assert.equal(contactLoadErrorCopy(new ContactLoadError("detail", 413), copy), copy.input);
  }
});
test("Mission entrypoints preserve the filter editor and cannot call legacy load endpoints", () => {
  const page = readFileSync("client/src/pages/campaign-detail.tsx", "utf8");
  assert.ok(page.includes("<ContactCriteriaBuilder"));
  assert.ok(page.includes("<ContactLoadReview controller={contactLoads}"));
  assert.ok(page.includes("<ContactLoadHistoryButton controller={contactLoads}"));
  assert.ok(page.includes('source: "crm"'));
  assert.ok(page.includes('formData.append("source", "file")'));
  assert.doesNotMatch(page, /\/generate-contacts[`"]/);
  assert.doesNotMatch(page, /\/contacts\/import[`"]/);
  assert.doesNotMatch(page, /formData\.append\("updateExisting"/);
  assert.doesNotMatch(page, /button-delete-last-import/);
});
