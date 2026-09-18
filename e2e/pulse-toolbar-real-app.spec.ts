import { test, expect, type Page } from "@playwright/test";

test.setTimeout(90_000);

// Real application components and providers; API interception prevents any real
// session, telephony, contact, or communication mutation during these checks.
async function openWorkspace(page: Page, locale = "en", options: {
  initialBreakMinutes?: number;
  expectedMinutes?: number | null;
  breakName?: string;
  failEndOnce?: boolean;
  systemBreak?: boolean;
} = {}) {
  const errors: string[] = [];
  const writes: string[] = [];
  const at = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  const user = {
    id: "toolbar-preview-agent", username: "toolbar-preview", fullName: "Preview Agent",
    role: "admin", isActive: true, assignedCountries: locale === "de" ? ["DE"] : locale === "sk" ? ["SK"] : ["SK", "CZ"], country: locale === "de" ? "DE" : "SK", language: locale,
    preferredLanguage: locale, mobileEnabled: true, email: "preview@example.invalid",
  };
  const session = {
    id: "toolbar-session", userId: user.id, status: "available", startedAt: at(8),
    endedAt: null as string | null, totalCallTime: 0, totalEmailTime: 0, totalSmsTime: 0,
    contactsHandled: 0, totalBreakTime: 0, totalWorkTime: 480, campaignIds: [], inboundQueueIds: [],
  };
  let breaks: object[] = [];
  const breakType = {
    id: "coffee", name: options.breakName || "Coffee break",
    expectedDurationMinutes: options.expectedMinutes === undefined ? 5 : options.expectedMinutes,
    maxDurationMinutes: 15, isActive: true, color: "#f5c242",
  };
  if (options.initialBreakMinutes !== undefined) {
    session.status = "break";
    breaks = [{ id: "preview-break", breakTypeId: options.systemBreak ? null : "coffee",
      breakTypeName: options.systemBreak ? "Back Office agenda" : breakType.name,
      startedAt: at(options.initialBreakMinutes), endedAt: null }];
  }
  let failEnd = !!options.failEndOnce;
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    let body: unknown = [];
    if (!["GET", "HEAD"].includes(req.method())) {
      if (path === "/api/auth/heartbeat") body = { success: true };
      else if (path === "/api/agent-sessions/toolbar-session/status") {
        writes.push(path);
        session.status = req.postDataJSON().status;
        body = session;
      } else if (path === "/api/agent-sessions/toolbar-session/breaks") {
        writes.push(path);
        session.status = "break";
        breaks = [{ id: "preview-break", breakTypeId: "coffee", startedAt: at(7), endedAt: null }];
        body = breaks[0];
      } else if (path === "/api/agent-breaks/preview-break/end") {
        writes.push(path);
        if (options.failEndOnce) await new Promise(resolve => setTimeout(resolve, 400));
        if (failEnd) {
          failEnd = false;
          await route.fulfill({ status: 500, json: { error: "Simulated failure" } });
          return;
        }
        session.status = "available";
        breaks = [];
        body = { success: true };
      } else if (path === "/api/agent-sessions/toolbar-session/end") {
        writes.push(path);
        session.endedAt = at(0);
        session.status = "offline";
        body = { success: true };
      } else {
        writes.push(`UNEXPECTED ${req.method()} ${path}`);
        await route.fulfill({ status: 405, json: { error: "Blocked test mutation" } });
        return;
      }
    } else if (path === "/api/auth/me") body = { user };
    else if (path === "/api/agent-sessions/active") body = session.endedAt ? null : session;
    else if (path === "/api/agent-break-types") body = [breakType];
    else if (path === "/api/agent-sessions/toolbar-session/breaks") body = breaks;
    else if (path.endsWith("/call-forwarding")) body = { enabled: true, number: "+421900000000" };
    else if (path === "/api/agent/missed-messages") body = [{
      id: "pending-sms", type: "sms", direction: "inbound", senderPhone: "+421900000001",
      subject: "", content: "Test message", createdAt: at(5), handledAt: null,
      contactName: "Preview contact", entityType: null, entityId: null,
    }];
    else if (path.includes("/unread-count") || path.includes("/count")) body = { count: 0 };
    else if (path.includes("/settings") || path.includes("/preferences") || path.includes("/configuration")) body = {};
    await route.fulfill({ status: 200, json: body });
  });
  await page.addInitScript(() => {
    localStorage.removeItem("indexus.pulse.inboundRingtone");
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { enumerateDevices: async () => [], addEventListener() {}, removeEventListener() {} },
    });
  });
  await page.goto("/agent-workspace?pulse-ui-preview=1");
  await expect(page.getByTestId("agent-toolbar-unified")).toBeVisible({ timeout: 60_000 });
  return { errors, writes };
}

