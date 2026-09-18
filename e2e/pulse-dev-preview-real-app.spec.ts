import { test, expect } from "@playwright/test";

const previewUser = {
  id: "pulse-preview-user",
  username: "pulse-preview",
  fullName: "Pulse Preview Agent",
  role: "admin",
  roleId: null,
  assignedCountries: ["SK"],
  roleLandingPage: "/customers",
  nexusEnabled: false,
  showNotificationBell: false,
  showEmailQueue: false,
  showSipPhone: false,
};

for (const activeSession of [false, true]) {
test(`dev preview hard navigation preserves workspace with active session=${activeSession}`, async ({ page }) => {
  test.setTimeout(90_000);
  const pageErrors: string[] = [];
  const navigations: string[] = [];
  const mutationAttempts: string[] = [];

  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("framenavigated", frame => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });

  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === "/api/auth/heartbeat" && request.method() === "POST") {
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"success":true}' });
      return;
    }
    if (!["GET", "HEAD"].includes(request.method())) {
      mutationAttempts.push(`${request.method()} ${path}`);
      await route.fulfill({
        status: 405,
        contentType: "application/json",
        body: JSON.stringify({ error: "Mutations are disabled in this test" }),
      });
      return;
    }

    let body: unknown = [];
    if (path === "/api/auth/me") {
      body = { user: previewUser };
    } else if (path === "/api/agent-sessions/active") {
      body = activeSession ? {
        id: "pulse-preview-session",
        userId: previewUser.id,
        status: "available",
        startedAt: "2026-01-01T00:00:00.000Z",
        endedAt: null,
        totalCallTime: 0,
        totalEmailTime: 0,
        totalSmsTime: 0,
        contactsHandled: 0,
        totalBreakTime: 0,
        totalWorkTime: 0,
        campaignIds: [],
        inboundQueueIds: [],
      } : null;
    } else if (path.includes("/unread-count") || path.includes("/count")) {
      body = { count: 0 };
    } else if (path.includes("/settings") || path.includes("/preferences") || path.includes("/configuration")) {
      body = {};
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: async () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
      },
    });
  });

  // Start from an authenticated real application route. This also allows the
  // AuthProvider's initial query/effect cycle to settle before the user action.
  await page.goto("/customers");
  await expect(page).toHaveURL("/customers");
  await expect(page.getByTestId("button-pulse-status")).toBeVisible();
  await page.getByTestId("button-pulse-status").click();
  await expect(page.getByTestId("button-pulse-ui-preview")).toBeVisible();

  navigations.length = 0;
  await page.getByTestId("button-pulse-ui-preview").click();

  // The preview button intentionally performs a full document navigation.
  // The authenticated app must survive that reload and retain the query string.
  await expect(page, `main-frame navigations: ${JSON.stringify(navigations)}`).toHaveURL(
    "/agent-workspace?pulse-ui-preview=1",
  );
  await expect(page.getByTestId("pulse-dev-preview-banner")).toBeVisible({ timeout: 30_000 });
  if (!activeSession) {
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText(/shift|smen|zmen/i);
    await page.screenshot({ path: "/tmp/pulse-preview-shift-login.png" });
  }
  await page.reload();
  await expect(page.getByTestId("pulse-dev-preview-banner")).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL("/agent-workspace?pulse-ui-preview=1");
  expect(mutationAttempts).toEqual([]);
  expect(pageErrors).toEqual([]);
});
}