import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
const catalog = JSON.parse(execFileSync("npx", ["tsx", "script/task-automation-browser-catalog.ts"], { encoding: "utf8" }));
const base = {
  name: "Routing rule", description: "Native request test", module: "task",
  countryCode: null, countryCodes: ["SK"], enabled: true, isSystem: false,
  trigger: { type: "event", entityType: "task", eventType: "created" }, conditions: null,
  actions: [{ type: "notify_user", config: { userId: "anna", title: "Task event" } }],
  rateLimitPerHour: null, updatedAt: "2026-10-14T09:00:00Z",
};
async function fixture(page: Page, tab = "rules") {
  const mutations: { path: string; method: string; data: any }[] = [];
  const errors: string[] = [];
  let rules: any[] = [
    { ...structuredClone(base), id: "regular" },
    { ...structuredClone(base), id: "system", name: "System rule", countryCodes: [], isSystem: true },
    { ...structuredClone(base), id: "errors", name: "Failed Hungarian rule", enabled: false, countryCodes: ["HU"], disabledReason: "Fixture auto-pause", consecutiveErrorCount: 2, lastErrorMessage: "Fixture gateway error" },
    { ...structuredClone(base), id: "review", name: "Review me", enabled: false, trigger: { ...base.trigger, legacySource: { kind: "notification", id: "legacy" } } },
  ];
  const runs = [
    { id: "run-ok", ruleId: "regular", status: "success", startedAt: "2026-10-14T09:00:00Z", finishedAt: "2026-10-14T09:00:00.200Z", error: null, skippedReason: null },
    { id: "run-failed", ruleId: "errors", status: "failed", startedAt: "2026-10-14T08:00:00Z", finishedAt: "2026-10-14T08:00:00.600Z", error: "Historic failure", skippedReason: null },
    { id: "run-skipped", ruleId: "regular", status: "skipped", startedAt: "2026-10-13T22:30:00Z", finishedAt: null, error: null, skippedReason: "condition_false" },
    { id: "run-live", ruleId: "system", status: "running", startedAt: "2026-10-13T20:30:00Z", finishedAt: null, error: null, skippedReason: null },
  ];
  let failList = false, failDetail = false, noRuns = false;
  page.on("pageerror", error => errors.push(error.message));
  // Network-only fixtures: do not bypass auth in app source or wrap window.fetch.
  await page.routeWebSocket("**", ws => ws.close());
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url()), path = url.pathname;
    if (request.method() !== "GET") {
      if (path === "/api/auth/heartbeat") return route.fulfill({ json: { success: true } });
      if (!path.startsWith("/api/automation/rules/")) return route.fulfill({ status: 405, json: { error: "Non-fixture writes blocked" } });
      const id = path.split("/")[4];
      const data = request.postData() ? request.postDataJSON() : null;
      mutations.push({ path, method: request.method(), data });
      if (request.method() === "DELETE") rules = rules.filter(rule => rule.id !== id);
      if (request.method() === "PATCH") rules = rules.map(rule => rule.id === id ? { ...rule, ...data } : rule);
      if (path.endsWith("/reset-errors")) rules = rules.map(rule => rule.id === id ? { ...rule, consecutiveErrorCount: 0, disabledReason: null, lastErrorMessage: null, enabled: data.reEnable || rule.enabled } : rule);
      if (path.endsWith("/activate-reviewed")) rules = rules.map(rule => rule.id === id ? { ...rule, enabled: true, trigger: { ...rule.trigger, legacySource: { ...rule.trigger.legacySource, reviewActivatedAt: "2026-10-14" } } } : rule);
      return route.fulfill({ json: { ok: true } });
    }
    let data: unknown = [];
    if (path === "/api/auth/me") data = { user: { id: "test-admin", username: "test", fullName: "Test Admin", role: "admin", roleId: null, assignedCountries: [], nexusEnabled: false, showNotificationBell: false, showEmailQueue: false, showSipPhone: false } };
    else if (path === "/api/automation/catalog") data = catalog;
    else if (path === "/api/automation/rules") data = rules;
    else if (path === "/api/automation/users" || path === "/api/users") data = [{ id: "anna", fullName: "Anna Test", email: "anna@example.test" }];
    else if (path === "/api/automation/runs") {
      if (failList) return route.fulfill({ status: 500, json: { error: "Fixture failure" } });
      data = noRuns ? [] : url.searchParams.get("ruleId") ? runs.filter(run => run.ruleId === url.searchParams.get("ruleId")) : runs;
    } else if (path.startsWith("/api/automation/runs/")) {
      if (failDetail) return route.fulfill({ status: 500, json: { error: "Fixture detail failure" } });
      const run = runs.find(run => run.id === path.split("/").pop());
      data = { run, event: { module: "task", entityType: "task", eventType: "created", entityId: "historic-entity" },
        actions: run?.status === "success" ? [{ id: "historic-action", actionIndex: 0, actionType: "create_task", status: "success", output: { reference: "HISTORICAL-ONLY" } }] : [] };
    } else if (path.includes("/count") || path.includes("/unread-count")) data = { count: 0 };
    else if (path.includes("/preferences") || path.includes("/settings") || path.includes("/configuration")) data = {};
    return route.fulfill({ json: data });
  });
  await page.goto(`/automations?tab=${tab}`);
  await expect(page.locator(".automation-production-overview")).toBeVisible({ timeout: 60_000 });
  return { mutations, errors, setListError: (value: boolean) => { failList = value; },
    setDetailError: (value: boolean) => { failDetail = value; }, setEmpty: () => { noRuns = true; } };
}

test("Rules: native requests, filters, toggle, guarded review/reset/delete, editor and history", async ({ page }) => {
  const state = await fixture(page);
  await expect(page.getByTestId("card-rule-regular")).toBeVisible();
  await expect(page.getByTestId("legacy-rules-review")).toBeVisible();
  await page.locator(".el-select-wrap").first().locator("select").selectOption("HU");
  await expect(page.getByTestId("card-rule-errors")).toBeVisible();
  await expect(page.getByTestId("card-rule-regular")).toHaveCount(0);
  await expect(page.getByTestId("card-rule-system")).toBeVisible(); // Unscoped rule remains applicable.
  await page.locator(".el-clear-filters").first().click();
  await page.locator(".el-search input").fill("zzzz-no-match");
  await expect(page.locator(".el-empty")).toBeVisible();
  await page.locator(".el-empty button").click();
  await page.getByTestId("switch-enabled-regular").click();
  await expect(page.getByTestId("switch-enabled-regular")).toHaveAttribute("aria-checked", "false");
  expect(state.mutations.at(-1)?.data).toEqual({ enabled: false });
  await page.getByTestId("card-rule-system").locator(".el-expand").click();
  await expect(page.getByTestId("button-delete-system")).toHaveCount(0);
  await expect(page.getByTestId("switch-enabled-review")).toBeDisabled();
  await page.getByTestId("card-rule-review").locator(".el-expand").click();
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByTestId("button-activate-reviewed-review").click();
  expect(state.mutations.some(item => item.path.endsWith("/activate-reviewed"))).toBe(false);
  page.once("dialog", dialog => dialog.accept());
  await page.getByTestId("button-activate-reviewed-review").click();
  await expect(page.getByTestId("switch-enabled-review")).toBeEnabled();
  await page.getByTestId("card-rule-errors").locator(".el-expand").click();
  await page.getByTestId("button-reset-errors-errors").click();
  await expect(page.getByTestId("text-disabled-reason-errors")).toHaveCount(0);
  expect(state.mutations.find(item => item.path.endsWith("/reset-errors"))?.data).toEqual({ reEnable: true });
  await page.getByTestId("card-rule-regular").locator(".el-expand").click();
  await page.getByTestId("button-edit-regular").click();
  await expect(page.getByTestId("input-rule-name")).toBeVisible();
  await page.getByRole("button", { name: /^(Cancel|Zrušiť)$/ }).click();
  await page.getByTestId("button-history-regular").click();
  await expect(page.locator("[role=dialog] .rules-history")).toBeVisible();
  await expect(page.locator("[role=dialog] [data-run-id]")).toHaveCount(2);
  await page.keyboard.press("Escape");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByTestId("button-delete-regular").click();
  await expect(page.getByTestId("card-rule-regular")).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByTestId("button-delete-regular").click();
  await expect(page.getByTestId("card-rule-regular")).toHaveCount(0);
  expect(state.errors).toEqual([]);
});

