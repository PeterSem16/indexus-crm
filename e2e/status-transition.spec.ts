import { expect, test, type Page } from "@playwright/test";
import { medicalPartnerAudit, MEDICAL_PARTNER_AUDIT_CAMPAIGN } from "../shared/status-list-transition-audit";
import type { TransitionInventories } from "../shared/status-list-transition";
import { getStatusListTransitionCopy } from "../client/src/components/status-list-transition-copy";
import { createHash } from "node:crypto";
import { transitionExportPayload, type TransitionExport } from "../shared/status-list-transition-export";
import { getTransitionEvidenceCopy } from "../client/src/components/status-list-transition-evidence-copy";

const audited = medicalPartnerAudit(MEDICAL_PARTNER_AUDIT_CAMPAIGN)!;
const makeData = (): TransitionInventories => ({
  current: { ...structuredClone(audited), source: "current_configuration", fingerprint: "current-test", evidence: {
    ...audited.evidence, sourceCommit: null, schemaAvailable: true,
  } },
  audited: structuredClone(audited),
});
async function setup(page: Page, data = makeData()) {
  const writes: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/test-fixtures/status-transition.html*", async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/src="\/src\/main\.tsx[^"]*"/, 'src="/test-fixtures/status-transition.tsx"');
    await route.fulfill({ response, body: html });
  });
  await page.route("**/api/**", async route => {
    if (route.request().method() !== "GET") writes.push(route.request().method());
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/transition-inventory")) return route.fulfill({ json: data });
    if (path.endsWith("/transition-runtime")) return route.fulfill({ json: {
      runtimeVersion: "callback-compat-v1", activationAllowed: false, group: null,
      counts: { pending: 0, blocked: 0, done: 0, deferred: 0 }, cutovers: [],
    } });
    if (path.endsWith("/history")) return route.fulfill({ json: { runs: [] } });
    return route.fulfill({ json: { rules: [], catalog: [] } });
  });
  return { writes, errors, data };
}

