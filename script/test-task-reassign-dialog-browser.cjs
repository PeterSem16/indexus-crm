const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { build } = require("esbuild");
const postcss = require("postcss");
const tailwind = require("tailwindcss");
const autoprefixer = require("autoprefixer");
const { chromium, expect } = require("@playwright/test");

// Standalone real-component fixture: no application routes, auth changes, or
// fetch replacements. Only the task-scoped targets GET is intercepted.
const ROOT = process.cwd();
const screenshots = path.join(ROOT, ".local/screenshots");
const harness = `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/i18n/I18nProvider";
import { translations } from "@/i18n/translations";
import { TaskReassignDialog } from "@/components/tasks/task-reassign-dialog";
import "@/index.css";

const client = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
const countries = ["US"];
function Fixture() {
  const [task, setTask] = useState(window.__reassign.task);
  const [open, setOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  Object.assign(window.__reassign, {
    setTask, close: () => setOpen(false), reopen: () => setOpen(true),
    setSubmitting,
    cacheKeys: () => client.getQueryCache().getAll().map(query => query.queryKey),
    copy: translations.en.tasks.reassignDialog,
  });
  return <I18nProvider userCountries={countries}>
    <QueryClientProvider client={client}>
      <TaskReassignDialog open={open} taskId={task.id} taskTitle={task.title}
        assignedUserId={task.assignedUserId} taskGroupId={task.taskGroupId}
        submitting={submitting} onOpenChange={setOpen}
        onConfirm={(taskId, payload) => {
          // This is the contract passed to the parent's reassign POST mutation.
          window.__reassign.calls.push({ taskId, method: "POST", payload });
          return new Promise(resolve => { window.__reassign.settle = resolve; });
        }} />
    </QueryClientProvider>
  </I18nProvider>;
}
createRoot(document.getElementById("root")).render(<Fixture />);
`;

const taskA = {
  id: "task-a", title: "Follow up with the customer and confirm the updated delivery address",
  assignedUserId: "current-user", taskGroupId: "current-group",
};
const targetsA = {
  users: [
    { id: "current-user", fullName: "Current assignee", email: "current@example.test" },
    { id: "jose", fullName: "José Šimko", username: "jsimko", email: "Jose.Simko@example.test" },
    { id: "eva", fullName: "Eva Nováková", username: "enovak", email: "eva.support@example.test" },
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `agent-${i}`, fullName: `Browser fixture agent ${i}`, email: `agent${i}@example.test`,
    })),
  ],
  groups: [
    { id: "current-group", name: "Current group", memberCount: 2 },
    { id: "support", name: "Zákaznícka podpora", description: "Priority support team", memberCount: 8 },
    { id: "billing", name: "Billing", description: "Invoices and payments", memberCount: 4 },
  ],
};
const taskB = { ...taskA, id: "task-b", title: "A different task with a different permitted target scope" };
const targetsB = {
  users: [{ id: "b-only", fullName: "Only task B user", email: "b@example.test" }],
  groups: [{ id: "b-group", name: "Only task B group", memberCount: 1 }],
};
const byId = (page, id) => page.getByTestId(`reassign-${id}`);
const radio = (page, id) => byId(page, id).locator('input[type="radio"]');

