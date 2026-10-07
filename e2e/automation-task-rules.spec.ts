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

async function fixture(page: Page, taskAction = false) {
  const requests: any[] = [];
  const errors: string[] = [];
  let savedRule: any = structuredClone(rule);
  if (taskAction) savedRule.actions = [{ type: "create_task", config: { title: "Review record", assignedUserId: "anna" } }];
  let templates = [{
    id: "task-review", type: "task", name: "Review template", subject: "Check record",
    content: "Check the record and write the result.", language: "en", isActive: true,
    createdAt: "2026-10-07T09:00:00.000Z", updatedAt: "2026-10-07T09:00:00.000Z",
  }];
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
    if (request.method() === "POST" && path === "/api/message-templates") {
      const body = request.postDataJSON();
      requests.push(body);
      const created = { ...body, id: "created-task-template", createdAt: "2026-10-07T09:00:00.000Z", updatedAt: "2026-10-07T09:00:00.000Z" };
      templates.push(created);
      return route.fulfill({ status: 201, json: created });
    }
    if (path === "/api/message-templates/created-task-template" && request.method() === "PATCH") {
      const body = request.postDataJSON();
      requests.push(body);
      templates = templates.map(template => template.id === "created-task-template" ? { ...template, ...body } : template);
      return route.fulfill({ json: templates.find(template => template.id === "created-task-template") });
    }
    if (path === "/api/message-templates/created-task-template" && request.method() === "DELETE") {
      templates = templates.filter(template => template.id !== "created-task-template");
      return route.fulfill({ status: 204 });
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
    else if (path.startsWith("/api/roles")) data = [{ id: "manager-role", name: "Manager", legacyRole: "manager", isActive: true }];
    else if (path === "/api/message-templates") data = templates;
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
    await expect(page.locator('input[type="date"],input[type="datetime-local"]')).toHaveCount(0);
    await page.getByTestId("input-create-task-duedate-year").selectOption("2026");
    await page.getByTestId("input-create-task-duedate-month").selectOption("10");
    await page.getByTestId("input-create-task-duedate-day").selectOption("7");
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

  test("THEN supports mixed recipients, compact text and relative minute deadlines", async ({ page }) => {
    const state = await fixture(page, true);
    await page.locator('button[aria-controls="automation-step-then-body"]').click();
    await page.getByTestId("input-task-action-title").fill("Follow up");
    await page.getByTestId("input-task-action-description").fill("Short context");
    await page.getByTestId("textarea-task-action-text").fill("Check the data.");
    await page.getByRole("checkbox", { name: /Boris Test/ }).click();
    await page.getByRole("checkbox", { name: "BO", exact: true }).click();
    await page.getByRole("checkbox", { name: "Manager", exact: true }).click();
    await page.getByRole("button", { name: "After trigger", exact: true }).click();
    await page.getByRole("button", { name: "30 min", exact: true }).click();
    await page.getByTestId("button-save-rule").click();
    await expect.poll(() => state.requests.length).toBe(1);
    const config = state.requests[0].actions[0].config;
    expect(config).toMatchObject({ title: "Follow up", description: "Short context", taskText: "Check the data.", dueInHours: 0.5 });
    expect(config.recipients).toEqual(expect.arrayContaining([
      { kind: "user", id: "anna" }, { kind: "user", id: "boris" },
      { kind: "group", id: "bo" }, { kind: "role", id: "manager-role" },
    ]));
    expect(config.assignedUserId).toBeUndefined();
    expect(state.errors).toEqual([]);
  });

  test("a Task template copies text into the rule and can be edited without modifying the template", async ({ page }) => {
    const state = await fixture(page, true);
    await page.locator('button[aria-controls="automation-step-then-body"]').click();
    await page.getByTestId("select-task-action-template").click();
    await page.getByRole("option", { name: /^Review template/ }).click();
    await expect(page.getByTestId("input-task-action-title")).toHaveValue("Check record");
    await expect(page.getByTestId("textarea-task-action-text")).toHaveValue("Check the record and write the result.");
    await page.getByTestId("textarea-task-action-text").fill("Custom instructions");
    await page.getByRole("button", { name: "{{newValues.title}}", exact: true }).click();
    await expect(page.getByTestId("textarea-task-action-text")).toHaveValue("Custom instructions {{newValues.title}}");
    await page.getByTestId("button-save-rule").click();
    await expect.poll(() => state.requests.length).toBe(1);
    expect(state.requests[0].actions[0].config).toMatchObject({
      templateId: "task-review", title: "Check record", taskText: "Custom instructions {{newValues.title}}",
    });
    await page.getByTestId("button-edit-test-rule").click();
    await page.locator('button[aria-controls="automation-step-then-body"]').click();
    await expect(page.getByTestId("textarea-task-action-text")).toHaveValue("Custom instructions {{newValues.title}}");
    expect(state.errors).toEqual([]);
  });

  test("fixed task deadlines reuse the Nexus Pulse date control and allow a weekend", async ({ page }) => {
    const state = await fixture(page, true);
    await page.locator('button[aria-controls="automation-step-then-body"]').click();
    await page.getByRole("button", { name: "On a date", exact: true }).click();
    await page.getByTestId("input-create-task-duedate-year").selectOption("2026");
    await page.getByTestId("input-create-task-duedate-month").selectOption("10");
    await page.getByTestId("input-create-task-duedate-day").selectOption("10");
    await expect(page.locator('input[type="date"],input[type="datetime-local"]')).toHaveCount(0);
    await page.getByTestId("button-save-rule").click();
    await expect.poll(() => state.requests.length).toBe(1);
    expect(state.requests[0].actions[0].config.dueAt).toMatch(/^2026-10-10T/);
    expect(state.requests[0].actions[0].config.dueInHours).toBeUndefined();
    expect(state.errors).toEqual([]);
  });

  test("expanded THEN retains save controls on desktop and a short mobile viewport", async ({ page }) => {
    const state = await fixture(page, true);
    await page.locator('button[aria-controls="automation-step-then-body"]').click();
    await expect(page.getByTestId("button-save-rule")).toBeInViewport();
    expect(await page.getByRole("dialog").evaluate(element => element.getBoundingClientRect().width))
      .toBeGreaterThanOrEqual(Math.min(page.viewportSize()!.width * 0.88, 1420));
    await page.screenshot({ path: "/tmp/automation-task-then-desktop.png" });
    await page.setViewportSize({ width: 390, height: 740 });
    await expect(page.getByTestId("button-save-rule")).toBeInViewport();
    const dialog = page.getByRole("dialog");
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.getByTestId("textarea-task-action-text").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("textarea-task-action-text")).toBeInViewport();
    await expect(page.getByTestId("button-save-rule")).toBeInViewport();
    await page.screenshot({ path: "/tmp/automation-task-then-mobile.png" });
    expect(state.errors).toEqual([]);
  });

  test("Configurator creates, edits and deletes Task templates without offering email sending", async ({ page }) => {
    const state = await fixture(page);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.goto("/configurator");
    await page.getByTestId("tab-email-router").click();
    await page.getByTestId("subtab-templates").click();
    await page.getByTestId("button-add-template").click();
    await page.getByTestId("toggle-type-task").click();
    await page.getByTestId("input-template-name").fill("Test task template");
    await page.getByTestId("input-template-subject").fill("Review requested");
    await expect(page.getByTestId("button-save-template")).toBeDisabled();
    await page.getByTestId("input-template-content").fill("Review the information.");
    await expect(page.getByTestId("button-open-test-email")).toHaveCount(0);
    await page.getByTestId("button-save-template").click();
    await expect.poll(() => state.requests.length).toBe(1);
    expect(state.requests[0]).toMatchObject({
      type: "task", format: "text", subject: "Review requested", content: "Review the information.",
    });
    await page.getByTestId("select-filter-type").click();
    await page.getByRole("option", { name: "Task", exact: true }).click();
    await page.getByTestId("button-edit-template-created-task-template").click();
    await expect(page.getByTestId("input-template-subject")).toHaveValue("Review requested");
    await page.getByTestId("input-template-content").fill("Updated instructions.");
    await page.getByTestId("button-save-template").click();
    await expect.poll(() => state.requests.length).toBe(2);
    expect(state.requests[1].content).toBe("Updated instructions.");
    await page.getByTestId("button-delete-template-created-task-template").click();
    await expect(page.getByTestId("button-edit-template-created-task-template")).toHaveCount(0);
    expect(state.errors).toEqual([]);
  });

  test("Back to service selection has padded scrollable cards on a short desktop and phone", async ({ page }) => {
    const state = await fixture(page);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByTestId("button-create-rule").click();
    await page.getByTestId("choose-service-create_task").click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const catalogPanel = dialog.getByTestId("automation-service-catalog");
    await page.setViewportSize({ width: 1280, height: 650 });
    await expect(catalogPanel).toBeVisible();
    const metrics = await catalogPanel.evaluate(element => ({
      padding: parseFloat(getComputedStyle(element).paddingLeft),
      overflow: getComputedStyle(element).overflowY,
      top: element.getBoundingClientRect().top,
      bottom: element.getBoundingClientRect().bottom,
      height: window.innerHeight,
    }));
    expect(metrics.padding).toBeGreaterThanOrEqual(16);
    expect(metrics.overflow).toBe("auto");
    expect(metrics.top).toBeGreaterThan(0);
    expect(metrics.bottom).toBeLessThanOrEqual(metrics.height);
    await page.screenshot({ path: "/tmp/automation-service-return-desktop.png" });
    await catalogPanel.getByTestId("choose-service-remove_tag").scrollIntoViewIfNeeded();
    await expect(catalogPanel.getByTestId("choose-service-remove_tag")).toBeInViewport();
    await page.setViewportSize({ width: 390, height: 740 });
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await catalogPanel.getByTestId("choose-service-create_task").scrollIntoViewIfNeeded();
    await expect(catalogPanel.getByTestId("choose-service-create_task")).toBeInViewport();
    await page.screenshot({ path: "/tmp/automation-service-return-mobile.png" });
    await catalogPanel.getByTestId("choose-service-create_task").click();
    await expect(page.getByTestId("select-module")).toBeVisible();
    expect(state.errors).toEqual([]);
  });

  test("Task template variables insert braces and expose salutations with translated Configurator tabs", async ({ page }) => {
    const state = await fixture(page);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.goto("/configurator");
    await expect(page.getByTestId("tab-email-router")).toHaveText("Email & GSM & Task");
    await page.getByTestId("tab-email-router").click();
    await expect(page.getByTestId("subtab-templates")).toHaveText("Templates");
    await page.getByTestId("subtab-templates").click();
    await page.getByTestId("button-add-template").click();
    await page.getByTestId("toggle-type-task").click();
    await page.getByTestId("input-template-name").fill("Variable test");
    await page.getByTestId("input-template-subject").fill("Contact review");
    const text = page.getByTestId("input-template-content");
    await text.fill("Review ");
    const search = page.getByTestId("input-template-variable-search");
    await search.fill("newValues.firstName");
    await page.getByTestId("button-variable-{{newValues.firstName}}").first().click();
    await expect(text).toHaveValue("Review {{newValues.firstName}}");
    await search.fill("salutationFull");
    await page.getByTestId("button-variable-{{newValues.salutationFull}}").first().click();
    await expect(text).toHaveValue("Review {{newValues.firstName}}{{newValues.salutationFull}}");
    await search.fill("salutationDoc");
    await expect(page.getByTestId("button-variable-{{newValues.salutationDoc}}").first()).toBeVisible();
    await page.getByTestId("button-save-template").click();
    await expect.poll(() => state.requests.length).toBe(1);
    expect(state.requests[0].content).toBe("Review {{newValues.firstName}}{{newValues.salutationFull}}");
    expect(state.errors).toEqual([]);
  });
});
