import { test, expect } from "@playwright/test";

test("shared calendar preserves date-only semantics in negative timezone and bounds", async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: "America/Los_Angeles" });
  const page = await context.newPage();
  await page.goto("/test-fixtures/date-time-picker.html");
  await expect(page.getByTestId("calendar-date")).toHaveText("04.10.2026");
  await page.getByTestId("calendar-date").click();
  await expect(page.getByRole("grid")).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "28", exact: true }).first()).toBeDisabled();
  await page.getByRole("gridcell", { name: "5", exact: true }).click();
  await expect(page.getByTestId("date-value")).toHaveText("2026-10-05");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Disabled date" })).toBeDisabled();
  await context.close();
});
test("shared datetime keeps date and time, with localized labels", async ({ page }) => {
  await page.goto("/test-fixtures/date-time-picker.html");
  await page.getByTestId("deadline").click();
  await page.getByTestId("deadline-hours").fill("15");
  await page.getByTestId("deadline-minutes").fill("35");
  await expect(page.getByTestId("deadline-value")).toHaveText("2026-10-04T15:35");
  await expect(page.getByTestId("deadline-now")).toHaveText("Teraz");
});
test("shared named date keeps native form required validation and submitted value", async ({ page }) => {
  await page.goto("/test-fixtures/date-time-picker.html");
  await page.getByRole("button", { name: "Submit date" }).click();
  await expect(page.getByTestId("submitted")).toBeEmpty();
  await page.getByRole("gridcell", { name: "5", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Submit date" }).click();
  await expect(page.getByTestId("submitted")).toContainText("-05");
});