test("History: real status vocabulary, historical actions, JSON, selection, rule scopes, errors and empty", async ({ page }) => {
  const state = await fixture(page, "runs");
  await expect(page.locator("[data-run-id]")).toHaveCount(4);
  await expect(page.getByTestId("stat-success-rate")).toContainText("50%");
  await expect(page.locator(".rh-event-details")).toContainText("historic-entity");
  await page.locator(".rh-logged-action details summary").click();
  await expect(page.locator(".rh-logged-action pre")).toContainText("HISTORICAL-ONLY");
  await page.locator(".rh-raw-json summary").click();
  await expect(page.locator(".rh-raw-json pre")).toContainText('"actionType": "create_task"');
  await expect(page.locator(".rh-raw-json pre")).not.toContainText('"actionType": "notify_user"');
  await page.locator("[data-status-filter=skipped]").click();
  await expect(page.locator("[data-run-id]")).toHaveCount(1);
  await expect(page.getByTestId("run-inspector")).toContainText(/Conditions not met|Podmienky neboli splnené/);
  await page.locator(".rh-search input").fill("no-matches");
  await expect(page.locator(".rh-inspector-empty")).toBeVisible();
  await expect(page.locator(".rh-raw-json")).toHaveCount(0);
  await page.locator(".rh-empty button").click();
  await page.getByTestId("select-runs-rule").selectOption("regular");
  await expect(page.locator("[data-run-id]")).toHaveCount(2);
  await page.getByTestId("select-runs-rule").selectOption("all");
  await expect(page.locator("[data-run-id]")).toHaveCount(4);
  state.setDetailError(true);
  await page.locator("[data-run-id=run-failed]").click();
  await expect(page.locator(".rh-inspector [role=alert]").filter({ hasText: /Unable to load|Nepodarilo/ })).toBeVisible();
  await expect(page.locator(".rh-logged-action")).toHaveCount(0);
  state.setDetailError(false);
  state.setListError(true);
  await page.locator(".rh-heading button").click();
  await expect(page.locator(".rh-timeline [role=alert]")).toBeVisible();
  state.setListError(false);
  state.setEmpty();
  await page.locator(".rh-timeline [role=alert] button").click();
  await expect(page.locator("[data-run-id]")).toHaveCount(0);
  await expect(page.locator(".rh-empty")).toContainText(/No runs yet|Zatiaľ žiadne behy/);
  await page.locator(".rh-back").click();
  await expect(page.locator(".elegant-rules")).toBeVisible();
  expect(state.errors).toEqual([]);
});

test("Approved layout is responsive inside the real app, with mobile selection and reduced motion", async ({ page }) => {
  const state = await fixture(page);
  await expect(page.locator(".el-heading h1")).toHaveCSS("font-family", /Georgia/);
  await expect(page.locator(".el-button-primary")).toHaveCSS("background-color", "rgb(168, 50, 59)");
  for (const width of [1280, 1024, 390]) {
    await page.setViewportSize({ width, height: 850 });
    await expect(page.locator(".el-workspace")).toBeVisible();
    expect(await page.locator(".automation-production-overview").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
  await page.getByTestId("card-rule-regular").locator(".el-expand").click();
  await expect(page.getByTestId("button-history-regular")).toBeVisible();
  await page.screenshot({ path: "/tmp/automation-production-rules-mobile.png", fullPage: true });
  await page.getByTestId("tab-runs").click();
  await expect(page.locator("[data-run-id]")).toHaveCount(4);
  await page.locator("[data-run-id=run-failed]").click();
  await expect(page.getByTestId("run-inspector")).toContainText("Historic failure");
  expect(await page.locator(".rules-history").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.screenshot({ path: "/tmp/automation-production-history-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator(".rh-topbar").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "/tmp/automation-production-history-desktop.png", fullPage: true });
  expect(state.errors).toEqual([]);
});
