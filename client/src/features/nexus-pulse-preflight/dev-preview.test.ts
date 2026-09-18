import { strict as assert } from "node:assert";
import { test } from "node:test";
import { canUsePulseDevPreview, pulseDevPreviewCopy } from "./dev-preview";

test("production ignores the UI preview switch even on a preview host", () => {
  for (const host of ["example.replit.dev", "localhost", "127.0.0.1", "app.replit.app"]) {
    assert.equal(canUsePulseDevPreview(false, host), false);
  }
});
test("development permits only Replit preview and local test hosts", () => {
  for (const host of ["example.replit.dev", "localhost", "127.0.0.1"]) {
    assert.equal(canUsePulseDevPreview(true, host), true);
  }
  for (const host of ["app.replit.app", "crm.example.com", "example.replit.dev.evil.com"]) {
    assert.equal(canUsePulseDevPreview(true, host), false);
  }
});
test("all supported locales explain that data and actions are real", () => {
  for (const locale of ["sk", "cs", "en", "hu", "ro", "it", "de"]) {
    const copy = pulseDevPreviewCopy(locale);
    assert.ok(copy.enter && copy.notice && copy.exit);
  }
});