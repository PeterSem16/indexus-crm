import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
const catalog = JSON.parse(execFileSync("npx", ["tsx", "script/task-automation-browser-catalog.ts"], { encoding: "utf8" }));
const rule = {
  id: "test-rule", name: "Task routing test", description: "Compact description", module: "task",
  countryCode: null, countryCodes: ["SK"], enabled: false, isSystem: false,
  trigger: { type: "event", entityType: "task", eventType: "created" }, conditions: null,
  actions: [{ type: "notify_user", config: { userId: "anna", title: "Task event" } }], rateLimitPerHour: null,
  updatedAt: "2026-10-07T09:00:00.000Z",
};

async function fixture(page: Page) {
  const requests: any[] = [];
  const errors: string[] = [];
  let savedRule: any = structuredClone(rule);
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let data: unknown = [];
    if (request.method() === "PATCH" && path === "/api/automation/rules/test-rule") {
      const payload = request.postDataJSON();
      requests.push(payload);
      savedRule = { ...savedRule, ...payload };
      return route.fulfill({ json: savedRule });
    }
    if (request.method() === "POST" && path === "/api/automation/rules") {
      requests.push(request.postDataJSON());
      return route.fulfill({ status: 201, json: { ...request.postDataJSON(), id: "created-rule" } });
    }
    if (!["GET", "HEAD"].includes(request.method())) {
      if (path === "/api/auth/heartbeat") return route.fulfill({ json: { success: true } });
      return route.fulfill({ status: 405, json: { error: "All other test mutations are blocked" } });
    }
    if (path === "/api/auth/me") data = { user: {
      id: "test-admin", username: "test", fullName: "Test Admin", role: "admin",
      roleId: null, assignedCountries: [], nexusEnabled: false,
      showNotificationBell: false, showEmailQueue: false, showSipPhone: false,
    } };
    else if (path === "/api/automation/catalog") data = catalog;
    else if (path === "/api/automation/rules") data = [savedRule];
    else if (path === "/api/automation/users" || path === "/api/users") data = [
      { id: "anna", fullName: "Anna Test", email: "anna@example.test" },
      { id: "boris", fullName: "Boris Test", email: "boris@example.test" },
    ];
    else if (path === "/api/task-groups") data = [
      { id: "it", name: "IT", members: [{ userId: "anna" }] },
      { id: "bo", name: "Back Office", displayAlias: "BO", members: [{ userId: "boris" }] },
    ];
    else if (path === "/api/departments") data = [{ id: "support", name: "Customer Support" }];
    else if (path.includes("/count") || path.includes("/unread-count")) data = { count: 0 };
    else if (path.includes("/preferences") || path.includes("/settings") || path.includes("/configuration")) data = {};
    await route.fulfill({ json: data });
  });
  await page.goto("/automations");
  await expect(page.getByTestId("button-create-rule")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("tab-rules").click();
  await page.getByTestId("button-edit-test-rule").click();
  await expect(page.getByTestId("input-rule-name")).toBeVisible();
  return { requests, errors };
}

async function chooseEvent(page: Page, event: string) {
  await page.getByTestId("select-event").click();
  await page.getByTestId(`select-event-${event}`).click();
}

async function addCondition(page: Page, field: string) {
  await page.getByTestId("button-add-conditions").click();
  await chooseField(page, field);
}

async function chooseField(page: Page, label: string) {
  await page.getByRole("combobox", { name: "Field", exact: true }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

test.describe("Task automation editor in the real App", () => {
  test.setTimeout(90_000);
  test.use({ viewport: { width: 1280, height: 900 } });

  test("new Create a task rule begins at WHEN and retains its action", async ({ page }) => {
    const state = await fixture(page);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByTestId("button-create-rule").click();
    await page.getByTestId("choose-service-create_task").click();
    await expect(page.getByTestId("select-module")).toBeVisible();
    await expect(page.getByTestId("select-event")).toBeVisible();
    await expect(page.getByTestId("select-country-scope")).toContainText("All countries");
    await expect(page.getByTestId("select-trigger-suggestion")).toHaveCount(0);
    await chooseEvent(page, "task.assigned");
    await page.getByTestId("task-trigger-target-groups").click();
    await page.getByTestId("task-trigger-target-values").click();
    await page.getByRole("checkbox", { name: "IT", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByTestId("tab-json").click();
    const json = await page.locator("textarea").inputValue();
    const draft = JSON.parse(json);
    expect(draft.actions).toEqual([{ type: "create_task", config: {} }]);
    expect(draft.trigger.assignmentTarget).toEqual({ kind: "groups", ids: ["it"] });
    expect(state.requests).toEqual([]);
    expect(state.errors).toEqual([]);
  });

  test("compact fields and dropdown countries persist and reopen", async ({ page }) => {
    const state = await fixture(page);
    const description = page.getByTestId("textarea-rule-description");
    expect((await description.boundingBox())!.height).toBeLessThanOrEqual(60);
    await page.getByTestId("input-rule-name").fill("Updated compact rule");
    await description.fill("Short description");
    await page.getByTestId("select-country-scope").click();
    await page.getByTestId("select-country-CZ").click();
    await expect(page.getByTestId("select-country-SK")).toBeChecked();
    await expect(page.getByTestId("select-country-CZ")).toBeChecked();
    await page.keyboard.press("Escape");
    await page.getByTestId("button-save-rule").click();
    await expect.poll(() => state.requests.length).toBe(1);
    expect(state.requests[0]).toMatchObject({ name: "Updated compact rule", description: "Short description", countryCode: null, countryCodes: ["SK", "CZ"] });
    await page.getByTestId("button-edit-test-rule").click();
    await expect(page.getByTestId("select-country-scope")).toContainText("Czechia");
    await page.getByTestId("select-country-scope").click();
    await page.getByTestId("select-country-all").click();
    await expect(page.getByTestId("select-country-all")).toBeChecked();
    await expect(page.getByTestId("select-country-SK")).not.toBeChecked();
    await page.keyboard.press("Escape");
    await page.getByTestId("button-save-rule").click();
    await expect.poll(() => state.requests.length).toBe(2);
    expect(state.requests[1].countryCodes).toBeNull();
    expect(state.errors).toEqual([]);
  });

  test("events have icons and explain edit versus status change, without Suggestions", async ({ page }) => {
    const state = await fixture(page);
    await expect(page.getByTestId("select-trigger-suggestion")).toHaveCount(0);
    await page.getByTestId("select-event").click();
    for (const event of catalog.eventTypes.filter((event: any) => event.availableIn.includes("task"))) {
      await expect(page.getByTestId(`select-event-${event.value}`).locator("svg").last()).toBeVisible();
    }
    await page.getByTestId("select-event-updated").click();
    await expect(page.getByTestId("task-event-description")).toContainText("priority");
    await chooseEvent(page, "status_changed");
    await expect(page.getByTestId("task-event-description")).toContainText("Other edits do not trigger");
    await page.screenshot({ path: "/tmp/automation-task-desktop.png" });
    expect(state.errors).toEqual([]);
  });

  test("assignment selects several groups or people exclusively and persists", async ({ page }) => {
    const state = await fixture(page);
    await chooseEvent(page, "task.assigned");
    await page.getByTestId("task-trigger-target-groups").click();
    await expect(page.getByTestId("button-save-rule")).toBeDisabled();
    await page.getByTestId("task-trigger-target-values").click();
    await page.getByRole("checkbox", { name: "IT", exact: true }).click();
    await page.getByRole("checkbox", { name: "BO", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByTestId("button-save-rule").click();
    await expect.poll(() => state.requests.length).toBe(1);
    expect(state.requests[0].trigger.assignmentTarget).toEqual({ kind: "groups", ids: ["it", "bo"] });
    await page.getByTestId("button-edit-test-rule").click();
    await expect(page.getByTestId("task-trigger-target-values")).toContainText("IT");
    await page.getByTestId("task-trigger-target-users").click();
    await expect(page.getByTestId("task-trigger-target-values")).not.toContainText("IT");
    await expect(page.getByTestId("button-save-rule")).toBeDisabled();
    await page.getByTestId("task-trigger-target-values").click();
    await page.getByRole("checkbox", { name: "Anna Test", exact: true }).click();
    await page.getByRole("checkbox", { name: "Boris Test", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByTestId("button-save-rule").click();
    await expect.poll(() => state.requests.length).toBe(2);
    expect(state.requests[1].trigger.assignmentTarget).toEqual({ kind: "users", ids: ["anna", "boris"] });
    expect(state.errors).toEqual([]);
  });

  test("IF uses actual task priorities and statuses and named users/departments", async ({ page }) => {
    const state = await fixture(page);
    await addCondition(page, "Priority");
    await page.getByRole("combobox", { name: "Value", exact: true }).click();
    await expect(page.getByRole("option", { name: "Urgent", exact: true })).toBeVisible();
    await page.getByRole("option", { name: "High", exact: true }).click();
    await chooseField(page, "Status");
    await page.getByRole("combobox", { name: "Value", exact: true }).click();
    await expect(page.getByRole("option", { name: "Cancelled", exact: true })).toBeVisible();
    await page.getByRole("option", { name: "Completed", exact: true }).click();
    await chooseField(page, "Assignee (person)");
    await page.getByRole("combobox", { name: "Value", exact: true }).click();
    await page.getByRole("option", { name: "Anna Test", exact: true }).click();
    await chooseField(page, "Assigned department");
    await page.getByRole("combobox", { name: "Value", exact: true }).click();
    await page.getByRole("option", { name: "Customer Support", exact: true }).click();
    await page.getByTestId("button-save-rule").click();
    await expect.poll(() => state.requests.length).toBe(1);
    expect(state.requests[0].conditions.all[0]).toEqual({ field: "newValues.assignedDepartmentId", op: "eq", value: "support" });
    expect(state.errors).toEqual([]);
  });

  test("resolver offers people and groups; resolution time remains a date", async ({ page }) => {
    const state = await fixture(page);
    await chooseEvent(page, "task.completed");
    await addCondition(page, "Resolved by (person)");
    await page.getByRole("combobox", { name: "Value", exact: true }).click();
    await page.getByRole("option", { name: "Boris Test", exact: true }).click();
    await chooseField(page, "Resolved by (group)");
    await page.getByRole("combobox", { name: "Value", exact: true }).click();
    await page.getByRole("checkbox", { name: "BO", exact: true }).click();
    await page.keyboard.press("Escape");
    await page.getByTestId("button-save-rule").click();
    await expect.poll(() => state.requests.length).toBe(1);
    expect(state.requests[0].conditions.all[0]).toEqual({ field: "newValues.resolvedByGroupIds", op: "in", value: ["bo"] });
    await page.getByTestId("button-edit-test-rule").click();
    await page.locator('button[aria-controls="automation-step-if-body"]').click();
    await chooseField(page, "Resolved at");
    const value = page.locator('input[aria-label="Value"]');
    await expect(value).toHaveAttribute("type", "date");
    await value.fill("2026-10-07");
    await page.getByTestId("button-save-rule").click();
    await expect.poll(() => state.requests.length).toBe(2);
    expect(state.requests[1].conditions.all[0]).toMatchObject({ field: "newValues.resolvedAt", value: "2026-10-07" });
    expect(state.errors).toEqual([]);
  });

  test("phone layout retains all controls without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const state = await fixture(page);
    const dialog = page.getByRole("dialog");
    await expect(page.getByTestId("input-rule-name")).toBeVisible();
    await expect(page.getByTestId("select-country-scope")).toBeVisible();
    await expect(page.getByTestId("button-save-rule")).toBeVisible();
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.getByTestId("select-country-scope").click();
    await expect(page.getByTestId("select-country-all")).toBeVisible();
    await page.screenshot({ path: "/tmp/automation-task-mobile.png" });
    expect(state.errors).toEqual([]);
  });
});
