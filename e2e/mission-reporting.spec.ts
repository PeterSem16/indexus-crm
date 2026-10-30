import { test, expect, type Page } from "@playwright/test";
import { computeMissionFunnel } from "../server/lib/mission-funnel";
import { emptyFunnelConfig } from "../shared/mission-funnel";
import { reportingBounds } from "../shared/reporting-period";

const report = {
  ...computeMissionFunnel({ clinics: [], enrollments: [], events: [], states: [], calls: [], items: [], config: emptyFunnelConfig() }),
  missionName: "Fixture Mission", canConfigure: false,
};
async function fixture(page: Page, dark = false) {
  const requests: URL[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.clock.install({ time: new Date("2026-10-30T12:00:00Z") });
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()); requests.push(url);
    const path = url.pathname;
    if (path.endsWith("/mission-funnel")) return route.fulfill({ json: report });
    if (path.endsWith("/agent-stats")) return route.fulfill({ json: [{ userId: "rep-one", name: "Rep One" }] });
    if (path === "/api/representatives") return route.fulfill({ json: [] });
    if (path.endsWith("/status-list-analytics")) return route.fulfill({ json: { totalContacts: 7 } });
    if (path.endsWith("/auth/me")) return route.fulfill({ json: { id: "test-admin", role: "admin" } });
    if (path.endsWith("/kpi-snapshots")) return route.fulfill({ json: [] });
    if (path.includes("/representative-performance/")) return route.fulfill({ body: "null", contentType: "application/json" });
    return route.fulfill({ json: [] });
  });
  await page.goto(`/test-fixtures/mission-reporting.html${dark ? "?dark" : ""}`);
  await expect(page.getByTestId("mission-funnel-chart")).toBeVisible();
  return { requests, errors };
}
test("one shared period survives funnel/productivity switching and reaches both APIs inclusively", async ({ page }) => {
  const { requests, errors } = await fixture(page);
  await expect(page.getByTestId("reporting-period")).toHaveCount(1);
  await page.getByTestId("reporting-preset-lastWeek").click();
  await expect.poll(() => requests.some(url => url.pathname.endsWith("/mission-funnel") && url.searchParams.get("from") === "2026-10-19" && url.searchParams.get("to") === "2026-10-25")).toBe(true);
  await page.getByTestId("tab-report-productivity").click();
  const bounds = reportingBounds({ from: "2026-10-19", to: "2026-10-25" });
  await expect.poll(() => requests.some(url => url.pathname.endsWith("/agent-productivity") && url.searchParams.get("from") === bounds.fromISO && url.searchParams.get("to") === bounds.toISO)).toBe(true);
  await expect(page.getByTestId("reporting-period")).toHaveCount(1);
  await page.getByTestId("tab-report-mission-funnel").click();
  await expect(page.getByTestId("reporting-preset-lastWeek")).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});
test("all representative report cards use the same selected range, not their local defaults", async ({ page }) => {
  const { requests, errors } = await fixture(page);
  await page.getByTestId("reporting-preset-lastMonth").click();
  const bounds = reportingBounds({ from: "2026-09-01", to: "2026-09-30" });
  for (const [tab, endpoint] of [
    ["report-data-quality", "data-quality"], ["report-clinic-kpis", "clinic-kpis"],
    ["report-hospital-plan", "hospital-plan"], ["report-comm-review", "communication-review"],
  ]) {
    await page.getByTestId(`tab-${tab}`).click();
    await page.getByTestId("reporting-active-report").getByRole("combobox").first().click();
    await page.getByRole("option", { name: /Rep One/ }).click();
    await expect.poll(() => requests.some(url => url.pathname.endsWith(`/${endpoint}`) && url.searchParams.get("from") === bounds.fromISO && url.searchParams.get("to") === bounds.toISO)).toBe(true);
    await expect(page.getByTestId("reporting-period")).toHaveCount(1);
  }
  expect(errors).toEqual([]);
});
test("Overview groups KPI/Status List and Status List CSV inherits the shared period", async ({ page }) => {
  const { requests, errors } = await fixture(page);
  await page.getByTestId("reporting-preset-today").click();
  await page.getByTestId("reporting-group-overview").click();
  await expect(page.getByTestId("tab-report-kpi")).toBeVisible();
  await expect(page.getByTestId("tab-report-status-list")).toBeVisible();
  await expect(page.getByTestId("tab-report-productivity")).toHaveCount(0);
  await page.getByTestId("tab-report-status-list").click();
  await expect(page.getByTestId("status-list-result")).toHaveText("7");
  const bounds = reportingBounds({ from: "2026-10-30", to: "2026-10-30" });
  const href = await page.getByTestId("status-list-export").getAttribute("href");
  const url = new URL(href!, "http://fixture");
  expect(url.searchParams.get("from")).toBe(bounds.fromISO);
  expect(url.searchParams.get("to")).toBe(bounds.toISO);
  expect(requests.some(request => request.pathname.endsWith("/status-list-analytics") && request.searchParams.get("from") === bounds.fromISO)).toBe(true);
  expect(errors).toEqual([]);
});
test("mobile dark navigation stays within viewport and changing Mission clears the old range", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { requests, errors } = await fixture(page, true);
  await page.getByTestId("reporting-preset-last7Days").click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: "generated-artifacts/mission-funnel/reporting-mobile.jpg", fullPage: false });
  await page.getByTestId("fixture-change-mission").click();
  await expect(page.getByTestId("reporting-preset-allTime")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => requests.some(url => url.pathname.includes("/second-mission/mission-funnel") && !url.searchParams.has("from"))).toBe(true);
  expect(errors).toEqual([]);
});
test("manual invalid ranges block report queries and choosing a preset restores the reports", async ({ page }) => {
  const { requests, errors } = await fixture(page);
  await page.getByTestId("reporting-preset-today").click();
  const before = requests.length;
  await page.getByTestId("mission-funnel-to-wrapper").getByTestId("input-create-task-duedate-day").selectOption("1");
  await expect(page.getByTestId("reporting-period").getByRole("alert")).toBeVisible();
  await page.getByTestId("tab-report-productivity").click();
  expect(requests.slice(before).some(url => url.pathname.endsWith("/agent-productivity"))).toBe(false);
  await page.getByTestId("reporting-preset-yesterday").click();
  await expect(page.getByTestId("reporting-period").getByRole("alert")).toHaveCount(0);
  const bounds = reportingBounds({ from: "2026-10-29", to: "2026-10-29" });
  await expect.poll(() => requests.some(url => url.pathname.endsWith("/agent-productivity") && url.searchParams.get("from") === bounds.fromISO)).toBe(true);
  expect(errors).toEqual([]);
});
