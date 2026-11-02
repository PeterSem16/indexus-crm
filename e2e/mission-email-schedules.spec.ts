import { test, expect, type Page } from "@playwright/test";
import { computeMissionFunnel } from "../server/lib/mission-funnel";
import { emptyFunnelConfig } from "../shared/mission-funnel";
const report = { ...computeMissionFunnel({ config: emptyFunnelConfig(), clinics: [], enrollments: [], events: [], states: [], calls: [], items: [] }),
  missionName: "Test Mission", canConfigure: true, dateQuestions: [] };
async function fixture(page: Page, locale = "en", canManage = true, testOutcome = "sent") {
  let schedules: any[] = [], writes: any[] = [];
  const testRequests: any[] = [];
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    const req = route.request(), url = new URL(req.url()), method = req.method();
    if (url.pathname.endsWith("/mission-funnel")) return route.fulfill({ json: report });
    if (url.pathname.includes("/mission-report-schedules")) {
      if (url.pathname.endsWith("/test-email")) {
        testRequests.push(req.postDataJSON());
        return testOutcome === "unconfirmed"
          ? route.fulfill({ status: 409, json: { error: "test_delivery_unconfirmed" } })
          : route.fulfill({ json: { status: "sent", to: "reviewer@example.test", from: "indexus-sk@example.test",
            attachmentIncluded: Boolean(schedules[0]?.deliveryOptions.includeExcel) } });
      }
      if (url.pathname.endsWith("/preview")) return route.fulfill({ json: { subject: "Test report", html: "<h1>Funnel and agent performance</h1>", from: "01.11.2026", to: "01.11.2026" } });
      if (method === "GET") return route.fulfill({ json: { canManage, users: [{ id: "recipient", name: "Recipient Agent", email: "agent@example.test" }], countries: ["SK"], schedules,
        senders: [{ country: "SK", email: "indexus-sk@example.test", connected: testOutcome !== "disconnected" }],
        testRecipientEmail: "reviewer@example.test" } });
      const body = method === "DELETE" ? null : req.postDataJSON(); writes.push({ method, body });
      if (method === "DELETE") schedules = [];
      else {
        const { frequency, weekday, monthDay, country, locale: emailLocale, includeExcel, ...fields } = body;
        schedules = [{ ...fields, id: "schedule", deliveryOptions: { frequency, weekday, monthDay, country, locale: emailLocale, includeExcel, lastStatus: "sent" },
          nextRunAt: fields.enabled ? "2026-11-03T07:00:00Z" : null, lastRunAt: null, lastStatus: "sent" }];
      }
      return route.fulfill({ json: { id: "schedule" } });
    }
    return route.fulfill({ json: {} });
  });
  await page.goto(`/test-fixtures/mission-funnel.html?locale=${locale}`);
  const section = page.getByTestId("mission-email-schedules");
  await section.locator("summary").click();
  return { section, errors, writes, testRequests, schedules: () => schedules };
}
async function createExcelSchedule(page: Page, section: ReturnType<Page["getByTestId"]>) {
  await page.getByTestId("mission-email-schedule-new").click();
  await section.getByRole("checkbox", { name: /Recipient Agent/ }).check();
  await section.getByLabel("Source country").selectOption("SK");
  await page.getByTestId("mission-email-include-excel").check();
  await page.getByTestId("mission-email-schedule-save").click();
  await expect(page.getByTestId("mission-email-test-schedule")).toBeVisible();
}
test("Excel persists across edits and test sends only after confirmation to self from country system sender", async ({ page }) => {
  const f = await fixture(page);
  await createExcelSchedule(page, f.section);
  expect(f.writes[0].body.includeExcel).toBe(true);
  await f.section.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByTestId("mission-email-include-excel")).toBeChecked();
  await expect(page.getByTestId("mission-email-system-sender")).toHaveValue("indexus-sk@example.test");
  await page.getByTestId("mission-email-schedule-save").click();
  const before = f.schedules()[0].nextRunAt;
  await page.getByTestId("mission-email-test-schedule").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("textbox").nth(0)).toHaveValue("reviewer@example.test");
  await expect(dialog.getByRole("textbox").nth(1)).toHaveValue("indexus-sk@example.test");
  expect(f.testRequests).toHaveLength(0);
  await page.getByTestId("mission-email-test-cancel").click();
  expect(f.testRequests).toHaveLength(0);
  await page.getByTestId("mission-email-test-schedule").click();
  await page.getByTestId("mission-email-test-confirm").click();
  await expect(dialog.getByRole("status")).toBeVisible();
  expect(f.testRequests).toHaveLength(1);
  expect(f.testRequests[0]).toEqual({ requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i) });
  expect(f.schedules()[0].nextRunAt).toBe(before);
  expect(f.errors).toEqual([]);
});
test("uncertain test response is visible and never automatically retried", async ({ page }) => {
  const f = await fixture(page, "en", true, "unconfirmed");
  await createExcelSchedule(page, f.section);
  await page.getByTestId("mission-email-test-schedule").click();
  await page.getByTestId("mission-email-test-confirm").click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  expect(f.testRequests).toHaveLength(1);
  await page.waitForTimeout(350);
  expect(f.testRequests).toHaveLength(1);
  expect(f.errors).toEqual([]);
});
test("disconnected system sender cannot run a test", async ({ page }) => {
  const f = await fixture(page, "en", true, "disconnected");
  await createExcelSchedule(page, f.section);
  const action = page.getByTestId("mission-email-test-schedule");
  if (await action.isEnabled()) {
    await action.click();
    await expect(page.getByTestId("mission-email-test-confirm")).toBeDisabled();
  }
  expect(f.testRequests).toHaveLength(0);
});
test("create weekly schedule, preview without sending, edit monthly, pause and delete", async ({ page }) => {
  const f = await fixture(page);
  await page.getByTestId("mission-email-schedule-new").click();
  await f.section.getByRole("checkbox", { name: /Recipient Agent/ }).check();
  await page.getByTestId("mission-email-schedule-frequency").selectOption("weekly");
  await page.getByTestId("mission-email-schedule-weekday").selectOption("5");
  await page.getByTestId("mission-email-schedule-time").fill("09:15");
  await f.section.getByLabel("Source country").selectOption("SK");
  await page.getByTestId("mission-email-schedule-enabled").check();
  await page.getByTestId("mission-email-schedule-save").click();
  await expect(f.section.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
  expect(f.writes[0].body).toMatchObject({ frequency: "weekly", weekday: 5, sendTime: "09:15", enabled: true, recipientUserIds: ["recipient"] });
  const count = f.writes.length;
  await f.section.getByRole("button", { name: "Preview email", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Email preview/ })).toBeVisible();
  expect(f.writes.length).toBe(count);
  await page.getByRole("button", { name: "Close preview", exact: true }).click();
  await expect(page.getByRole("dialog", { name: /Email preview/ })).toHaveCount(0);
  await f.section.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByTestId("mission-email-schedule-frequency").selectOption("monthly");
  await page.getByTestId("mission-email-schedule-monthday").fill("31");
  await page.getByTestId("mission-email-schedule-save").click();
  await expect(f.section.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  expect(f.writes.at(-1).body).not.toHaveProperty("lastStatus");
  await f.section.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(f.section.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
  await f.section.getByRole("button", { name: "Delete", exact: true }).click();
  await f.section.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(f.section.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
  expect(f.errors).toEqual([]);
});
test("read-only users have no schedule mutation actions", async ({ page }) => {
  const f = await fixture(page, "en", false);
  await expect(page.getByTestId("mission-email-schedule-new")).toHaveCount(0);
  expect(f.writes).toEqual([]); expect(f.errors).toEqual([]);
});
for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"])
  test(`schedule form in ${locale} has frequency/time controls and no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const f = await fixture(page, locale);
    await page.getByTestId("mission-email-schedule-new").click();
    await expect(page.getByTestId("mission-email-schedule-frequency")).toBeVisible();
    await expect(page.getByTestId("mission-email-schedule-time")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(f.errors).toEqual([]);
  });
