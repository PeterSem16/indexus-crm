import { expect, test, type Page } from "@playwright/test";
import { medicalPartnerAudit, MEDICAL_PARTNER_AUDIT_CAMPAIGN } from "../shared/status-list-transition-audit";
import type { TransitionInventories } from "../shared/status-list-transition";
import { getStatusListTransitionCopy } from "../client/src/components/status-list-transition-copy";

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
