import { test, expect } from "@playwright/test";

test("Inbox badges appear above zero and disappear again at zero", async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ json: route.request().url().includes("/auth/me")
    ? { user: { id: "test-agent", username: "agent", fullName: "Test Agent", role: "admin", isActive: true, assignedCountries: ["SK"] } }
    : { enabled: false } }));
  await page.goto("/test-fixtures/toolbar-counts.html", { waitUntil: "domcontentloaded" });
  const inbox = page.getByTestId("btn-toolbar-communication-center");
  await expect(inbox).toBeVisible();
  await expect(inbox.locator(".pta-communication-counts")).toHaveCount(0);
  await expect(page.getByTestId("communication-updates-dot")).toHaveCount(0);
  const indicators = { inProgress: "progress", completed: "completed", chat: "chat", backOffice: "back-office" };
  for (const [field, indicator] of Object.entries(indicators)) {
    await page.evaluate(field => window.dispatchEvent(new CustomEvent("test:inbox-counts", {
      detail: { inProgress: 0, completed: 0, chat: 0, backOffice: 0, [field]: 2 },
    })), field);
    await expect(page.getByTestId(`communication-updates-${indicator}`)).toContainText("2");
    for (const other of Object.values(indicators).filter(value => value !== indicator)) {
      await expect(page.getByTestId(`communication-updates-${other}`)).toHaveCount(0);
    }
    await expect(page.getByTestId("communication-updates-dot")).toHaveCount(1);
  }
  await page.screenshot({ path: "test-results/inbox-only-back-office.png" });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("test:inbox-counts", {
    detail: { inProgress: 0, completed: 0, chat: 0, backOffice: 0 },
  })));
  await expect(inbox.locator(".pta-communication-counts")).toHaveCount(0);
  await expect(page.getByTestId("communication-updates-dot")).toHaveCount(0);
  await expect(inbox).toBeVisible();
});