test("real diagnostics default to current config, explicitly switch to audit, compare and preserve exclusions", async ({ page }) => {
  const { writes, errors } = await setup(page);
  await page.goto("/test-fixtures/status-transition.html");
  await expect(page.getByTestId("transition-source")).toHaveValue("current_configuration");
  await page.getByTestId("transition-source").selectOption("audited_production");
  await expect(page.getByTestId("transition-not-live-warning")).toContainText("historický");
  await expect(page.getByTestId("transition-action-inventory").locator("article")).toHaveCount(10);
  await expect(page.getByTestId("transition-action-ff8a1238-dc56-4923-945c-eaa66ca6c29b")).toContainText(getStatusListTransitionCopy("sk").excluded);
  await expect(page.getByTestId("transition-action-3023d4d4-8182-4556-8a47-04c4af379c49")).toContainText("7");
  await expect(page.getByTestId("transition-action-5ccd33f1-4261-4cef-afad-b0c739501b65")).toContainText(getStatusListTransitionCopy("sk").notify);
  await expect(page.getByTestId("transition-gates").locator("li")).toHaveCount(5);
  await page.getByTestId("transition-item").selectOption(audited.actions[0].itemId);
  await page.getByTestId("transition-call-count").fill("1");
  await page.getByTestId("transition-compare").click();
  await expect(page.getByTestId("transition-results")).toBeVisible();
  await expect(page.getByTestId("transition-boundary-matrix")).toBeVisible();
  await expect(page.getByTestId("transition-results")).toContainText(getStatusListTransitionCopy("sk").conditionFalse);
  await page.screenshot({ path: "generated-artifacts/status-transition/desktop.jpg", fullPage: true });
  await page.getByTestId("transition-call-count").fill("0");
  await expect(page.getByTestId("transition-results")).toHaveCount(0);
  await page.getByTestId("transition-clock-scenario").selectOption("friday");
  await page.getByTestId("transition-compare").click();
  await expect(page.getByTestId("transition-results")).toContainText("26.");
  await page.getByTestId("transition-clock-scenario").selectOption("manual");
  await expect(page.getByTestId("transition-results")).toHaveCount(0);
  await page.getByTestId("transition-compare").click();
  await expect(page.getByTestId("transition-results")).toContainText("10:30");
  await page.getByTestId("transition-source").selectOption("current_configuration");
  await expect(page.getByTestId("transition-results")).toHaveCount(0);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("all seven locales render with no missing labels", async ({ page }) => {
  const { errors } = await setup(page);
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
    await page.goto(`/test-fixtures/status-transition.html?locale=${locale}`);
    await expect(page.getByTestId("status-list-transition-diagnostics")).toContainText(getStatusListTransitionCopy(locale).title);
    await expect(page.getByTestId("transition-source")).toBeVisible();
    await expect(page.getByTestId("transition-gates").locator("li")).toHaveCount(5);
    expect(await page.getByTestId("status-list-transition-diagnostics").innerText()).not.toContain("undefined");
  }
  expect(errors).toEqual([]);
});

test("manual action transport retry reuses identity and acknowledgment permits a new action", async ({ page }) => {
  await setup(page);
  const identities: string[] = [];
  const actionPath = `/api/campaigns/${MEDICAL_PARTNER_AUDIT_CAMPAIGN}/contacts/test/status-list-actions/test/run`;
  await page.route(`**${actionPath}`, async route => {
    identities.push(route.request().postDataJSON().callbackEventId);
    if (identities.length === 1) return route.abort("failed");
    return route.fulfill({ json: { ok: true, callbackDate: "2026-11-01T09:30:00.000Z" } });
  });
  await page.goto("/test-fixtures/status-transition.html");
  await expect(page.getByTestId("transition-runtime-status")).toContainText(getStatusListTransitionCopy("sk").notEnrolled);
  await page.evaluate(async url => {
    const { apiRequest } = await import("/src/lib/queryClient.ts");
    try { await apiRequest("POST", url, { callbackDate: null }); } catch {}
    await apiRequest("POST", url, { callbackDate: null });
    await apiRequest("POST", url, { callbackDate: null });
  }, actionPath);
  expect(identities).toHaveLength(3);
  expect(identities[0]).toBe(identities[1]);
  expect(identities[2]).not.toBe(identities[1]);
});

test("mobile and dark layouts keep the complete controls in bounds", async ({ page }) => {
  const { errors } = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/test-fixtures/status-transition.html?dark=1");
  await page.getByTestId("transition-source").selectOption("audited_production");
  await page.getByTestId("transition-compare").click();
  await expect(page.getByTestId("transition-results")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  const bounds = await page.getByTestId("transition-compare").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "generated-artifacts/status-transition/mobile-dark.jpg", fullPage: true });
  expect(errors).toEqual([]);
});

test("empty current config has no enabled simulation, and another Mission has no audited source", async ({ page }) => {
  const data = makeData();
  data.current.actions = [];
  data.audited = null;
  await setup(page, data);
  await page.goto("/test-fixtures/status-transition.html");
  await expect(page.getByTestId("transition-action-inventory")).toContainText(getStatusListTransitionCopy("sk").empty);
  await expect(page.getByTestId("transition-compare")).toBeDisabled();
  await expect(page.getByTestId("transition-source").locator("option")).toHaveCount(1);
});

test("HTTP error is not treated as inventory data and retry recovers", async ({ page }) => {
  await setup(page);
  await page.route("**/status-list-workflows/transition-inventory", route =>
    route.fulfill({ status: 403, json: { error: "forbidden" } }));
  await page.goto("/test-fixtures/status-transition.html");
  await expect(page.getByTestId("transition-inventory-retry")).toBeVisible();
  await expect(page.getByTestId("transition-action-inventory")).toHaveCount(0);
  await page.unroute("**/status-list-workflows/transition-inventory");
  await page.getByTestId("transition-inventory-retry").click();
  await expect(page.getByTestId("transition-action-inventory").locator("article")).toHaveCount(10);
});

