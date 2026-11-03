import { test, expect, type Page } from "@playwright/test";
import { missionHistoricalEmailsTranslations as copies } from "../client/src/components/campaigns/mission-historical-emails-translations";
import { translations } from "../client/src/i18n/translations";

const row = { id: "message", clinicName: "Test Clinic", subject: "Manually reviewed proposal",
  recipientEmail: "clinic@example.invalid", senderName: "Original Sender", sentAt: null,
  recordedAt: "2026-09-23T10:05:03.998123Z" };
async function mockApi(page: Page) {
  const writes: { path: string; body: any }[] = [];
  let failApply = 0, delayedPreview = false;
  await page.route("**/api/**", async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (req.method() === "GET") return route.fulfill({ json: { rows: [row], nextCursor: null } });
    const body = req.postDataJSON();
    writes.push({ path, body });
    if (path.endsWith("/preview")) {
      if (delayedPreview) await new Promise(resolve => setTimeout(resolve, 500));
      return route.fulfill({ json: {
        reviewToken: "same-signed-token", fingerprint: "a".repeat(64), expiresAt: Date.now() + 900000,
        missionId: path.includes("/other/") ? "other" : "mission", purpose: body.purpose,
        unknownSendingTimes: 1, rows: [{ ...row, contactId: "contact",
          body: '<img src=x onerror="window.evil=true">Original immutable body' }],
      } }).catch(() => {});
    }
    if (failApply) {
      const status = failApply; failApply = 0;
      return route.fulfill({ status, json: { error: "Do not show raw errors" } });
    }
    return route.fulfill({ json: { status: "applied", updates: 1 } });
  });
  return { writes, fail: (status: number) => { failApply = status; },
    delayPreview: () => { delayedPreview = true; } };
}
const fixture = "/test-fixtures/mission-historical-emails.html";
test("all seven runtime dictionaries, explicit approval, immutable preview and no send side effects", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const api = await mockApi(page);
  for (const locale of Object.keys(copies) as (keyof typeof copies)[]) {
    const c = copies[locale];
    expect(translations[locale].missionHistoricalEmails).toEqual(c);
    await page.goto(`${fixture}?locale=${locale}`);
    await expect(page.getByRole("heading", { name: c.title })).toBeVisible();
    await page.getByRole("button", { name: c.search, exact: true }).click();
    await expect(page.getByText("Test Clinic", { exact: true })).toBeVisible();
    await page.getByRole("checkbox").check();
    await page.getByPlaceholder(c.reasonHint).fill("Explicitly reviewed original record");
    await page.getByRole("button", { name: c.preview, exact: true }).click();
    const preview = page.getByRole("region", { name: c.preview });
    await expect(preview).toBeVisible();
    await expect(preview).toContainText(c.unknownSendingTimes);
    await expect(preview).toContainText(c.unknown);
    await expect(preview).toContainText("Original Sender");
    expect(await preview.locator("img").count()).toBe(0);
    const apply = preview.getByRole("button", { name: c.apply, exact: true });
    await expect(apply).toBeDisabled();
    // Changing any reviewed input drops approval and the preview.
    await page.getByRole("combobox").selectOption("informational");
    await expect(preview).not.toBeVisible();
    await page.getByRole("button", { name: c.preview, exact: true }).click();
    await preview.getByRole("checkbox").check();
    await preview.getByRole("button", { name: c.apply, exact: true }).click();
    await expect(page.getByRole("status")).toContainText(c.applied);
    await expect(page.getByText(row.subject, { exact: true })).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  expect(api.writes.every(w => w.path.endsWith("/preview") || w.path.endsWith("/apply"))).toBeTruthy();
  expect(api.writes.filter(w => w.path.endsWith("/apply")).every(w =>
    w.body.reviewToken === "same-signed-token" && w.body.approved === true)).toBeTruthy();
});
test("uncertain apply retries the same token; conflict drops approval; Mission switch drops pending preview", async ({ page }) => {
  const api = await mockApi(page), c = copies.en;
  await page.goto(fixture);
  const prepare = async () => {
    await page.getByRole("button", { name: c.search, exact: true }).click();
    await page.getByRole("checkbox").check();
    await page.getByPlaceholder(c.reasonHint).fill("Explicitly reviewed original record");
    await page.getByRole("button", { name: c.preview, exact: true }).click();
    const preview = page.getByRole("region", { name: c.preview });
    await expect(preview).toBeVisible();
    await preview.getByRole("checkbox").check();
    return preview;
  };
  let preview = await prepare();
  api.fail(500);
  await preview.getByRole("button", { name: c.apply, exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(c.applyError);
  await preview.getByRole("button", { name: c.retry, exact: true }).click();
  await expect(page.getByRole("status")).toContainText(c.applied);
  const attempts = api.writes.filter(w => w.path.endsWith("/apply"));
  expect(attempts[0].body).toEqual(attempts[1].body);
  preview = await prepare();
  api.fail(409);
  await preview.getByRole("button", { name: c.apply, exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(c.stalePreview);
  await expect(preview).not.toBeVisible();
  api.delayPreview();
  await page.getByRole("button", { name: c.preview, exact: true }).click();
  await page.getByTestId("switch-mission").click();
  await expect(page.getByText("Test Clinic", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: c.preview })).not.toBeVisible();
  await page.waitForTimeout(600);
  await expect(page.getByRole("region", { name: c.preview })).not.toBeVisible();
});
test("mobile dark preview remains readable and safe", async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const c = copies.sk;
  await page.goto(`${fixture}?locale=sk&dark=1`);
  await page.getByRole("button", { name: c.search, exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByPlaceholder(c.reasonHint).fill("Overený historický záznam odoslania");
  await page.getByRole("button", { name: c.preview, exact: true }).click();
  await expect(page.getByRole("region", { name: c.preview })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
