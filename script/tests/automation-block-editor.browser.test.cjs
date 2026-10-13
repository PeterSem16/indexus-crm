const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const fs = require("node:fs");

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(fs.existsSync("/repl/tools/bin/chromium") ? { executablePath: "/repl/tools/bin/chromium" } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
    const errors = [];
    page.on("pageerror", error => { errors.push(error.message); console.error("Browser runtime:", error.message); });
    await page.addInitScript(() => {
      window.__vite_plugin_react_preamble_installed__ = true;
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => type => type;
      localStorage.setItem("indexus_locale", "sk");
    });
    await page.route("**/api/**", route => {
      // Browser fixtures only. Real application auth and endpoints are unchanged.
      assert.equal(route.request().method(), "GET", "No writes/sends during UI verification");
      const path = new URL(route.request().url()).pathname;
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(
        path === "/api/auth/me" ? { user: { id: "test-owner", role: "admin", fullName: "Test", assignedCountries: ["SK"] } } : [],
      ) });
    });
    await page.route(url => url.pathname === "/" && url.searchParams.has("automation-ui-test"), route =>
      route.fulfill({ contentType: "text/html", body: '<!doctype html><html><head></head><body><div id="test-root"></div></body></html>' }));
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/?automation-ui-test=1`);
    await page.evaluate(async () => {
      // Use Vite's exact optimized URL, including its version. A bare URL creates
      // a second QueryClient context instead of the one used by the real hooks.
      const querySource = await (await fetch("/src/lib/queryClient.ts")).text();
      const queryUrl = querySource.match(/"([^"]*@tanstack_react-query\.js[^"]*)"/)[1];
      const [{ default: React }, { default: ReactDOM }, ReactQuery, { queryClient },
        { RuleEditor }, { AuthProvider }, { I18nProvider }] = await Promise.all([
        import("/@fs/home/runner/workspace/node_modules/.vite/deps/react.js"), import("/@fs/home/runner/workspace/node_modules/.vite/deps/react-dom_client.js"),
        import(queryUrl), import("/src/lib/queryClient.ts"),
        import("/src/pages/automations.tsx"), import("/src/contexts/auth-context.tsx"), import("/src/i18n/index.ts"),
      ]);
      await import("/src/index.css");
      const field = { value: "newValues.status", label: "Status", type: "string" };
      const catalog = {
        modules: [{ value: "task", label: "Task" }],
        eventTypes: [{ value: "status_changed", label: "Status changed", availableIn: ["task"], changeSnapshot: true }],
        actionTypes: [{ value: "notify_user", label: "Notify user", availableIn: ["task"], configSchema: {} },
          { value: "create_task", label: "Create task", availableIn: ["task"], configSchema: {} }],
        operators: [{ value: "eq", label: "Equals", arity: 1, availableIn: ["task"] }],
        fields: { task: [field] }, fieldsByEvent: { task: { status_changed: [field] } },
        recipients: [], recipientTemplatesByEvent: { task: { status_changed: ["newValues.assignedUserId"] } },
        countries: [{ value: "SK", label: "Slovensko" }, { value: "CZ", label: "Česko" }],
      };
      const rule = { id: "ui-only-rule", name: "Overenie blokového editora", description: "", module: "task",
        enabled: false, countryCode: null, countryCodes: ["SK"], isSystem: false, createdByUserId: "test-owner",
        trigger: { type: "event", entityType: "task", eventType: "status_changed" },
        conditions: { all: [{ field: "newValues.status", op: "eq", value: "open" }] },
        actions: [{ type: "notify_user", config: { userId: "test-owner", title: "Test", message: "Test" } }],
        rateLimitPerHour: 120, updatedAt: new Date().toISOString() };
      const props = { open: true, rule, rules: [rule], catalog,
        users: [{ id: "test-owner", fullName: "Test", email: "test@example.test" }],
        taskGroups: [], roles: [], departments: [], saving: false, onClose: () => {},
        onSave: draft => { window.savedAutomationDraft = draft; } };
      const root = ReactDOM.createRoot(document.getElementById("test-root"));
      window.renderAutomationFixture = (overrides = {}, nextCatalog = catalog, nextRules) => {
        const nextRule = { ...rule, ...overrides };
        const element = React.createElement(RuleEditor, { ...props, key: nextRule.id, rule: nextRule, catalog: nextCatalog, rules: nextRules || [nextRule] });
        root.render(React.createElement(ReactQuery.QueryClientProvider, { client: queryClient },
          React.createElement(I18nProvider, { userCountries: ["SK"] }, React.createElement(AuthProvider, null, element))));
      };
      window.renderAutomationFixture();
    });
    await page.getByTestId("automation-workspace").waitFor();
    await page.screenshot({ path: "/tmp/automation-compact-overview.png" });
    assert.equal(await page.locator(".automation-block-modal").count(), 0);
    await page.getByTestId("automation-if-step").locator(".automation-step-toggle").click();
    assert.equal(await page.locator(".automation-block-modal").count(), 1);
    const apply = page.locator(".automation-block-modal").getByRole("button", { name: /Použiť zmeny|Apply changes/ });
    await page.setViewportSize({ width: 1180, height: 620 });
    const bounds = await apply.boundingBox();
    assert(bounds.y >= 0 && bounds.y + bounds.height <= 620, "Apply remains visible on short desktop");
    await page.keyboard.press("Escape");
    await page.locator(".automation-block-modal").waitFor({ state: "detached" });
    assert.equal(await page.locator(".automation-block-modal").count(), 0);
    await page.getByTestId("button-add-action").click();
    await page.locator(".automation-block-modal").getByRole("button", { name: /Duplikovať|Duplicate/, exact: true }).click();
    assert.equal(await page.locator(".automation-compact-action").count(), 2);
    await page.keyboard.press("Escape");
    await page.locator(".automation-block-modal").waitFor({ state: "detached" });
    await page.getByTestId("button-add-action").click();
    assert.equal(await page.locator(".automation-compact-action").count(), 1, "Cancel discards block edits");
    await page.locator(".automation-block-modal").getByRole("button", { name: /Duplikovať|Duplicate/, exact: true }).click();
    await page.locator(".automation-block-modal").getByRole("button", { name: /Použiť zmeny|Apply changes/ }).click();
    await page.getByTestId("button-save-rule").click();
    const saved = await page.evaluate(() => window.savedAutomationDraft);
    assert.equal(saved.actions.length, 2);
    assert.equal(saved.conditions.all[0].value, "open");
    assert.equal(saved.rateLimitPerHour, 120);
    await page.getByTestId("button-edit-else").click();
    await page.locator('.automation-else-modes input[type="radio"]').nth(1).check();
    await page.locator(".automation-block-modal").getByRole("button", { name: /Pridať akciu|Add action/, exact: true }).click();
    await page.locator(".automation-action-catalog button").first().click();
    await page.locator(".automation-action-focus-toolbar").getByRole("button", { name: /Zrušiť|Cancel/, exact: true }).click();
    assert.equal(await page.locator(".automation-compact-action").count(), 0, "Cancel a new action removes it");
    await page.keyboard.press("Escape");
    await page.locator(".automation-block-modal").waitFor({ state: "detached" });
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.evaluate(() => window.renderAutomationFixture({
      id: "ui-else-rule",
      trigger: { type: "event", entityType: "task", eventType: "status_changed",
        noMatchActions: [{ type: "notify_user", config: { userId: "test-owner", title: "ELSE", message: "ELSE test" } }] },
    }));
    await page.getByTestId("button-edit-else").click();
    await page.locator(".automation-block-modal").getByRole("button", { name: /Duplikovať|Duplicate/, exact: true }).click();
    await page.screenshot({ path: "/tmp/automation-else-modal.png" });
    await page.locator(".automation-block-modal").getByRole("button", { name: /Použiť zmeny|Apply changes/ }).click();
    await page.getByTestId("button-save-rule").click();
    assert.equal(await page.evaluate(() => window.savedAutomationDraft.trigger.noMatchActions.length), 2);
    await page.evaluate(() => {
      const analysis = { channels: ["email"], analyzeContent: true, analyzeAttachments: false, mailboxUserIds: ["test-owner"] };
      const trigger = { type: "event", entityType: "communication", eventType: "communication.received", analysis };
      const field = { value: "analysis.hasInvoice", label: "Invoice", type: "boolean" };
      const catalog = { modules: [{ value: "communication", label: "Communication" }],
        eventTypes: [{ value: "communication.received", label: "Received", availableIn: ["communication"], changeSnapshot: false }],
        actionTypes: [{ value: "notify_user", label: "Notify", availableIn: ["communication"], configSchema: {} }],
        operators: [{ value: "eq", label: "Equals", arity: 1, availableIn: ["communication"] }],
        fields: { communication: [field] }, fieldsByEvent: { communication: { "communication.received": [field] } },
        recipients: [], recipientTemplatesByEvent: { communication: { "communication.received": [] } },
        countries: [{ value: "SK", label: "Slovensko" }] };
      window.renderAutomationFixture({ id: "ui-link-rule", module: "communication", trigger,
        conditions: { all: [{ field: field.value, op: "eq", value: true }] } }, catalog,
        [{ id: "ui-link-target", name: "Test cieľ", module: "communication", createdByUserId: "test-owner", trigger }]);
    });
    await page.getByTestId("button-edit-else").click();
    await page.locator('.automation-else-modes input[type="radio"]').nth(2).check();
    assert.equal(await page.locator(".automation-block-modal").getByRole("button", { name: /Použiť zmeny|Apply changes/ }).isDisabled(), true,
      "A link must be explicitly selected, not silently default to the first rule");
    await page.locator(".automation-block-modal").getByRole("button", { name: "Test cieľ", exact: true }).click();
    await page.locator(".automation-block-modal").getByRole("button", { name: /Použiť zmeny|Apply changes/ }).click();
    await page.getByTestId("button-save-rule").click();
    assert.equal(await page.evaluate(() => window.savedAutomationDraft.trigger.noMatchRuleId), "ui-link-target");
    await page.setViewportSize({ width: 402, height: 874 });
    await page.getByTestId("automation-if-step").locator(".automation-step-toggle").click();
    const phoneBounds = await page.locator(".automation-block-modal").boundingBox();
    assert(phoneBounds.x >= 0 && phoneBounds.x + phoneBounds.width <= 402);
    await page.screenshot({ path: "/tmp/automation-mobile-modal.png" });
    await page.keyboard.press("Escape");
    await page.locator(".automation-block-modal").waitFor({ state: "detached" });
    assert.deepEqual(errors, []);
    console.log("Actual RuleEditor: focused dialogs, short-window/mobile bounds, Escape, block Apply/Cancel, duplication, new-action Cancel, saved ELSE actions, explicit linked-rule selection and saved payload preservation passed.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
