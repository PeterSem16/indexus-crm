import { expect, test } from "@playwright/test";

const user = {
  id: "lead-search-test-admin", username: "lead-search-test", fullName: "Lead Search Test",
  email: "lead-search@example.invalid", role: "admin", isActive: true, assignedCountries: ["SK"], preferredLanguage: "en",
};
const campaigns = [
  { id: 41, name: "Central Europe · Q3", country: "SK", isActive: true },
  { id: 52, name: "Bratislava clinics", country: "SK", isActive: false },
  { id: 77, name: "Moravia partners", country: "CZ", isActive: true },
];
const ruleBase = {
  id: "lead-search-rule", createdByUserId: user.id, name: "Lead search digest", description: "",
  module: "lead_search", countryCode: null, countryCodes: null, enabled: false, isSystem: false,
  trigger: { type: "event", entityType: "lead_search", eventType: "lead_search.results_found", leadCampaignIds: [41, 52] },
  conditions: null, actions: [{ type: "notify_user", config: { notificationActionVersion: 2 } }],
  rateLimitPerHour: null, updatedAt: "2026-09-16T10:00:00Z",
};
const catalog = {
  modules: [{ value: "task", label: "Task" }, { value: "lead_search", label: "Internet contact search" }],
  eventTypes: [
    { value: "updated", label: "Record updated", availableIn: ["task"], changeSnapshot: true },
    { value: "lead_search.results_found", label: "New leads found", availableIn: ["lead_search"], changeSnapshot: false },
  ],
  actionTypes: [{ value: "notify_user", label: "Notify a user", availableIn: ["task", "lead_search"], recipientTypes: [], purpose: "Send a notification", needs: [], configSchema: {} }],
  operators: [{ value: "eq", label: "Equals", arity: 1, availableIn: ["task", "lead_search"] }],
  fields: {}, fieldsByEvent: {}, recipients: [], recipientTemplatesByEvent: {}, countries: [{ value: "SK", label: "Slovakia" }],
  managedServices: [], statusListServices: [], inboundServices: [], outboundServices: [], integrationStatus: [],
};