async function assertToolbarBounds(page: Page) {
  const toolbar = page.getByTestId("agent-toolbar-unified");
  expect(await toolbar.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  const box = (await toolbar.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  for (const id of ["dropdown-agent-status", "button-end-session", "button-toggle-inbound-ringtone", "btn-open-scheduled-queue", "btn-open-abandoned-calls", "btn-open-my-activity"]) {
    const control = toolbar.getByTestId(id);
    await expect(control).toBeVisible();
    const rect = (await control.boundingBox())!;
    expect(rect.x).toBeGreaterThanOrEqual(box.x);
    expect(rect.x + rect.width).toBeLessThanOrEqual(box.x + box.width + 1);
  }
}

test("unified toolbar keeps status, break, forwarding, ringtone and end-shift behavior", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const fixture = await openWorkspace(page);
  const status = page.getByTestId("dropdown-agent-status");
  await expect(status).toContainText("Available");
  await expect(page.getByTestId("stat-calls")).toHaveText("0");
  await expect(page.getByTestId("badge-missed-calls")).not.toHaveClass(/pta-pending/);
  await expect(page.getByTestId("badge-missed-emails")).not.toHaveClass(/pta-pending/);
  await expect(page.getByTestId("badge-missed-sms")).toHaveText("1");
  await expect(page.getByTestId("badge-missed-sms")).toHaveClass(/pta-pending/);
  const ringtone = page.getByTestId("button-toggle-inbound-ringtone");
  await expect(ringtone).toContainText("+421900000000");
  await expect(ringtone).toHaveAttribute("aria-pressed", "false");
  await ringtone.click();
  await expect(ringtone).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("indexus.pulse.inboundRingtone"))).toBe("1");
  await ringtone.click();
  await expect(ringtone).toHaveAttribute("aria-pressed", "false");
  await assertToolbarBounds(page);
  // Desktop toolbar must be ONE row, with counters directly after the timer.
  const rowControls = await Promise.all(
    ["dropdown-agent-status", "button-end-session", "button-toggle-inbound-ringtone", "btn-open-scheduled-queue", "btn-open-abandoned-calls", "btn-open-my-activity"]
      .map(id => page.getByTestId(id).boundingBox()),
  );
  const centers = rowControls.map(rect => rect!.y + rect!.height / 2);
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(2);
  const timer = await page.locator(".agent-toolbar-unified .pta-timer").boundingBox();
  const counters = await page.locator(".agent-toolbar-unified .pta-micro-counts").boundingBox();
  expect(counters!.x - (timer!.x + timer!.width)).toBeLessThanOrEqual(10);
  await page.screenshot({ path: "screenshots/pulse-toolbar-desktop.png", fullPage: false });
  await status.click();
  await page.getByTestId("menu-item-status-busy").click();
  await expect(status).toContainText("Busy");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await status.click();
  await page.getByTestId("menu-item-status-wrap_up").click();
  await expect(status).toContainText("Wrap");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await status.click();
  await page.getByTestId("menu-item-break-coffee").click();
  const breakDialog = page.getByTestId("agent-break-dialog");
  await expect(breakDialog).toBeVisible();
  await expect(breakDialog.getByRole("heading")).toHaveText("Coffee break");
  await expect(page.getByTestId("badge-break-active")).toHaveCount(0);
  await expect(page.getByTestId("badge-break-exceeded")).toBeVisible();
  await expect(page.getByTestId("text-break-time")).toContainText("00:07:");
  await page.getByTestId("button-hide-break-dialog").click();
  await expect(breakDialog).toHaveCount(0);
  await expect(status).toContainText("Break");
  expect(fixture.writes.filter(path => path.endsWith("/preview-break/end"))).toHaveLength(0);
  await assertToolbarBounds(page);
  await status.click();
  await expect(breakDialog).toBeVisible();
  await page.setViewportSize({ width: 800, height: 1000 });
  await assertToolbarBounds(page);
  await page.screenshot({ path: "screenshots/pulse-toolbar-tablet-break.png", fullPage: false });
  await page.getByTestId("button-end-break").click();
  await expect(breakDialog).toHaveCount(0);
  await expect(status).toContainText("Available");
  await page.getByTestId("button-end-session").click();
  await expect.poll(() => fixture.writes.includes("/api/agent-sessions/toolbar-session/end")).toBe(true);
  await expect(page.getByTestId("button-end-session")).toHaveCount(0);
  expect(fixture.errors).toEqual([]);
  expect(fixture.writes.filter(path => path.startsWith("UNEXPECTED"))).toEqual([]);
});

