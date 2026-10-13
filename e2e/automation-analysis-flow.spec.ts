import { test, expect } from "@playwright/test";
import { ANALYSIS_FIELDS } from "../shared/automation-analysis";
import { COMMUNICATION_SOURCE_FIELDS } from "../shared/automation-communication-context";
import { getTextSearchCopy } from "../client/src/i18n/automation-text-search-copy";

// Production page/providers, native fetch, isolated browser API fixtures. No actual account,
// source data, automation execution, notification, email or SMS is created by these tests.
const user = { id: "flow-test-owner", username: "flow-test", fullName: "Flow Test",
  email: "flow@example.invalid", role: "admin", isActive: true, assignedCountries: ["SK"], preferredLanguage: "en" };
const rule = { id: "flow-source", name: "Message analysis test", createdByUserId: user.id,
  module: "communication", enabled: true, countryCode: null, countryCodes: null, isSystem: false,
  trigger: { type: "event", entityType: "communication", eventType: "communication.received",
    listenAfter: "2026-10-13T07:48:52.694Z",
    analysis: { channels: ["email", "sms", "voice", "task", "chat"], analyzeContent: true, analyzeAttachments: false },
    noMatchRuleId: "flow-target" },
  conditions: { all: [{ field: "analysis.sentiment", op: "eq", value: "positive" },
    { any: [{ field: "communication.type", op: "eq", value: "email" }, { field: "communication.type", op: "eq", value: "voice" }] }] },
  actions: [{ type: "notify_user", config: { notificationActionVersion: 2, userIds: [user.id], title: "Alert",
    message: "<html><body><h1 style=\"color:#246b56\">Actual authored message</h1><p>{{communication.subject}}</p><script>window.messageExecuted=true</script></body></html>" } },
    ...Array.from({ length: 7 }, (_, i) => ({ type: "notify_user", config: { notificationActionVersion: 2, userIds: [user.id], title: `Next ${i}`, message: "Plain message" } }))],
  rateLimitPerHour: null, autoDisableThreshold: 5, updatedAt: "2026-10-13T08:00:00Z" };
const target = { ...rule, id: "flow-target", name: "Alternative analysis", trigger: { ...rule.trigger, noMatchRuleId: null }, actions: [] };
const catalog = { modules: [{ value: "communication", label: "Communications" }],
  eventTypes: [{ value: "communication.received", label: "Analyze selected communication", availableIn: ["communication"], changeSnapshot: false }],
  actionTypes: [{ value: "notify_user", label: "Notify a user", availableIn: ["communication"], configSchema: {} },
    { value: "forward_message", label: "Forward email / SMS", availableIn: ["communication"], configSchema: {} }],
  fields: { communication: [...ANALYSIS_FIELDS, ...COMMUNICATION_SOURCE_FIELDS] },
  fieldsByEvent: { communication: { "communication.received": [...ANALYSIS_FIELDS, ...COMMUNICATION_SOURCE_FIELDS] } },
  operators: [{ value: "eq", label: "Equals", arity: 1, availableIn: ["communication"] }],
  recipients: [], recipientTemplatesByEvent: {},
  countries: [{ value: "SK", label: "Slovakia" }] };

