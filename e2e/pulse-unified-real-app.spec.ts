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
      createdAt: at(24), handledAt: at(2) },
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
  const clinic = {
    id: "iris", name: "Centrum Iris", clinicName: "Centrum Iris",
    doctorName: "MUDr. Jana Iris", email: "iris@example.test", phone: "+421900000201",
    countryCode: "SK", country: "SK",
  };
  const communicationHistory = [
    { id: "history-email-iris", type: "email", direction: "inbound", timestamp: at(24),
      content: "Consultation follow-up", details: "<p>Please confirm the consultation time.</p>",
      sender: "iris@example.test", agentName: "Preview Agent", campaignId: "mission" },
    { id: "history-sms-in-iris", type: "sms", direction: "inbound", timestamp: at(6),
      content: "We can see the patient on Thursday.", agentName: "Jana Iris", sentiment: "positive" },
    { id: "history-sms-out-iris", type: "sms", direction: "outbound", timestamp: at(4),
      content: "Thursday at 14:30 is confirmed.", agentName: "Preview Agent", status: "delivered" },
  ];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/api/**", async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    let body: unknown = [];
    if (!["GET", "HEAD"].includes(req.method())) {
      if (path === "/api/auth/heartbeat" || path === "/api/wallboard/presence") body = { success: true };
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
    campaignIds: ["mission"], inboundQueueIds: [],
    };
    else if (path === "/api/agent/abandoned-calls") body = calls;
    else if (path === "/api/agent/missed-messages") body = messages;
    else if (path === "/api/clinics/iris") body = clinic;
    else if (path === "/api/clinics/iris/contact-history") body = communicationHistory;
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

  test("email detail and reply controls stay within desktop and phone viewports", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const fixture = await installFixture(page);
    await page.evaluate(() => document.documentElement.setAttribute("data-agent-fullscreen", "true"));
    await page.getByTestId("btn-open-abandoned-calls").click();
    const missedEmail = page.getByTestId("missed-message-mail-iris");
    await expect(missedEmail).toBeVisible();
    await missedEmail.click();

    const detail = page.getByTestId("history-detail-dialog");
    await expect(detail).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(detail.getByTestId("text-history-detail-title")).toContainText("Potvrdenie termínu");
    await expect(detail.getByTestId("iframe-email-content")).toHaveAttribute("sandbox", "allow-same-origin");
    await expect(detail).toHaveCSS("background-color", "rgb(251, 253, 255)");
    await assertDialogBounds(page, detail);
    expect(await detail.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 35);
      return !!hit && el.contains(hit);
    })).toBe(true);
    await page.screenshot({ path: "/tmp/pulse-email-detail-1024.png", animations: "disabled" });

    await page.setViewportSize({ width: 390, height: 844 });
    await assertDialogBounds(page, detail);
    await expect(detail.getByTestId("btn-email-reply")).toBeInViewport();
    await page.screenshot({ path: "/tmp/pulse-email-detail-phone.png", animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(detail).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("missed-unified-dialog")).toHaveCount(0);

    // At desktop width the real Reply action resolves the linked clinic and
    // returns the agent to its populated email conversation without sending.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByTestId("btn-open-abandoned-calls").click();
    await page.getByTestId("missed-message-mail-iris").click();
    const linkedDetail = page.getByTestId("history-detail-dialog");
    await expect(linkedDetail).toBeVisible();
    await linkedDetail.getByTestId("btn-email-reply").click();
    await expect(linkedDetail).toHaveCount(0);
    await expect(page.getByTestId("missed-unified-dialog")).toHaveCount(0);
    await expect.poll(() => page.locator(".pulse-email-history .pulse-history-bubble").count()).toBe(1);
    await page.locator(".pulse-email-history .pulse-history-bubble").click();
    const emailHistoryDetail = page.getByTestId("history-detail-dialog");
    await expect(emailHistoryDetail.getByTestId("text-history-detail-title")).toContainText("Consultation follow-up");
    await expect(emailHistoryDetail.getByTestId("iframe-email-content")).toHaveAttribute("sandbox", "allow-same-origin");
    await assertDialogBounds(page, emailHistoryDetail);
    await emailHistoryDetail.getByTestId("btn-email-reply").click();
    await expect(emailHistoryDetail.getByTestId("input-email-reply-text")).toBeVisible();
    await expect(emailHistoryDetail.getByTestId("btn-send-reply")).toBeDisabled();
    await page.setViewportSize({ width: 390, height: 844 });
    await assertDialogBounds(page, emailHistoryDetail);
    await expect(emailHistoryDetail.getByTestId("btn-cancel-reply")).toBeInViewport();
    await page.screenshot({ path: "/tmp/pulse-email-history-reply-phone.png", animations: "disabled" });
    await emailHistoryDetail.getByTestId("btn-cancel-reply").click();
    await expect(emailHistoryDetail.getByTestId("input-email-reply-text")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(emailHistoryDetail).toHaveCount(0);

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.getByTestId("tab-sms").click();
    await expect(page.locator(".pulse-sms-card .pulse-history-bubble")).toHaveCount(2);
    await expect(page.getByTestId("input-sms-message")).toBeVisible();
    await expect(page.getByTestId("btn-send-sms")).toBeVisible();
    await page.screenshot({ path: "/tmp/pulse-sms-conversation-1024.png", animations: "disabled" });
    await expect(page.locator(".pulse-sms-card .pulse-history-bubble-inbound")).toContainText("We can see the patient on Thursday");
    // The desktop communication card is replaced by a different mobile
    // workspace below 768px. Verify the real compact desktop card here; the
    // portalled email-detail and preview dialogs are tested at 390px separately.
    await page.setViewportSize({ width: 820, height: 768 });
    await expect(page.getByTestId("input-sms-message")).toBeInViewport();
    await expect(page.getByTestId("btn-send-sms")).toBeInViewport();
    await page.screenshot({ path: "/tmp/pulse-sms-conversation-compact.png", animations: "disabled" });

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.getByTestId("tab-email").click();
    await expect(page.getByTestId("btn-email-preview-expand")).toBeVisible();
    const htmlModeToggle = page.getByTestId("btn-toggle-html");
    if (!(await htmlModeToggle.evaluate(el => el.classList.contains("pulse-html-mode-active")))) {
      await htmlModeToggle.click();
    }
    await page.getByTestId("btn-email-preview-expand").click();
    const expanded = page.getByTestId("email-expanded-preview-dialog");
    await expect(expanded).toBeVisible();
    await expect(expanded).toHaveCSS("background-color", "rgb(251, 253, 255)");
    await expect(expanded.getByTestId("btn-email-expanded-preview")).toHaveCSS("background-color", "rgb(52, 124, 175)");
    await assertDialogBounds(page, expanded);
    await page.screenshot({ path: "/tmp/pulse-expanded-email-preview-1024.png", animations: "disabled" });
    // Expanded compose belongs to the desktop card, unlike the global email
    // detail dialog which remains available in the separate mobile workspace.
    await page.setViewportSize({ width: 820, height: 768 });
    await assertDialogBounds(page, expanded);
    await expect(expanded.getByTestId("btn-email-expanded-preview")).toBeInViewport();
    await expect(expanded.getByTestId("btn-email-expanded-edit-html")).toBeInViewport();
    await page.screenshot({ path: "/tmp/pulse-expanded-email-preview-compact.png", animations: "disabled" });
    await expanded.getByTestId("btn-email-expanded-edit-html").click();
    await expect(expanded.getByTestId("textarea-email-html-expanded-edit")).toBeVisible();
    await expanded.getByTestId("btn-email-expanded-preview").click();
    await expect(expanded.locator("iframe").first()).toBeVisible();
    expect(fixture.writes).toEqual([]);
    expect(fixture.errors).toEqual([]);
  });

  test("opening long communication history does not scroll its header under the tabs", async ({ page }) => {
    const fixture = await installFixture(page);
    await page.route("**/api/clinics/iris/contact-history", route => route.fulfill({
      status: 200,
      json: [
        ...Array.from({ length: 20 }, (_, index) => ({
          id: `frame-email-${index}`, type: "email", direction: index % 2 ? "inbound" : "outbound",
          timestamp: at(120 - index * 5), content: `History message ${index}`,
          details: "<p>Test conversation.</p>", sender: "iris@example.test",
          agentName: "Preview Agent", campaignId: "mission",
        })),
        ...Array.from({ length: 20 }, (_, index) => ({
          id: `frame-sms-${index}`, type: "sms", direction: index % 2 ? "inbound" : "outbound",
          timestamp: at(120 - index * 5), content: `SMS message ${index}`, agentName: "Preview Agent",
        })),
      ],
    }));
    await page.getByTestId("btn-open-abandoned-calls").click();
    await page.getByTestId("missed-message-mail-iris").click();
    await page.getByTestId("history-detail-dialog").getByTestId("btn-email-reply").click();
    await page.setViewportSize({ width: 1024, height: 650 });

    for (const channel of ["email", "sms"]) {
      await page.getByTestId(`tab-${channel}`).click();
      const card = page.locator(channel === "email" ? ".pulse-email-history" : ".pulse-sms-card");
      const list = card.locator(channel === "email" ? ".pulse-history-scroll" : ".pulse-sms-thread > .overflow-y-auto");
      await expect(card.locator(".pulse-history-bubble")).toHaveCount(20);
      await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
      await page.waitForTimeout(400); // Native smooth scrolling must finish.
      const tab = await page.getByTestId(`tab-${channel}`).boundingBox();
      const header = await card.locator(":scope > div").first().boundingBox();
      expect(header!.y).toBeGreaterThanOrEqual(tab!.y + tab!.height);
      expect(await card.evaluate(el => {
        for (let parent = el.parentElement; parent; parent = parent.parentElement) {
          if (getComputedStyle(parent).overflowY === "hidden" && parent.scrollTop > 0) return false;
        }
        return true;
      })).toBe(true);
    }
    await page.getByTestId("tab-email").click();
    await page.screenshot({ path: "/tmp/pulse-email-header-within-frame.png", animations: "disabled" });
    expect(fixture.errors).toEqual([]);
    expect(fixture.writes).toEqual([]);
  });
});