test("toolbar opens existing queue and Unified dialogs, including a wider translation", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1000 });
  const fixture = await openWorkspace(page, "de");
  await assertToolbarBounds(page);
  await page.getByTestId("btn-open-scheduled-queue").click();
  await expect(page.getByTestId("text-scheduled-queue-title")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("btn-open-abandoned-calls").click();
  await expect(page.getByTestId("missed-unified-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("btn-open-my-activity").click();
  await expect(page.getByTestId("my-shift-unified-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  expect(fixture.errors).toEqual([]);
  expect(fixture.writes).toEqual([]);
});

test("saved break opens after reload, hides without stopping, and fits mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const fixture = await openWorkspace(page, "sk", { initialBreakMinutes: 12, expectedMinutes: 30, breakName: "Obed" });
  const dialog = page.getByTestId("agent-break-dialog");
  await expect(dialog.getByRole("heading")).toHaveText("Obed");
  await expect(dialog).toContainText("30 minút");
  await expect(page.getByTestId("text-break-time")).toContainText("00:12:");
  await expect(page.getByTestId("badge-break-exceeded")).toHaveCount(0);
  await expect(dialog).toHaveCSS("width", "440px");
  await expect(dialog).toHaveCSS("border-radius", "22px");
  await expect(dialog).toHaveCSS("background-color", "rgb(251, 253, 255)");
  await expect(page.locator(".agent-break-dialog-overlay")).toHaveCSS("background-color", "rgba(37, 62, 89, 0.22)");
  await page.screenshot({ path: "screenshots/pulse-break-modal-desktop.png", animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(fixture.writes).toEqual([]);
  await page.getByTestId("dropdown-agent-status").click();
  await expect(dialog).toBeVisible();
  await page.reload();
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId("text-break-time")).toContainText("00:12:");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toBeVisible();
  await dialog.evaluate(async element => {
    await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));
  });
  const bounds = (await dialog.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  await expect(dialog.getByTestId("button-end-break")).toBeInViewport();
  expect(bounds.width).toBeLessThanOrEqual(358);
  await page.screenshot({ path: "screenshots/pulse-break-modal-mobile.png", animations: "disabled" });
  await dialog.getByTestId("button-end-break").click();
  await expect(dialog).toHaveCount(0);
  expect(fixture.writes.filter(path => path.endsWith("/preview-break/end"))).toHaveLength(1);
  expect(fixture.errors).toEqual([]);
});

test("end-break failure stays visible, blocks duplicate requests and supports retry with no duration", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const fixture = await openWorkspace(page, "en", { initialBreakMinutes: 3, expectedMinutes: null, failEndOnce: true });
  const dialog = page.getByTestId("agent-break-dialog");
  await expect(dialog).toContainText("Recommended duration is not set.");
  await expect(dialog.locator("progress")).toHaveCount(0);
  const end = dialog.getByTestId("button-end-break");
  await end.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(end).toBeDisabled();
  await expect(dialog.getByTestId("break-end-error")).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(end).toBeEnabled();
  expect(fixture.writes.filter(path => path.endsWith("/preview-break/end"))).toHaveLength(1);
  await end.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("dropdown-agent-status")).toContainText("Available");
  expect(fixture.writes.filter(path => path.endsWith("/preview-break/end"))).toHaveLength(2);
  expect(fixture.errors).toEqual([]);
});

test("automatic Back Office pauses do not interrupt work with a modal", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const fixture = await openWorkspace(page, "en", { initialBreakMinutes: 3, systemBreak: true });
  const status = page.getByTestId("dropdown-agent-status");
  await expect(status).toContainText("Break");
  await expect(page.getByTestId("agent-break-dialog")).toHaveCount(0);
  await status.click();
  await expect(page.getByTestId("agent-break-dialog").getByRole("heading")).toHaveText("Back Office agenda");
  expect(fixture.writes).toEqual([]);
  expect(fixture.errors).toEqual([]);
});