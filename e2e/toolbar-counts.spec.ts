import { test, expect } from "@playwright/test";

test("Session activity hides zero icons and counts, including configured quotas, and restores positive channels", async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ json: { enabled: false } }));
  await page.goto("/test-fixtures/toolbar-counts.html", { waitUntil: "domcontentloaded" });
  const counters = page.locator(".pta-micro-counts");
  await expect(page.getByTestId("agent-toolbar-unified")).toBeVisible();
  await expect(counters).toHaveCount(0);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const quotas of [null, { calls: 3, emails: 10, sms: 15 }]) {
      for (const selected of ["calls", "emails", "sms"]) {
        await page.evaluate(({ selected, quotas }) => window.dispatchEvent(new CustomEvent("test:session-stats", {
          detail: { stats: { calls: 0, emails: 0, sms: 0, [selected]: 3 }, quotas },
        })), { selected, quotas });
        for (const category of ["calls", "emails", "sms"]) {
          const counter = page.getByTestId(`stat-${category}`);
          if (category === selected) {
            await expect(counter).toBeVisible();
            await expect(counter.locator("svg")).toHaveCount(1);
            await expect(counter.locator("b")).toHaveText(quotas ? `3/${quotas[category as keyof typeof quotas]}` : "3");
          } else await expect(counter).toHaveCount(0);
        }
        if (selected === "calls" && quotas) await expect(page.getByTestId("stat-calls")).toHaveClass(/pta-quota-blocked/);
      }
      await page.evaluate(quotas => window.dispatchEvent(new CustomEvent("test:session-stats", {
        detail: { stats: { calls: 0, emails: 0, sms: 0 }, quotas },
      })), quotas);
      await expect(counters).toHaveCount(0);
    }
  }
});

test("Missed communications hides zero indicators and restores only positive categories", async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ json: { enabled: false } }));
  await page.goto("/test-fixtures/toolbar-counts.html", { waitUntil: "domcontentloaded" });
  const trigger = page.getByTestId("btn-open-abandoned-calls");
  await expect(trigger).toBeVisible();
  await expect(trigger.locator(".pta-counts")).toHaveCount(0);
  for (const selected of ["calls", "emails", "sms"]) {
    await page.evaluate(selected => window.dispatchEvent(new CustomEvent("test:missed-counts", {
      detail: { calls: 0, emails: 0, sms: 0, [selected]: 3 },
    })), selected);
    for (const category of ["calls", "emails", "sms"]) {
      const badge = page.getByTestId(`badge-missed-${category}`);
      if (category === selected) await expect(badge).toContainText("3");
      else await expect(badge).toHaveCount(0);
    }
  }
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("test:missed-counts", {
    detail: { calls: 0, emails: 0, sms: 0 },
  })));
  await expect(trigger.locator(".pta-counts")).toHaveCount(0);
  await expect(trigger).toBeVisible();
  await page.evaluate(() => window.addEventListener("test:missed-open", () => {
    document.body.setAttribute("data-missed-open", "true");
  }, { once: true }));
  await trigger.click();
  await expect(page.locator("body")).toHaveAttribute("data-missed-open", "true");
});

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