for (const viewport of [{ width: 1200, height: 760 }, { width: 768, height: 760 }, { width: 390, height: 844 }]) {
  test(`saved flow scroll, message isolation and nested fullscreen at ${viewport.width}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    const writes: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/**", async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (path === "/api/auth/heartbeat") return route.fulfill({ json: { ok: true } });
      if (request.method() !== "GET") {
        writes.push(path);
        return route.fulfill({ status: 405, json: { error: "Test mutation blocked" } });
      }
      const body = path === "/api/auth/me" ? { user } : path === "/api/automation/rules" ? [rule, target]
        : path === "/api/automation/catalog" ? catalog : path === "/api/automation/users" ? [user]
          : path.includes("permissions") ? {} : [];
      await route.fulfill({ json: body });
    });
    await page.goto("/automations", { waitUntil: "domcontentloaded" });
    const flowButton = page.getByTestId("button-flowchart-flow-source");
    if (!await flowButton.isVisible()) await page.getByRole("tab", { name: /^Rules$/ }).click();
    await flowButton.click();
    const scroll = page.getByTestId("saved-flow-scroll");
    await expect(scroll).toBeVisible();
    const bounds = await scroll.evaluate(el => {
      const dialog = el.closest('[role="dialog"]')!.getBoundingClientRect();
      const chart = el.querySelector(".indexus-flowchart")!.getBoundingClientRect();
      return { scrollable: el.scrollHeight > el.clientHeight, left: chart.left - dialog.left, right: dialog.right - chart.right };
    });
    expect(bounds.scrollable).toBe(true);
    expect(bounds.left).toBeGreaterThanOrEqual(12);
    expect(bounds.right).toBeGreaterThanOrEqual(12);
    await expect(scroll.getByText(/09:48|9:48/)).toBeVisible();
    const button = scroll.locator(".indexus-flowchart__message-trigger").first();
    await button.click();
    const preview = page.locator("[data-flow-message-preview]");
    await expect(preview).toBeVisible();
    await expect(preview.locator("iframe")).toHaveAttribute("sandbox", "");
    const frame = preview.frameLocator("iframe");
    await expect(frame.getByRole("heading", { name: "Actual authored message" })).toBeVisible();
    await expect(frame.getByText("{{communication.subject}}", { exact: true })).toBeVisible();
    expect(await preview.locator("iframe").getAttribute("srcdoc")).not.toContain("<script");
    await page.keyboard.press("Escape");
    await expect(preview).toHaveCount(0);
    await expect(scroll).toBeVisible();
    await expect(button).toBeFocused();
    await scroll.evaluate(el => el.scrollTop = 0);
    await scroll.locator(".automation-flow-viewer__maximize").click();
    const fullscreen = page.locator(".automation-flow-viewer__dialog");
    await expect(fullscreen).toBeVisible();
    await fullscreen.locator(".indexus-flowchart__message-trigger").first().click();
    await expect(preview).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(preview).toHaveCount(0);
    await expect(fullscreen).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(fullscreen).toHaveCount(0);
    await expect(scroll).toBeVisible();
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  });
}

test("forwarding editor and optional NO routing persist their explicit configuration without sending", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1200, height: 900 });
  let saved: any;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const editable: any = { ...rule, actions: [{ type: "forward_message", config: {
    forwardActionVersion: 1, destination: "back_office", mode: "whole", selection: "invoice", taskGroupId: "bo-test",
  } }] };
  await page.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path === "/api/auth/heartbeat") return route.fulfill({ json: { ok: true } });
    if (request.method() === "PATCH" && path === "/api/automation/rules/flow-source") {
      saved = request.postDataJSON();
      return route.fulfill({ json: { ...editable, ...saved } });
    }
    if (request.method() !== "GET") return route.fulfill({ status: 405, json: { error: "No real writes or sends" } });
    const body = path === "/api/auth/me" ? { user } : path === "/api/automation/rules" ? [{ ...editable, ...saved }, target]
      : path === "/api/automation/catalog" ? catalog : path === "/api/automation/users" ? [user]
        : path === "/api/task-groups" ? [{ id: "bo-test", name: "Test Back Office", isBackOffice: true }]
          : path.includes("permissions") ? {} : [];
    await route.fulfill({ json: body });
  });
  await page.goto("/automations", { waitUntil: "domcontentloaded" });
  const edit = page.getByTestId("button-edit-flow-source");
  if (!await edit.isVisible()) await page.getByRole("tab", { name: /^Rules$/ }).click();
  await edit.click();
  await page.getByTestId("automation-then-step").locator('button[aria-controls="automation-step-then-body"]').click();
  const forward = page.getByTestId("forward-message-editor");
  await expect(forward).toBeVisible();
  await forward.getByRole("combobox").first().click();
  await page.getByRole("option", { name: /^(Email recipient|E-mailový príjemca)$/ }).click();
  await forward.getByRole("textbox").fill("review@example.invalid");
  await expect(page.getByTestId("automation-no-match")).toBeVisible();
  await page.getByTestId("button-save-rule").click();
  await expect.poll(() => saved?.actions?.[0]?.config?.to).toBe("review@example.invalid");
  expect(saved.actions[0].type).toBe("forward_message");
  expect(saved.actions[0].config.destination).toBe("email");
  expect(saved.actions[0].config.mode).toBe("whole");
  expect(saved.actions[0].config.taskGroupId).toBeUndefined();
  expect(saved.trigger.noMatchRuleId).toBe("flow-target");
  expect(errors).toEqual([]);
});

for (const width of [1200, 390]) {
  test(`literal search settings save and reopen with native multiline input at ${width}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 900 });
    let saved: any;
    const errors: string[] = [];
    const writes: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const editable = { ...rule, conditions: { field: "analysis.textMatched", op: "eq", value: true }, actions: [] };
    await page.route("**/api/**", async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (path === "/api/auth/heartbeat") return route.fulfill({ json: { ok: true } });
      if (request.method() === "PATCH" && path === "/api/automation/rules/flow-source") {
        saved = request.postDataJSON();
        return route.fulfill({ json: { ...editable, ...saved } });
      }
      if (request.method() !== "GET") {
        writes.push(path);
        return route.fulfill({ status: 405, json: { error: "No writes or sends" } });
      }
      const body = path === "/api/auth/me" ? { user } : path === "/api/automation/rules" ? [{ ...editable, ...saved }, target]
        : path === "/api/automation/catalog" ? catalog : path === "/api/automation/users" ? [user]
          : path.includes("permissions") ? {} : [];
      await route.fulfill({ json: body });
    });
    await page.goto("/automations", { waitUntil: "domcontentloaded" });
    const edit = page.getByTestId("button-edit-flow-source");
    if (!await edit.isVisible()) await page.getByRole("tab", { name: /^Rules$/ }).click();
    await edit.click();
    await page.getByTestId("search-text-enabled").click();
    await expect(page.getByTestId("button-save-rule")).toBeDisabled();
    const terms = page.getByTestId("search-text-terms");
    await terms.fill("FAKTÚRA");
    await terms.press("End");
    await terms.press("Enter");
    await terms.pressSequentially("#");
    await expect(terms).toHaveValue("FAKTÚRA\n#");
    await page.getByTestId("search-text-case-sensitive").click();
    await page.getByTestId("search-text-match").click();
    await page.getByRole("option", { name: getTextSearchCopy("sk").every, exact: true }).click();
    await page.getByTestId("button-save-rule").click();
    await expect.poll(() => saved?.trigger?.analysis?.textSearch?.terms).toEqual(["FAKTÚRA", "#"]);
    expect(saved.trigger.analysis.textSearch).toEqual({ terms: ["FAKTÚRA", "#"], scope: "content", match: "all", caseSensitive: true });
    expect(saved.conditions).toEqual(editable.conditions);
    await edit.click();
    await expect(terms).toHaveValue("FAKTÚRA\n#");
    await expect(page.getByTestId("search-text-case-sensitive")).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("search-text-enabled").click();
    await page.getByTestId("button-save-rule").click();
    await expect.poll(() => saved?.trigger?.analysis?.textSearch).toBeUndefined();
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  });
}