async function compile() {
  const component = path.join(ROOT, "client/src/components/tasks/task-reassign-dialog.tsx");
  for (let i = 0; !fs.existsSync(component) && i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(fs.existsSync(component), "The concurrent dialog component is not ready.");
  const result = await build({
    stdin: { contents: harness, resolveDir: ROOT, sourcefile: "reassign-browser-fixture.tsx", loader: "tsx" },
    bundle: true, write: false, outfile: "/tmp/reassign-browser-fixture.js",
    platform: "browser", format: "iife", jsx: "automatic", target: ["es2020"],
    alias: { "@": path.join(ROOT, "client/src") },
  });
  const rawCSS = result.outputFiles.find(file => file.path.endsWith(".css"));
  assert.ok(rawCSS, "The actual shared/component CSS must be bundled.");
  const css = await postcss([
    tailwind({ config: path.join(ROOT, "tailwind.config.ts") }), autoprefixer(),
  ]).process(rawCSS.text, { from: path.join(ROOT, "client/src/index.css") });
  return { js: result.outputFiles.find(file => file.path.endsWith(".js")).text, css: css.css };
}

async function main() {
  const compiled = await compile();
  const server = http.createServer((req, res) => {
    if (req.url === "/fixture.js" || req.url === "/fixture.css") {
      const js = req.url.endsWith(".js");
      res.writeHead(200, { "Content-Type": js ? "text/javascript" : "text/css" });
      return res.end(js ? compiled.js : compiled.css);
    }
    if (req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end('<!doctype html><html><head><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
    }
    res.writeHead(404);
    res.end("Unexpected fixture request");
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const failures = [];
  const allPageErrors = [];
  const cases = [];
  try {
    browser = await chromium.launch({
      headless: true, executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
      args: ["--no-sandbox"],
    });
    async function fixture(options = {}) {
      const page = await browser.newPage({ viewport: options.viewport || { width: 900, height: 700 } });
      const errors = [];
      page.on("pageerror", error => { errors.push(error.message); allPageErrors.push(error.message); });
      const requests = [];
      const pending = [];
      const responses = [...(options.responses || [])];
      await page.route("**/api/tasks/*/reassign-targets", async route => {
        const request = route.request();
        assert.equal(request.method(), "GET", "Only the task-scoped targets GET may be mocked.");
        const id = decodeURIComponent(new URL(request.url()).pathname.split("/")[3]);
        requests.push(id);
        let response = responses.shift();
        if (response?.defer) response = await new Promise(resolve => pending.push(resolve));
        await route.fulfill({
          status: response?.status || 200, contentType: "application/json",
          body: JSON.stringify(response?.body ?? (id === taskB.id ? targetsB : targetsA)),
        });
      });
      await page.addInitScript(task => {
        window.__reassign = { task, calls: [] };
      }, options.task || taskA);
      await page.goto(origin);
      await page.getByTestId("dialog-reassign-task").waitFor();
      return { page, requests, pending, errors };
    }
    async function ready(page) {
      await byId(page, "user-jose").waitFor();
      await expect(byId(page, "loading")).toHaveCount(0);
    }
    async function test(name, run) {
      try { await run(); cases.push(name); console.log(`PASS ${name}`); }
      catch (error) { failures.push(new Error(`${name}: ${error.stack || error}`)); console.error(`FAIL ${name}: ${error.message}`); }
    }
    await test("user case/diacritics/email/username search, exclusion, no results and clear", async () => {
      const { page } = await fixture();
      await ready(page);
      await expect(byId(page, "user-current-user")).toHaveCount(0);
      await expect(byId(page, "confirm")).toBeDisabled();
      for (const query of ["JOSE SIMKO", "šimko", "JOSE.SIMKO@EXAMPLE.TEST", "jsimko"]) {
        await byId(page, "search").fill(query);
        await expect(byId(page, "user-jose")).toBeVisible();
        await expect(page.locator(".task-reassign-target")).toHaveCount(1);
      }
      await byId(page, "search").fill("not-a-real-recipient");
      await expect(byId(page, "no-results")).toBeVisible();
      assert.equal(await byId(page, "no-results").locator("p").innerText(),
        await page.evaluate(() => window.__reassign.copy.noResults));
      assert.equal(await byId(page, "no-results").getByRole("button").innerText(),
        await page.evaluate(() => window.__reassign.copy.clearSearch));
      await byId(page, "clear-search").click();
      await expect(byId(page, "search")).toHaveValue("");
      await expect(byId(page, "search")).toBeFocused();
      await page.close();
    });
    await test("exclusive user/group choice, group search and exact POST callback payload", async () => {
      const { page } = await fixture();
      await ready(page);
      await radio(page, "user-jose").check();
      await radio(page, "user-eva").check();
      await expect(radio(page, "user-jose")).not.toBeChecked();
      await expect(page.locator('input[type="radio"]:checked')).toHaveCount(1);
      await byId(page, "mode-group").click();
      await expect(byId(page, "confirm")).toBeDisabled();
       await expect(byId(page, "group-current-group")).toBeVisible();
       await expect(radio(page, "group-current-group")).toBeDisabled();
      for (const query of ["ZAKAZNICKA", "PRIORITY SUPPORT"]) {
        await byId(page, "search").fill(query);
        await expect(byId(page, "group-support")).toBeVisible();
        await expect(page.locator(".task-reassign-target")).toHaveCount(1);
      }
      await radio(page, "group-support").check();
      await expect(byId(page, "summary")).toContainText("Zákaznícka podpora");
      await byId(page, "confirm").click();
      await expect(byId(page, "confirm")).toBeDisabled();
      await expect(byId(page, "cancel")).toBeDisabled();
      await expect(byId(page, "search")).toBeDisabled();
      await expect(byId(page, "mode-user")).toBeDisabled();
      assert.deepEqual(await page.evaluate(() => window.__reassign.calls), [
        { taskId: taskA.id, method: "POST", payload: { newTaskGroupId: "support" } },
      ]);
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("dialog-reassign-task")).toBeVisible();
      await page.evaluate(() => window.__reassign.settle(true));
      await expect(page.getByTestId("dialog-reassign-task")).toBeHidden();
      await page.close();
    });
    await test("keyboard radio selection, user callback payload and failed save", async () => {
      const { page } = await fixture();
      await ready(page);
      await radio(page, "user-jose").focus();
      await page.keyboard.press("Space");
      await expect(radio(page, "user-jose")).toBeChecked();
      await page.keyboard.press("ArrowDown");
      await expect(radio(page, "user-eva")).toBeChecked();
      await expect(page.locator('input[type="radio"]:checked')).toHaveCount(1);
      await byId(page, "confirm").click();
      assert.deepEqual(await page.evaluate(() => window.__reassign.calls), [
        { taskId: taskA.id, method: "POST", payload: { newAssignedUserId: "eva" } },
      ]);
      await page.evaluate(() => window.__reassign.settle(false));
      await expect(byId(page, "save-error")).toBeVisible();
      await expect(byId(page, "confirm")).toBeEnabled();
      await page.close();
    });
    await test("deferred loading disables confirm and real query HTTP failure retries", async () => {
      const { page, pending, requests } = await fixture({ responses: [
        { defer: true }, { status: 503, body: { error: "Fixture target service unavailable" } },
      ] });
      await expect(byId(page, "loading")).toBeVisible();
      await expect(byId(page, "targets")).toHaveAttribute("aria-busy", "true");
      await expect(byId(page, "confirm")).toBeDisabled();
      assert.equal(pending.length, 1);
      pending.shift()({ status: 403, body: { error: "Fixture permission denied" } });
      await expect(byId(page, "load-error")).toBeVisible();
      await expect(byId(page, "confirm")).toBeDisabled();
      await byId(page, "retry").click();
      await expect(byId(page, "load-error")).toBeVisible();
      await byId(page, "retry").click();
      await ready(page);
      assert.deepEqual(requests, [taskA.id, taskA.id, taskA.id]);
      await page.close();
    });
    await test("close/reopen reset, task change and query-cache task isolation", async () => {
      const { page, requests } = await fixture();
      await ready(page);
      await byId(page, "mode-group").click();
      await radio(page, "group-support").check();
      await byId(page, "search").fill("podpora");
      await byId(page, "close").click();
      await expect(page.getByTestId("dialog-reassign-task")).toBeHidden();
      await page.evaluate(() => window.__reassign.reopen());
      await ready(page);
      await expect(byId(page, "mode-user")).toHaveAttribute("aria-pressed", "true");
      await expect(byId(page, "search")).toHaveValue("");
      await expect(page.locator('input[type="radio"]:checked')).toHaveCount(0);
      await radio(page, "user-jose").check();
      await byId(page, "search").fill("jose");
      await page.evaluate(task => window.__reassign.setTask(task), taskB);
      await expect(byId(page, "user-b-only")).toBeVisible();
      await expect(byId(page, "user-jose")).toHaveCount(0);
      await expect(byId(page, "search")).toHaveValue("");
      await expect(byId(page, "confirm")).toBeDisabled();
      await expect(byId(page, "task-title")).toHaveText(taskB.title);
      const keys = await page.evaluate(() => window.__reassign.cacheKeys());
      assert.ok(keys.some(key => JSON.stringify(key) === JSON.stringify(["/api/tasks", taskA.id, "reassign-targets"])));
      assert.ok(keys.some(key => JSON.stringify(key) === JSON.stringify(["/api/tasks", taskB.id, "reassign-targets"])));
      await byId(page, "mode-group").click();
      await expect(byId(page, "group-b-group")).toBeVisible();
      await expect(byId(page, "group-support")).toHaveCount(0);
      await page.evaluate(task => window.__reassign.setTask(task), taskA);
      await ready(page);
      await expect(byId(page, "user-b-only")).toHaveCount(0);
      assert.ok(requests.filter(id => id === taskA.id).length >= 3);
      assert.equal(requests.filter(id => id === taskB.id).length, 1);
      await page.close();
    });
    await test("empty targets and externally submitting state", async () => {
      const empty = await fixture({ responses: [{ body: { users: [], groups: [] } }] });
      await expect(byId(empty.page, "empty")).toBeVisible();
      await expect(byId(empty.page, "confirm")).toBeDisabled();
      await byId(empty.page, "mode-group").click();
      await expect(byId(empty.page, "empty")).toBeVisible();
      await empty.page.close();
      const { page } = await fixture();
      await ready(page);
      await radio(page, "user-jose").check();
      await page.evaluate(() => window.__reassign.setSubmitting(true));
      await expect(byId(page, "confirm")).toBeDisabled();
      await expect(byId(page, "close")).toBeDisabled();
      await page.evaluate(() => window.__reassign.setSubmitting(false));
      await expect(byId(page, "confirm")).toBeEnabled();
      await page.close();
    });
    await test("only current group remains visible but cannot be reassigned to itself", async () => {
      const { page } = await fixture({ responses: [{ body: {
        users: [],
        groups: [{ id: taskA.taskGroupId, name: "Current group", memberCount: 0 }],
      } }] });
      await expect(byId(page, "empty")).toBeVisible();
      await byId(page, "mode-group").click();
      await expect(byId(page, "group-current-group")).toBeVisible();
      await expect(radio(page, "group-current-group")).toBeDisabled();
      await expect(byId(page, "group-current-group")).toContainText(
        await page.evaluate(() => window.__reassign.copy.currentGroup),
      );
      await expect(byId(page, "empty")).toHaveCount(0);
      await expect(byId(page, "confirm")).toBeDisabled();
      await page.close();
    });
    for (const [name, viewport] of [
      ["desktop", { width: 900, height: 700 }], ["mobile", { width: 390, height: 700 }],
    ]) {
      await test(`${name} actual Tailwind/theme styling and visible footer bounds`, async () => {
        const { page } = await fixture({ viewport });
        await ready(page);
        await radio(page, "user-jose").check();
        const dialog = page.getByTestId("dialog-reassign-task");
        const dialogBox = await dialog.boundingBox();
        assert.ok(dialogBox.x >= 0 && dialogBox.y >= 0, "Dialog starts inside viewport");
        assert.ok(dialogBox.x + dialogBox.width <= viewport.width + 1, "Dialog fits viewport width");
        assert.ok(dialogBox.y + dialogBox.height <= viewport.height + 1, "Dialog fits viewport height");
        for (const id of ["cancel", "confirm"]) {
          const button = byId(page, id);
          const bounds = await button.boundingBox();
          assert.ok(bounds.y >= dialogBox.y && bounds.y + bounds.height <= viewport.height, `${id} footer fits viewport`);
          assert.ok(bounds.y + bounds.height <= dialogBox.y + dialogBox.height + 1, `${id} footer fits dialog`);
          assert.ok(await button.evaluate(element => {
            const b = element.getBoundingClientRect();
            return element.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
          }), `${id} footer is not clipped or covered`);
        }
        assert.equal(await dialog.evaluate(element => getComputedStyle(element).display), "flex");
        assert.notEqual(await byId(page, "confirm").evaluate(element => getComputedStyle(element).backgroundColor), "rgba(0, 0, 0, 0)");
        const list = byId(page, "targets");
        assert.ok(await list.evaluate(element => element.scrollHeight > element.clientHeight), "Long target list scrolls internally");
        await list.evaluate(element => { element.scrollTop = element.scrollHeight; });
        await expect(byId(page, "confirm")).toBeInViewport();
        await list.evaluate(element => { element.scrollTop = 0; });
        fs.mkdirSync(screenshots, { recursive: true });
        await page.screenshot({ path: path.join(screenshots, `reassign-${name}.png`), animations: "disabled" });
        await page.close();
      });
    }
    assert.deepEqual(allPageErrors, [], "All fixture browser pageerrors must be empty.");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  if (failures.length) throw new AggregateError(failures, `${failures.length} reassign browser checks failed`);
  console.log(`Task reassign browser checks passed (${cases.length} cases). Screenshots: .local/screenshots/reassign-{desktop,mobile}.png`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });