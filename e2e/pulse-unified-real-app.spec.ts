import { test, expect, type Page, type Locator } from "@playwright/test";

// Render the real App/router/providers and real workspace dialogs, not a copy
// of the mockup. All API traffic is intercepted; no CRM records are changed.
const user = {
  id: "unified-preview-agent", username: "preview", fullName: "Preview Agent",
  role: "admin", roleId: null, assignedCountries: ["SK"],
  roleLandingPage: "/customers", nexusEnabled: false,
  showNotificationBell: false, showEmailQueue: false, showSipPhone: false,
};
const at = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

async function installFixture(page: Page, empty = false) {
  const errors: string[] = [];
  const writes: string[] = [];
  const calls = empty ? [] : [
    { id: "call-iris", callerNumber: "+421900000101", customerName: "Ambulancia Iris",
      status: "timeout", queueName: "Medical partners", enteredQueueAt: at(12),
      completedAt: at(10), waitDurationSeconds: 120, calledBack: false },
    { id: "call-done", callerNumber: "+421900000102", customerName: "Zora Test",
      status: "abandoned", queueName: "Bratislava", enteredQueueAt: at(90),
      completedAt: at(89), waitDurationSeconds: 42, calledBack: true,
      calledBackByName: "Preview Agent" },
  ];
  const messages = empty ? [] : [
    { id: "mail-iris", type: "email", contactName: "Centrum Iris",
      sender: "iris@example.test", senderEmail: "iris@example.test",
      entityId: "iris", contactType: "clinic", campaignId: "mission", campaignName: "Partner enquiries",
      subject: "Potvrdenie termínu", content: "<p>Prosím potvrďte návštevu.</p>",
      createdAt: at(24), handledAt: null },
    { id: "sms-jana", type: "sms", contactName: "Jana Test",
      sender: "+421900000103", senderPhone: "+421900000103",
      entityId: "jana", contactType: "customer", campaignId: "mission", campaignName: "Partner enquiries",
      content: "Prosím zavolajte po 14:00.", createdAt: at(5), handledAt: null },
  ];
  const activities = empty ? [] : [
    { id: "outbound", itemType: "call", customerName: "Martin Test", phoneNumber: "+421900000104",
      direction: "outbound", status: "completed", durationSeconds: 516,
      startedAt: at(40), answeredAt: at(39.7), endedAt: at(31), sortTime: at(40),
      inboundQueueName: "Bratislava", entityId: "martin", contactType: "customer",
      workflowMode: "status_list", outcomeBadges: [{ kind: "callback", code: "callback" }] },
    { id: "email-activity", itemType: "email", entityName: "Centrum Iris", subject: "Potvrdenie termínu",
      recipientEmail: "iris@example.test", sortTime: at(50), createdAt: at(50) },
    { id: "sms-activity", itemType: "sms", entityName: "Jana Test",
      recipientPhone: "+421900000103", content: "Prosím zavolajte po 14:00.", sortTime: at(60) },
    { id: "break-activity", itemType: "break", breakTypeName: "Obed", startedAt: at(80),
      endedAt: at(65), sortTime: at(80), durationSeconds: 900 },
    { id: "session-activity", itemType: "session", startedAt: at(120), sortTime: at(120),
      endedAt: null, campaignName: "Morning shift" },
  ];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/api/**", async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    let body: unknown = [];
    if (!["GET", "HEAD"].includes(req.method())) {
      if (path === "/api/auth/heartbeat") body = { success: true };
      else if (path === "/api/agent/missed-messages/sms-jana/handled") {
        writes.push(path);
        messages.find(item => item.id === "sms-jana")!.handledAt = at(0) as any;
        body = { success: true };
      } else if (path === "/api/agent/abandoned-calls/call-iris/called-back") {
        writes.push(path);
        calls[0].calledBack = true;
        body = { success: true };
      } else {
        writes.push(`UNEXPECTED ${req.method()} ${path}`);
        await route.fulfill({ status: 405, json: { error: "Blocked test mutation" } });
        return;
      }
    } else if (path === "/api/auth/me") body = { user };
    else if (path === "/api/agent-sessions/active") body = {
      id: "preview-session", userId: user.id, status: "available", startedAt: at(120),
      endedAt: null, totalCallTime: 1, totalEmailTime: 1, totalSmsTime: 1,
      contactsHandled: 0, totalBreakTime: 900, totalWorkTime: 7200,
      campaignIds: [], inboundQueueIds: [],
    };
    else if (path === "/api/agent/abandoned-calls") body = calls;
    else if (path === "/api/agent/missed-messages") body = messages;
    else if (path === "/api/agent/today-activity") body = activities;
    else if (path.includes("/unread-count") || path.includes("/count")) body = { count: 0 };
    else if (path.includes("/settings") || path.includes("/preferences") || path.includes("/configuration")) body = {};
    await route.fulfill({ status: 200, json: body });
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { enumerateDevices: async () => [], addEventListener() {}, removeEventListener() {} },
    });
  });
  await page.goto("/agent-workspace?pulse-ui-preview=1");
  await expect(page.getByTestId("pulse-dev-preview-banner")).toBeVisible({ timeout: 60_000 });
  return { errors, writes };
}

async function assertDialogBounds(page: Page, dialog: Locator) {
  const viewport = page.viewportSize()!;
  // Wait for responsive layout/entry animation after resizing an open dialog.
  await expect.poll(async () => {
    const rect = await dialog.boundingBox();
    const banner = await page.getByTestId("pulse-dev-preview-banner").boundingBox();
    return !!rect && rect.x >= 0 && rect.y >= (banner ? banner.y + banner.height : 0)
      && rect.x + rect.width <= viewport.width + 1
      && rect.y + rect.height <= viewport.height + 1;
  }).toBe(true);
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(box!.width).toBeLessThanOrEqual(1042);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await expect(dialog.getByRole("heading").first()).toBeVisible();
}

test.describe("Approved Unified dialogs in the real workspace", () => {
  test.setTimeout(120_000);
  test.use({ viewport: { width: 1280, height: 900 } });

  test("Missed is a unified list with blue design, filters and real handled actions", async ({ page }) => {
    const fixture = await installFixture(page);
    await page.getByTestId("btn-open-abandoned-calls").click();
    const dialog = page.getByTestId("missed-unified-dialog");
    await expect(dialog).toBeVisible();
    await assertDialogBounds(page, dialog);
    await expect(page.getByTestId("missed-channel-all")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("missed-channel-all")).toHaveCSS("background-color", "rgb(45, 111, 186)");
    await expect(page.getByTestId("abandoned-call-call-iris")).toBeVisible();
    await expect(page.getByTestId("missed-message-mail-iris")).toBeVisible();
    await expect(page.getByTestId("missed-message-sms-jana")).toBeVisible();
    await expect(dialog.locator("input")).not.toBeFocused();
    await page.screenshot({ path: "/tmp/pulse-unified-missed-desktop.png" });

    await page.getByTestId("input-missed-search").fill("nothing-matches");
    await expect(dialog.locator('[data-testid^="abandoned-call-"], [data-testid^="missed-message-"]')).toHaveCount(0);
    await page.screenshot({ path: "/tmp/pulse-unified-missed-filtered-empty.png" });
    await page.getByTestId("input-missed-search").fill("");
    await page.getByTestId("input-missed-search").press("Tab");
    await page.getByTestId("missed-channel-sms").click();
    await expect(page.getByTestId("missed-message-sms-jana")).toBeVisible();
    await expect(page.getByTestId("abandoned-call-call-iris")).toHaveCount(0);
    await page.getByTestId("missed-message-sms-jana").getByRole("button", { name: /handled|vybaven|spracovan/i }).click();
    await page.getByTestId("missed-status-handled").click();
    await expect(page.getByTestId("missed-message-sms-jana")).toBeVisible();
    expect(fixture.writes).toEqual(["/api/agent/missed-messages/sms-jana/handled"]);
    expect(fixture.errors).toEqual([]);
  });

  test("My Shift retains cards, metrics, type filters and scoped search", async ({ page }) => {
    const fixture = await installFixture(page);
    await page.getByTestId("btn-open-my-activity").click();
    const dialog = page.getByTestId("my-shift-unified-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Martin Test", { exact: true }).first()).toBeVisible();
    await expect(dialog.locator(".msu-outcome-badge").first()).toContainText(/naplánovan|scheduled/i);
    await assertDialogBounds(page, dialog);
    await expect(page.getByTestId("my-shift-type-all")).toHaveCSS("background-color", "rgb(45, 111, 186)");
    await page.screenshot({ path: "/tmp/pulse-unified-shift-desktop.png" });
    await page.getByTestId("my-shift-type-email").click();
    await expect(dialog.getByText("Potvrdenie termínu", { exact: false }).first()).toBeVisible();
    await expect(dialog.getByText("Martin Test", { exact: true })).toHaveCount(0);
    await page.getByTestId("select-my-activity-search-field").selectOption("subject");
    await page.getByTestId("input-my-activity-search").fill("Potvrdenie");
    await expect(dialog.getByText("Centrum Iris", { exact: true }).first()).toBeVisible();
    await page.getByTestId("input-my-activity-search").fill("nothing-matches");
    await expect(dialog.getByText("Centrum Iris", { exact: true })).toHaveCount(0);
    expect(fixture.errors).toEqual([]);
    expect(fixture.writes).toEqual([]);
  });

  test("true empty states retain the approved blue shell", async ({ page }) => {
    const fixture = await installFixture(page, true);
    await page.getByTestId("btn-open-abandoned-calls").click();
    await expect(page.getByTestId("missed-unified-dialog")).toBeVisible();
    await expect(page.getByTestId("missed-channel-all")).toHaveCSS("background-color", "rgb(45, 111, 186)");
    await page.screenshot({ path: "/tmp/pulse-unified-missed-empty.png" });
    await page.keyboard.press("Escape");
    await page.getByTestId("btn-open-my-activity").click();
    await expect(page.getByTestId("my-shift-unified-dialog")).toBeVisible();
    await page.screenshot({ path: "/tmp/pulse-unified-shift-empty.png" });
    expect(fixture.errors).toEqual([]);
  });

  test("both dialogs fit mobile fullscreen and keep titles and actions visible", async ({ page }) => {
    const fixture = await installFixture(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.setAttribute("data-agent-fullscreen", "true"));
    // The production header uses responsive visibility; open on desktop then
    // resize so this test targets the dialog rather than mobile navigation.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByTestId("btn-open-abandoned-calls").click();
    await page.setViewportSize({ width: 390, height: 844 });
    const missed = page.getByTestId("missed-unified-dialog");
    await assertDialogBounds(page, missed);
    await page.screenshot({ path: "/tmp/pulse-unified-missed-mobile.png" });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByTestId("btn-open-my-activity").click();
    await page.setViewportSize({ width: 390, height: 844 });
    await assertDialogBounds(page, page.getByTestId("my-shift-unified-dialog"));
    await page.screenshot({ path: "/tmp/pulse-unified-shift-mobile.png" });
    expect(fixture.errors).toEqual([]);
  });
});