import { test, expect } from "@playwright/test";
test("real history defaults to this Mission, keeps legacy rows separate, shows callback time and opens details", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", route => route.fulfill({ json: new URL(route.request().url()).pathname === "/api/auth/me"
    ? { user: { id: "agent", role: "admin", assignedCountries: ["SK"] } } : [] }));
  await page.goto("/test-fixtures/mission-history.html", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("history-item-callback")).toBeVisible();
  await expect(page.getByTestId("history-item-foreign")).toHaveCount(0);
  await expect(page.getByTestId("history-item-unassigned")).toHaveCount(0);
  await expect(page.getByTestId("history-item-callback")).not.toContainText("callback_change");
  await expect(page.getByTestId("history-item-callback")).toContainText("Callback updated");
  await expect(page.getByTestId("history-callback-date-callback")).toContainText("09:37");
  await expect(page.getByTestId("history-item-step")).toContainText("Contract proposal offered");
  await page.getByTestId("btn-history-scope-all").click();
  await expect(page.getByTestId("history-item-foreign")).toBeVisible();
  await expect(page.getByTestId("history-item-unassigned")).toBeVisible();
  await page.getByTestId("history-item-proposal").click();
  await expect.poll(() => page.evaluate(() => (window as any).openedHistoryEntry)).toBe("proposal");
  await page.getByTestId("fixture-switch-mission").click();
  await expect(page.getByTestId("history-item-callback")).toHaveCount(0);
  await expect(page.getByTestId("history-item-foreign")).toBeVisible();
  await page.getByTestId("fixture-switch-mission").click();
  await page.getByTestId("btn-history-scope-all").click();
  await page.screenshot({ path: "/tmp/mission-history-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("history-callback-date-callback")).toContainText("09:37");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/mission-history-mobile.png" });
  expect(errors).toEqual([]);
});
for (const locale of ["sk", "de"]) test(`history remains readable in ${locale} dark mode`, async ({ page }) => {
  test.setTimeout(120_000);
  await page.route("**/api/**", route => route.fulfill({ json: new URL(route.request().url()).pathname === "/api/auth/me"
    ? { user: { id: "agent", role: "admin", assignedCountries: ["SK"] } } : [] }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/test-fixtures/mission-history.html?locale=${locale}&dark=1`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("history-item-callback")).toBeVisible();
  await expect(page.getByTestId("history-callback-date-callback")).toContainText("09:37");
  await expect(page.getByTestId("history-item-callback")).not.toContainText("callback_change");
  await page.getByTestId("btn-history-scope-all").click();
  await expect(page.getByTestId("history-item-foreign")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