for (const viewport of [{ width: 1360, height: 900 }, { width: 390, height: 844 }]) {
  test(`Internet contact campaign selection creates, reopens and preserves a paused rule at ${viewport.width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    let saved: any;
    let reopenedWithMissing = false;
    let campaignsAvailable = false;
    const errors: string[] = [];
    const writes: string[] = [];
    page.on("pageerror", error => { errors.push(error.message); console.error("Browser runtime error:", error.message); });

    await page.route("**/api/**", async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (path === "/api/auth/heartbeat") return route.fulfill({ json: { ok: true } });
      if (path === "/api/automation/lead-campaigns") return route.fulfill({ json: campaignsAvailable ? campaigns : [] });
      if (request.method() === "POST" && path === "/api/automation/rules") {
        writes.push(path);
        saved = { ...ruleBase, ...request.postDataJSON(), id: "lead-search-rule", updatedAt: "2026-09-16T10:00:00Z" };
        return route.fulfill({ status: 201, json: saved });
      }
      if (request.method() === "PATCH" && path === "/api/automation/rules/lead-search-rule") {
        writes.push(path);
        saved = { ...saved, ...request.postDataJSON() };
        return route.fulfill({ json: saved });
      }
      if (request.method() !== "GET") {
        writes.push(path);
        return route.fulfill({ status: 405, json: { error: "Test mutation blocked" } });
      }
      const body = path === "/api/auth/me" ? { user }
        : path === "/api/automation/catalog" ? catalog
          : path === "/api/automation/rules" ? saved ? [{
            ...saved,
            trigger: reopenedWithMissing ? { ...saved.trigger, leadCampaignIds: [41, 52, 999] } : saved.trigger,
          }] : []
            : path === "/api/automation/users" ? [user]
              : path === "/api/roles" || path === "/api/task-groups" || path === "/api/departments" ? []
                : path.includes("permissions") ? {} : [];
      return route.fulfill({ json: body });
    });

    await page.goto("/automations", { waitUntil: "networkidle" });
    await page.getByTestId("button-create-rule").click();
    await page.getByTestId("choose-service-notify_user").last().click();
    await page.getByTestId("input-rule-name").fill("Lead search digest");
    const openWhen = () => page.getByTestId("rule-source-event").locator('button[aria-controls="automation-step-when-body"]').click();
    await openWhen();
    await page.getByTestId("select-module").click();
    await page.getByTestId("select-module-lead_search").click();
    const picker = page.getByTestId("lead-search-campaign-picker");
    const save = page.getByTestId("button-save-rule");
    await expect(picker).toBeVisible();
    await expect(save).toBeDisabled();
    await expect(page.getByTestId("lead-search-selection-error")).toBeVisible();
    await expect(picker).toContainText(/No search campaigns available|Nie sú dostupné vyhľadávacie kampane/);
    campaignsAvailable = true;
    await page.getByTestId("lead-search-campaign-refresh").click();
    await expect(page.getByTestId("lead-search-campaign-77")).toBeVisible();

    // Select all uses the complete authorized catalog even when the text filter hides two entries.
    await page.getByTestId("lead-search-campaign-search").fill("not a campaign");
    await expect(picker).toContainText(/No campaigns match your search|Vyhľadávaniu nezodpovedá žiadna kampaň/);
    await page.getByTestId("lead-search-campaign-search").fill("Q3");
    await page.getByTestId("lead-search-select-all").click();
    await expect(page.getByTestId("lead-search-selected-count")).toContainText("3");
    await expect(page.getByTestId("lead-search-selected-41")).toBeVisible();
    await expect(page.getByTestId("lead-search-selected-52")).toBeVisible();
    await expect(page.getByTestId("lead-search-selected-77")).toBeVisible();
    await page.getByTestId("lead-search-clear-selection").click();
    await expect(page.getByTestId("lead-search-selection-error")).toBeVisible();
    await page.getByTestId("lead-search-campaign-search").fill("");
    await page.getByTestId("lead-search-campaign-41").click();
    await expect(page.getByTestId("lead-search-selected-41")).toBeVisible();
    await expect(page.getByTestId("lead-search-selected-52")).toHaveCount(0);
    await page.getByTestId("lead-search-campaign-52").click();
    await expect(save).toBeEnabled();
    await expect(page.getByTestId("rule-source-event")).toContainText(campaigns[0].name);
    reopenedWithMissing = true;
    await page.getByRole("button", { name: /Apply changes|Použiť zmeny/ }).click();
    await save.click();
    await expect.poll(() => saved?.trigger?.leadCampaignIds).toEqual([41, 52]);
    expect(saved.enabled).toBe(false);

    await page.getByTestId("tab-rules").click();
    await expect(page.getByTestId("card-rule-lead-search-rule")).toBeVisible();
    await expect(page.getByTestId("switch-enabled-lead-search-rule")).toHaveAttribute("aria-checked", "false");
    await page.getByTestId("card-rule-lead-search-rule").locator("button.el-expand").click();
    await page.getByTestId("button-edit-lead-search-rule").click();
    await openWhen();
    await expect(page.getByTestId("lead-search-selected-999")).toContainText(/Unavailable campaign|Nedostupná kampaň/);
    await expect(save).toBeDisabled();
    await page.getByTestId("lead-search-selected-999").getByRole("button").click();
    await expect(save).toBeEnabled();
    await expect(page.getByTestId("lead-search-selected-41")).toContainText(campaigns[0].name);
    await page.getByRole("button", { name: /Apply changes|Použiť zmeny/ }).click();
    await save.click();
    await expect.poll(() => saved?.trigger?.leadCampaignIds).toEqual([41, 52]);
    expect(saved.enabled).toBe(false);
    expect(writes).toEqual(["/api/automation/rules", "/api/automation/rules/lead-search-rule"]);
    expect(errors).toEqual([]);
  });
}