function exportFixture(changed = false): TransitionExport {
  const value: TransitionExport = {
    format: "indexus-transition-inventory-v1", campaignId: MEDICAL_PARTNER_AUDIT_CAMPAIGN,
    capturedAt: new Date().toISOString(),
    source: { instance: "a".repeat(64), commit: "b".repeat(40), runtime: "production", productionIdentityVerified: false },
    records: [
      { kind: "campaign", id: MEDICAL_PARTNER_AUDIT_CAMPAIGN, digest: "c".repeat(64) },
      { kind: "disposition", id: "bdf39464-05f3-4d4c-aaf0-1490f38d4dba", digest: (changed ? "e" : "d").repeat(64) },
    ],
    dependencies: [
      { owner: MEDICAL_PARTNER_AUDIT_CAMPAIGN, kind: "schema", target: null, state: "present", digest: "e".repeat(64) },
      { owner: MEDICAL_PARTNER_AUDIT_CAMPAIGN, kind: "executor", target: null, state: "unknown", digest: null },
    ],
    unknowns: ["source_identity"], activationAllowed: false, fingerprint: "0".repeat(64),
  };
  value.fingerprint = createHash("sha256").update(transitionExportPayload(value)).digest("hex");
  return value;
}
async function uploadExport(page: Page, slot: string, value: unknown) {
  await page.getByTestId(`transition-import-${slot}`).setInputFiles({
    name: "evidence.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(value)),
  });
}
test("fresh export diff is local, explains drift and clears damaged evidence without writes", async ({ page }) => {
  const { writes, errors } = await setup(page);
  const old = exportFixture();
  const current = exportFixture(true);
  await page.route("**/transition-export", route => route.fulfill({ json: current }));
  await page.goto("/test-fixtures/status-transition.html");
  const copy = getTransitionEvidenceCopy("sk");
  await expect(page.getByTestId("transition-export")).toBeEnabled();
  const downloadEvent = page.waitForEvent("download");
  await page.getByTestId("transition-export").click();
  await downloadEvent;
  await expect(page.getByTestId("transition-evidence-result")).toContainText(current.fingerprint);
  await uploadExport(page, "previous", old);
  await expect(page.getByTestId("transition-evidence-diff")).toContainText(copy.changed);
  await expect(page.getByTestId("transition-evidence-diff")).toContainText(copy.disposition);
  await expect(page.getByTestId("transition-evidence-result")).toContainText(copy.configuration_changed);
  await page.getByTestId("transition-evidence").screenshot({ path: "generated-artifacts/status-transition/evidence-diff.jpg" });
  await expect(page.getByTestId("transition-evidence-blocked")).toContainText(copy.blocked);
  await uploadExport(page, "current", { ...current, fingerprint: "0".repeat(64) });
  await expect(page.getByTestId("transition-evidence")).toContainText(copy.error);
  await expect(page.getByTestId("transition-evidence-result")).toHaveCount(0);
  const uploads: string[] = [];
  page.on("request", req => { if (req.method() !== "GET") uploads.push(req.method()); });
  await uploadExport(page, "current", current);
  await expect(page.getByTestId("transition-evidence-result")).toBeVisible();
  await uploadExport(page, "previous", { ...old, campaignId: "bdf39464-05f3-4d4c-aaf0-1490f38d4dba" });
  await expect(page.getByTestId("transition-evidence-result")).toHaveCount(0);
  expect(uploads).toEqual([]);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test("stale evidence and failed export never reuse successful results", async ({ page }) => {
  await setup(page);
  await page.goto("/test-fixtures/status-transition.html");
  const copy = getTransitionEvidenceCopy("sk");
  const stale = exportFixture();
  stale.capturedAt = new Date(Date.now() - 20 * 60_000).toISOString();
  stale.fingerprint = createHash("sha256").update(transitionExportPayload(stale)).digest("hex");
  await expect(page.getByTestId("transition-export")).toBeEnabled();
  await uploadExport(page, "current", stale);
  await expect(page.getByTestId("transition-evidence-result")).toContainText(copy.stale);
  await page.route("**/transition-export", route => route.fulfill({ status: 403, json: { error: "forbidden" } }));
  await page.getByTestId("transition-export").click();
  await expect(page.getByTestId("transition-evidence")).toContainText(copy.exportError);
  await expect(page.getByTestId("transition-evidence-result")).toHaveCount(0);
});

test("fresh evidence becomes stale without a new upload", async ({ page }) => {
  await setup(page);
  await page.clock.install({ time: new Date() });
  await page.goto("/test-fixtures/status-transition.html");
  await expect(page.getByTestId("transition-export")).toBeEnabled();
  const value = exportFixture();
  await uploadExport(page, "current", value);
  const copy = getTransitionEvidenceCopy("sk");
  await expect(page.getByTestId("transition-evidence-result")).not.toContainText(copy.stale);
  await page.clock.fastForward(16 * 60_000);
  await expect(page.getByTestId("transition-evidence-result")).toContainText(copy.stale);
});
