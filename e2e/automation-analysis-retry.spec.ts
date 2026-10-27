import { expect, test } from "@playwright/test";
import { automationRetryTranslations } from "../client/src/i18n/automation-retry-translations";
import { automationEligibilityTranslations } from "../client/src/i18n/automation-eligibility-translations";

// Real CRM components/providers and native fetch; synthetic API fixtures only.
// No test authentication bypass is added to the application.
for (const width of [1280, 390]) test(`confirmed single-source retry and recovery at ${width}px`, async ({ page }) => {
  const c = automationRetryTranslations.sk, d = automationEligibilityTranslations.sk;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  const user = { id: "retry-owner", username: "synthetic", fullName: "Synthetic tester",
    email: "synthetic@example.invalid", role: "admin", isActive: true, assignedCountries: ["SK"], preferredLanguage: "en" };
  const rule = { id: "retry-rule", name: "Synthetic retry rule", module: "communication", enabled: true,
    createdByUserId: user.id, createdAt: "2026-10-01T08:00:00Z", updatedAt: "2026-10-01T08:00:00Z",
    countryCodes: ["SK"], conditions: null,
    trigger: { type: "event", eventType: "communication.received",
      analysis: { channels: ["chat"], analyzeContent: false, analyzeAttachments: true } },
    actions: [{ type: "create_task", config: { title: "Synthetic task", assignedUserId: user.id } }] };
  const catalog = { modules: [{ value: "communication", label: "Communications" }],
    eventTypes: [{ value: "communication.received", label: "Analyze communication", availableIn: ["communication"] }],
    actionTypes: [{ value: "create_task", label: "Create a task", availableIn: ["communication"], configSchema: {} }],
    fields: {}, operators: [], countries: [{ value: "SK", label: "Slovakia" }], recipients: [] };
  const posts: { path: string; body: any }[] = [];
  let analysisRequests = 0, executed = false;
  await page.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path.includes("/analysis-retry") && request.method() === "POST") {
      const body = request.postDataJSON();
      posts.push({ path, body });
      if (path.endsWith("/preview")) return route.fulfill({ json: {
        token: "synthetic-preview", ruleName: rule.name, rule, actions: ["create_task"],
        runs: [{ id: "original", status: "skipped", skippedReason: "analysis_condition_unknown", startedAt: "2026-10-01T08:00:00Z" }],
        attempts: analysisRequests ? [{ id: "attempt-one", status: executed ? "done" : "ready", createdAt: "2026-10-02T08:00:00Z", canResume: true }] : [],
        effects: executed ? [{ actionIndex: 0, status: "success" }] : [], actionResults: [], existingAnalyses: [],
      } });
      if (path.endsWith("/analyze")) {
        if (++analysisRequests === 1) return route.fulfill({ status: 503, json: { error: "Synthetic interrupted response" } });
        return route.fulfill({ json: { attemptId: "attempt-one", status: "ready",
          analysis: { summary: "Synthetic recognized invoice", sentiment: "neutral", tone: "calm", hasInvoice: true,
            attachmentCount: 1, failedAttachmentCount: 0 } } });
      }
      if (path.endsWith("/execute")) {
        executed = true;
        return route.fulfill({ json: { attemptId: "attempt-one", status: "done" } });
      }
    }
    if (path.endsWith("/eligibility-sources")) return route.fulfill({ json: {
      records: [{ id: "message-one", createdAt: "2026-10-01T08:00:00Z" }, { id: "message-two", createdAt: "2026-10-02T08:00:00Z" }],
    } });
    if (path.endsWith("/eligibility")) return route.fulfill({ json: {
      reasons: ["before_activation"], countryUnknown: false, history: { status: "missing", permissions: "unknown" },
    } });
    const data = path === "/api/auth/me" ? { user } : path === "/api/automation/rules" ? [rule] :
      path === "/api/automation/catalog" ? catalog : path === "/api/automation/users" ? [user] :
      path.includes("permissions") ? {} : path.includes("count") ? { count: 0 } : [];
    return route.fulfill({ json: data });
  });
  await page.goto("/automations?tab=runs", { waitUntil: "domcontentloaded" });
  const panel = page.getByTestId("automation-eligibility").first();
  await panel.locator("summary").click();
  await panel.locator("select").nth(1).selectOption("chat.received");
  await panel.getByRole("button", { name: d.loadSources, exact: true }).click();
  await panel.locator("select").nth(3).selectOption("message-one");
  await panel.getByRole("button", { name: d.check, exact: true }).click();
  const retry = panel.getByTestId("automation-analysis-retry");
  await expect(retry).toBeVisible();
  expect(posts).toHaveLength(0);
  await retry.getByRole("button", { name: c.preview, exact: true }).click();
  await expect(retry.getByText(rule.name, { exact: true }).first()).toBeVisible();
  const analyze = retry.getByRole("button", { name: c.analyze, exact: true });
  await expect(analyze).toBeDisabled();
  await retry.getByLabel(c.confirmAnalyze).check();
  await analyze.click();
  await expect(retry.getByRole("alert")).toContainText(c.genericError);
  await analyze.click();
  await expect(retry.getByText("Synthetic recognized invoice", { exact: false })).toBeVisible();
  const analysisPosts = posts.filter(p => p.path.endsWith("/analyze"));
  expect(analysisPosts).toHaveLength(2);
  expect(analysisPosts[0].body.requestId).toBe(analysisPosts[1].body.requestId);
  expect(analysisPosts.every(p => p.body.sourceId === "message-one" && p.body.confirmed === true)).toBe(true);
  const execute = retry.getByRole("button", { name: c.execute, exact: true });
  await expect(execute).toBeDisabled();
  expect(posts.some(p => p.path.endsWith("/execute"))).toBe(false);
  await retry.getByLabel(c.confirmExecute).check();
  await execute.click();
  await expect(retry.getByText(c.doneNote)).toBeVisible();
  await expect(retry.getByLabel(c.confirmAnalyze)).not.toBeChecked();
  await expect(retry.getByRole("button", { name: c.execute, exact: true })).toHaveCount(0);
  expect(posts.filter(p => p.path.endsWith("/execute"))).toHaveLength(1);
  expect(await retry.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await panel.locator("select").nth(3).selectOption("message-two");
  await expect(retry).toHaveCount(0);
  expect(errors).toEqual([]);
});
