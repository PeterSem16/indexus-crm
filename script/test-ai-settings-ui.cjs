/* Real component + native browser fetch against an isolated synthetic API.
 * Never bypasses authentication in the app and never calls a real AI provider.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { build } = require("esbuild");
const { chromium } = require("playwright");

(async () => {
  const out = path.resolve("generated-artifacts/ai-settings-ui");
  fs.mkdirSync(out, { recursive: true });
  await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React from "react";
    import { createRoot } from "react-dom/client";
    import { QueryClientProvider } from "@tanstack/react-query";
    import { queryClient } from "./client/src/lib/queryClient";
    import { I18nProvider } from "./client/src/i18n";
    import { AISettingsTab } from "./client/src/components/configurator/AISettingsTab";
    window.__aiQueries = queryClient;
    createRoot(document.getElementById("root")).render(
      <I18nProvider><QueryClientProvider client={queryClient}><AISettingsTab /></QueryClientProvider></I18nProvider>);
  ` }, outfile: path.join(out, "ui.js"), bundle: true, platform: "browser", format: "iife",
    tsconfig: "tsconfig.json", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent" });
  const builtAssets = path.resolve("dist/public/assets");
  const cssPath = process.argv[2] || (fs.existsSync(builtAssets) && fs.readdirSync(builtAssets)
    .filter(file => file.endsWith(".css")).map(file => path.join(builtAssets, file))
    .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0]);
  if (!cssPath) throw new Error("Build first, or pass the validated build CSS path as the first argument.");
  const css = fs.readFileSync(cssPath);
  const statuses = [];
  let posts = 0, puts = 0, gets = 0;
  let maintenancePuts = 0, failMaintenanceRead = false, loseMaintenanceWrite = false;
  const maintenanceCommands = [];
  let maintenance = {
    mode: "running", version: 0, operationId: null, ownedByMe: false, changedAt: new Date().toISOString(),
    workers: { alive: 1, confirmed: 1, unsupported: 0 },
    queues: { jobs: { pending: 2, processing: 0 }, inference: { pending: 3, processing: 0 } },
    gatewayDrain: "unverified", backendDrain: "unverified", audit: [],
  };
  let view = {
    version: 1, gateway: { enabled: true, baseURL: "https://ai.cordbloodcenter.com/gateway/",
      timeoutMs: 30000, maxRetries: 0, temperature: null, maxTokens: null },
    services: ["email.summary", "email.reply", "email.monitoring"].map(id => ({ id, operation: "chat", internalEligible: true,
      route: { provider: "openai", model: null, enabled: true } })),
    runtime: { production: true, replit: false, serverAllowed: true, tokenConfigured: true, openaiConfigured: true, mode: "routed" },
    gatewayCheck: null, openaiCheck: null, audit: [], queue: { ready: true, counts: {} },
  };
  const server = http.createServer(async (req, res) => {
    if (req.url === "/ui.js") { res.setHeader("Content-Type", "application/javascript"); return res.end(fs.readFileSync(path.join(out, "ui.js"))); }
    if (req.url === "/style.css") { res.setHeader("Content-Type", "text/css"); return res.end(css); }
    if (req.url === "/api/configurator/ai/maintenance") {
      res.setHeader("Content-Type", "application/json");
      if (req.method === "GET") {
        if (failMaintenanceRead) { res.statusCode = 503; return res.end(JSON.stringify({ error: "maintenance_unavailable", code: "maintenance_unavailable" })); }
        return res.end(JSON.stringify(maintenance));
      }
      maintenancePuts++;
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks));
      maintenanceCommands.push(body);
      if (body.confirm !== true || body.expectedVersion !== maintenance.version ||
        body.operationId !== maintenance.operationId) {
        res.statusCode = 409;
        return res.end(JSON.stringify({ error: "maintenance_conflict", code: "maintenance_conflict" }));
      }
      maintenance = { ...maintenance, mode: body.action === "resume" ? "running" : "paused",
        ownedByMe: body.action !== "resume", operationId: body.action === "resume" ? null :
          maintenance.operationId || "00000000-0000-4000-8000-000000000001",
        version: maintenance.version + 1, changedAt: new Date().toISOString(),
        audit: [{ id: String(maintenance.version + 1), action: body.action,
          version: maintenance.version + 1, at: new Date().toISOString() }, ...maintenance.audit] };
      if (loseMaintenanceWrite) { res.statusCode = 503; return res.end(JSON.stringify({ error: "maintenance_unavailable", code: "maintenance_unavailable" })); }
      return res.end(JSON.stringify(maintenance));
    }
    if (req.url.startsWith("/api/configurator/ai")) {
      res.setHeader("Content-Type", "application/json");
      if (req.method === "GET") gets++;
      else {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks));
        if (body.expectedVersion !== view.version) { res.statusCode = 409; return res.end(JSON.stringify({ code: "version_conflict", error: "version_conflict" })); }
        if (req.method === "POST") {
          posts++;
          const result = { state: "ready", kind: body.kind, settingsVersion: view.version, checkedAt: new Date().toISOString(),
            durationMs: 5, textVerified: body.kind !== "connectivity", jsonVerified: body.kind === "smoke",
            models: [{ id: "indexus-ai-solaris:v1", revision: "ui-unit", outputFormats: ["text", "json_object"],
              maxInputTokens: 4096, maxOutputTokens: 4096 },
              { id: "indexus-email-monitoring:v1", revision: "ui-unit", outputFormats: ["json_object"],
                maxInputTokens: 8192, maxOutputTokens: 200 }] };
          view[body.kind === "openai" ? "openaiCheck" : "gatewayCheck"] = result;
        } else {
          puts++; view.version++;
          if (req.url.endsWith("/route")) view.services = view.services.map(service => service.id === body.service ?
            { ...service, route: body.route } : service);
          if (req.url.endsWith("/gateway")) { view.gateway = body.gateway; view.gatewayCheck = null; }
          if (view.gatewayCheck) view.gatewayCheck.settingsVersion = view.version;
        }
      }
      return res.end(JSON.stringify(view));
    }
    res.setHeader("Content-Type", "text/html");
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root" style="padding:16px"></div><script src="/ui.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"],
    ...(fs.existsSync("/repl/tools/bin/chromium") ? { executablePath: "/repl/tools/bin/chromium" } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    const errors = []; page.on("pageerror", error => { errors.push(error.message); console.error("UI fixture:", error.message); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const row = page.locator("article").filter({ has: page.getByText("email.summary", { exact: true }) });
    await row.waitFor();
    assert(await page.evaluate(() => getComputedStyle(document.documentElement)
      .getPropertyValue("--background").trim().length > 0), "production theme CSS must be loaded");
    assert.equal(posts, 0, "mount must never run AI tests");
    assert.equal(puts, 0);
    const control = page.getByTestId("ai-maintenance-control");
    const pauseButton = control.getByRole("button", { name: "Pause queue claims", exact: true });
    const refreshMaintenance = async () => {
      await page.evaluate(() => window.__aiQueries.invalidateQueries({ queryKey: ["/api/configurator/ai/maintenance"] }));
    };
    await pauseButton.waitFor();
    assert.equal(maintenancePuts, 0, "mount never pauses or resumes");
    await pauseButton.click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(maintenancePuts, 0, "cancelling is not a maintenance write");
    // Keep a confirmation open across a competing operator change.
    await pauseButton.click();
    maintenance.version++;
    await refreshMaintenance();
    await page.getByRole("dialog").getByRole("button", { name: "Pause queue claims", exact: true }).click();
    await control.getByRole("alert").filter({ hasText: /changed|refresh|latest/i }).first().waitFor();
    assert.equal(maintenanceCommands[0].expectedVersion, 0, "confirmation must not silently refresh its version");
    assert.equal(maintenance.mode, "running");
    // Uncertain write committed server-side: fresh GET, no automatic second PUT.
    loseMaintenanceWrite = true;
    await pauseButton.click();
    await page.getByRole("dialog").getByRole("button", { name: "Pause queue claims", exact: true }).click();
    await control.getByRole("button", { name: "Resume queue claims", exact: true }).waitFor();
    assert.equal(maintenancePuts, 2);
    assert.equal(maintenance.mode, "paused");
    loseMaintenanceWrite = false;
    assert.equal(await control.getByText("Unverified", { exact: true }).count(), 2,
      "even zero active queues never prove remote completion");
    maintenance.ownedByMe = false;
    await refreshMaintenance();
    assert.equal(await control.getByRole("button", { name: "Resume queue claims", exact: true }).count(), 0);
    await control.getByRole("button", { name: "Take over control", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Take over control", exact: true }).click();
    await control.getByRole("button", { name: "Resume queue claims", exact: true }).waitFor();
    assert.equal(maintenance.mode, "paused", "takeover must never resume");
    await control.getByRole("button", { name: "Resume queue claims", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Resume queue claims", exact: true }).click();
    await pauseButton.waitFor();
    maintenance.workers.unsupported = 1;
    await refreshMaintenance();
    assert.equal(await pauseButton.isDisabled(), true);
    maintenance.workers.unsupported = 0;
    failMaintenanceRead = true;
    await refreshMaintenance();
    await control.getByRole("alert").first().waitFor();
    assert.equal(await pauseButton.isDisabled(), true, "failed polling must disable writes");
    failMaintenanceRead = false;
    await refreshMaintenance();
    await page.waitForFunction(() => ![...document.querySelectorAll('[data-testid="ai-maintenance-control"] button')]
      .find(button => button.textContent.includes("Pause queue claims"))?.disabled);
    assert.equal(maintenancePuts, 4, "no automatic write or replay on refresh/error");
    await page.getByRole("button", { name: "Test connectivity", exact: true }).click();
    await page.getByText("Connected", { exact: true }).waitFor();
    assert.equal(posts, 1);
    await row.getByLabel("Provider", { exact: true }).selectOption("internal");
    assert.equal(await row.getByRole("button", { name: "Save route", exact: true }).isDisabled(), true);
    await page.getByRole("button", { name: "Run text + JSON smoke test", exact: true }).click();
    await row.getByRole("button", { name: "Save route", exact: true }).waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll("article button")].some(button => !button.disabled && button.textContent === "Save route"));
    await row.getByRole("button", { name: "Save route", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    assert.equal(puts, 0, "opening confirmation must not save a route");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("dialog").count(), 0);
    await row.getByRole("button", { name: "Save route", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm and save route", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    assert.equal(puts, 1);
    assert.equal(view.services[0].route.provider, "internal");
    assert.match(await row.getByTestId("execution-email.summary").innerText(), /Asynchronous/);
    assert.match(await page.getByTestId("ai-worker-status").innerText(), /AI worker ready/);
    const emailRow = page.locator("article").filter({ has: page.getByText("email.monitoring", { exact: true }) });
    await emailRow.getByLabel("Provider", { exact: true }).selectOption("internal");
    assert.equal(await emailRow.getByLabel("Model", { exact: true }).inputValue(), "indexus-email-monitoring:v1");
    assert.equal(await emailRow.getByRole("button", { name: "Save route", exact: true }).isEnabled(), true);
    assert.deepEqual(await row.getByLabel("Model", { exact: true }).locator("option").evaluateAll(
      options => options.map(option => option.value)), ["indexus-ai-solaris:v1"]);
    assert.equal(puts, 1, "selecting the email model must not activate a service");
    await row.getByLabel("Provider", { exact: true }).selectOption("openai");
    assert.equal(await row.getByLabel("Model", { exact: true }).inputValue(), "");
    await row.getByLabel("Model", { exact: true }).fill("gpt-4o-mini");
    await page.evaluate(() => window.__aiQueries.invalidateQueries({ queryKey: ["/api/configurator/ai"] }));
    assert.equal(await row.getByLabel("Model", { exact: true }).inputValue(), "gpt-4o-mini", "GET refresh must preserve unsaved edits");
    view.queue.ready = false;
    await page.reload();
    await page.getByText("AI worker is offline", { exact: true }).waitFor();
    assert.equal(await row.getByRole("button", { name: "Save route", exact: true }).isDisabled(), true);
    await row.getByLabel("Provider", { exact: true }).selectOption("openai");
    assert.equal(await row.getByRole("button", { name: "Save route", exact: true }).isEnabled(), true);
    assert.match(await row.getByTestId("execution-email.summary").innerText(), /Direct provider request/);
    view.queue.ready = true;
    await page.screenshot({ path: path.join(out, "desktop.jpg"), fullPage: true });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.screenshot({ path: path.join(out, "dark.jpg"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(out, "mobile.jpg"), fullPage: true });
    statuses.push("native fetch", "maintenance confirmation/cancel", "frozen maintenance version",
      "uncertain write reconciliation without replay", "separate takeover and resume",
      "unsupported worker and failed polling guards", "honest remote drain state",
      "no automatic tests", "discovery not inference", "text/JSON activation gate",
      "asynchronous route labels", "worker-offline activation guard", "OpenAI remains selectable offline",
      "email model selection without activation", "email-only model option",
      "Escape/confirmation", "provider reset", "dirty edit retention", "390px bounds", "dark render");
    assert.deepEqual(errors, []);
    assert.equal(posts, 2);
    assert(gets >= 2);
    console.log("AI settings browser checks PASSED: " + statuses.join(", "));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(path.join(out, "ui.js"), { force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
