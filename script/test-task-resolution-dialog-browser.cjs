const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { build } = require("esbuild");
const { chromium } = require("@playwright/test");

const ROOT = process.cwd();
const CHROMIUM = process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium";
const harness = `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/i18n/I18nProvider";
import { TaskResolutionDialog } from "@/components/tasks/task-resolution-dialog";

function TestHarness() {
  const [task, setTask] = useState(window.__resolutionTest.task);
  const [resolution, setResolution] = useState(window.__resolutionTest.initialResolution || "");
  const [open, setOpen] = useState(true);
  window.__resolutionTest.setTask = nextTask => { setResolution(""); setTask(nextTask); };
  window.__resolutionTest.closeDialog = () => setOpen(false);
  window.__resolutionTest.reopenDialog = () => setOpen(true);
  window.__resolutionTest.openForTask = nextTask => {
    setResolution("");
    setTask(nextTask);
    setOpen(true);
  };
  return <I18nProvider userCountries={["US"]}>
    <QueryClientProvider client={new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    })}>
      <TaskResolutionDialog
        open={open}
        onOpenChange={setOpen}
        task={task}
        resolution={resolution}
        onResolutionChange={setResolution}
        onConfirm={() => { window.__resolutionTest.confirmed = true; }}
        saving={false}
      />
    </QueryClientProvider>
  </I18nProvider>;
}

const root = createRoot(document.getElementById("root"));
root.render(<TestHarness />);

const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  const checklistMatch = url.match(/^\\/api\\/tasks\\/([^/]+)\\/checklist$/);
  if (checklistMatch && (!init.method || init.method === "GET")) {
    const id = decodeURIComponent(checklistMatch[1]);
    const rows = window.__resolutionTest.checklists[id];
    return Promise.resolve(new Response(JSON.stringify(rows ?? []), {
      status: rows === "fail" ? 503 : 200,
      headers: { "Content-Type": "application/json" },
    }));
  }
  const draftMatch = url.match(/^\\/api\\/tasks\\/([^/]+)\\/resolution-draft$/);
  if (draftMatch && init.method === "POST") {
    const id = decodeURIComponent(draftMatch[1]);
    window.__resolutionTest.requests.push({ id, body: JSON.parse(init.body || "{}") });
    const settle = result => new Response(JSON.stringify(result.body), {
      status: result.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
    const result = window.__resolutionTest.draftResponses.shift() ?? {
      body: { status: "generated", draft: "Fixture summary from completed work." },
    };
    if (result.defer) return new Promise(resolve => window.__resolutionTest.pendingDrafts.push(value => resolve(settle(value))));
    return new Promise(resolve => setTimeout(() => resolve(settle(result)), result.delay ?? 0));
  }
  return nativeFetch(input, init);
};
`;

async function newFixture(browser, task, checklists, draftResponses = [], initialResolution = "") {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  page.on("pageerror", error => console.error("Task resolution browser render error:", error.message));
  await page.setContent("<!doctype html><html><body><div id='root'></div></body></html>");
  await page.addStyleTag({ content: fs.readFileSync(path.join(ROOT, "client/src/components/tasks/task-resolution-dialog.css"), "utf8") });
  await page.evaluate(({ task, checklists, draftResponses, initialResolution }) => {
    window.__resolutionTest = {
      task, checklists, draftResponses, initialResolution, requests: [], pendingDrafts: [], confirmed: false,
      resolveNext(result) {
        const resolve = this.pendingDrafts.shift();
        if (!resolve) throw new Error("No deferred draft request to resolve.");
        resolve(result);
      },
    };
  }, { task, checklists, draftResponses, initialResolution });
  await page.addScriptTag({ content: newFixture.bundle });
  const resolution = page.getByTestId("input-resolve-resolution");
  await resolution.waitFor();
  return { page, resolution };
}

async function eventuallyNoPending(page) {
  await page.waitForFunction(() => window.__resolutionTest.pendingDrafts.length > 0 ||
    window.__resolutionTest.requests.length > 0);
}

async function main() {
  const compiled = await build({
    stdin: { contents: harness, resolveDir: ROOT, sourcefile: "task-resolution-dialog-harness.tsx", loader: "tsx" },
    bundle: true,
    write: false,
    outfile: "task-resolution-dialog-harness.js",
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    target: ["es2020"],
    alias: { "@": `${ROOT}/client/src` },
    plugins: [{
      name: "ignore-component-css",
      setup(build) {
        build.onLoad({ filter: /\.css$/ }, async () => ({ contents: "", loader: "text" }));
      },
    }],
  });
  newFixture.bundle = compiled.outputFiles.find(file => file.path.endsWith(".js")).text;
  const browser = await chromium.launch({ headless: true, executablePath: CHROMIUM, args: ["--no-sandbox"] });
  const errors = [];
  try {
    // Ordinary tasks must use their completed checklist evidence automatically;
    // typing while the request is in flight must always beat the late AI draft.
    {
      const { page, resolution } = await newFixture(browser,
        { id: "ordinary-complete", title: "Verify approved address", tags: [], relatedEntityType: null },
        { "ordinary-complete": [{ label: "Check the approved address", note: "The updated address was saved.", doneAt: "2026-10-01T10:00:00Z", position: 0 }] },
        [{ defer: true }]);
      await eventuallyNoPending(page);
      const status = page.getByTestId("resolution-ai-status");
      await status.waitFor();
      assert.equal(await status.getAttribute("aria-busy"), "true");
      assert.equal(await status.locator(".task-resolution-ai-status__rail").count(), 1);
      assert.equal(await status.locator(".task-resolution-ai-status__rail").evaluate(element => getComputedStyle(element.firstElementChild).animationName), "task-resolution-ai-sweep");
      const requests = await page.evaluate(() => window.__resolutionTest.requests);
      assert.deepEqual(requests.map(request => request.id), ["ordinary-complete"]);
      assert.equal(await status.evaluate(element => getComputedStyle(element.querySelector(".task-resolution-ai-status__rail > span")).animationName), "task-resolution-ai-sweep");
      await page.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(await status.evaluate(element => getComputedStyle(element.querySelector(".task-resolution-ai-status__rail > span")).animationName), "none");
      await resolution.fill("I checked this manually while AI was drafting.");
      await page.evaluate(() => window.__resolutionTest.resolveNext({
        status: 200, body: { status: "generated", draft: "Late AI text must not replace manual writing." },
      }));
      await page.waitForFunction(() => document.querySelector("[data-testid=input-resolve-resolution]").value === "I checked this manually while AI was drafting.");
      assert.equal(await resolution.inputValue(), "I checked this manually while AI was drafting.");
      assert.match(await status.innerText(), /Your existing text was kept/i);
      await page.close();
    }

    // Switching to a different task cancels the previous request and its late
    // response cannot leak into the newly opened resolution dialog.
    {
      const { page, resolution } = await newFixture(browser,
        { id: "switch-from", title: "Previous task", tags: [], relatedEntityType: null },
        {
          "switch-from": [{ label: "Completed previous task", doneAt: "2026-10-01T10:00:00Z", position: 0 }],
          "switch-to": [],
        },
        [{ defer: true }]);
      await eventuallyNoPending(page);
      await page.evaluate(() => window.__resolutionTest.openForTask({
        id: "switch-to", title: "Current task", tags: [], relatedEntityType: null,
      }));
      await page.getByTestId("resolution-ai-status").waitFor();
      await page.waitForFunction(() => document.querySelector("[data-testid=resolution-ai-status]").textContent.includes("No completed checklist steps"));
      await page.evaluate(() => window.__resolutionTest.resolveNext({
        status: 200, body: { status: "generated", draft: "Previous task must not overwrite the current one." },
      }));
      await page.waitForTimeout(50);
      assert.equal(await resolution.inputValue(), "");
      assert.deepEqual((await page.evaluate(() => window.__resolutionTest.requests)).map(request => request.id), ["switch-from"]);
      await page.close();
    }

    // Closing aborts the live request; reopening starts a clean request instead
    // of applying the result from the closed dialog.
    {
      const { page, resolution } = await newFixture(browser,
        { id: "close-reopen", title: "Recheck the paperwork", tags: [], relatedEntityType: null },
        { "close-reopen": [{ label: "Review the paperwork", doneAt: "2026-10-01T10:00:00Z", position: 0 }] },
        [{ defer: true }, { body: { status: "generated", draft: "Fresh draft after reopening." } }]);
      await eventuallyNoPending(page);
      await page.evaluate(() => window.__resolutionTest.closeDialog());
      await page.getByTestId("dialog-task-resolution").waitFor({ state: "hidden" });
      await page.evaluate(() => window.__resolutionTest.resolveNext({
        status: 200, body: { status: "generated", draft: "The closed dialog must ignore this late draft." },
      }));
      await page.evaluate(() => window.__resolutionTest.reopenDialog());
      await page.waitForFunction(() => document.querySelector("[data-testid=input-resolve-resolution]").value === "Fresh draft after reopening.");
      assert.equal(await resolution.inputValue(), "Fresh draft after reopening.");
      assert.equal((await page.evaluate(() => window.__resolutionTest.requests)).length, 2);
      await page.close();
    }

    // Fully completed Pulse tasks draft automatically but keep their closure gate.
    {
      const { page, resolution } = await newFixture(browser,
        { id: "pulse-complete", title: "Close completed procedure", relatedEntityType: "status_list_item", tags: ["status_list"] },
        { "pulse-complete": [{ label: "Review the paperwork", note: "The approved copy was verified.", doneAt: "2026-10-01T10:00:00Z", position: 0 }] });
      await resolution.waitFor({ state: "visible" });
      await page.waitForFunction(() => document.querySelector("[data-testid=input-resolve-resolution]").value === "Fixture summary from completed work.");
      assert.equal((await page.getByTestId("resolve-confirm").isDisabled()), false);
      assert.match(await page.getByTestId("resolution-ai-status").innerText(), /AI draft ready/i);
      await page.close();
    }

    // No completed rows never generate a fiction and leave manual entry available.
    {
      const { page, resolution } = await newFixture(browser,
        { id: "ordinary-empty", title: "Prepare a package", tags: [], relatedEntityType: null },
        { "ordinary-empty": [{ label: "Not yet sent", note: "Pending", doneAt: null, position: 0 }] });
      await page.getByTestId("resolution-ai-status").waitFor();
      assert.match(await page.getByTestId("resolution-ai-status").innerText(), /No completed checklist steps/i);
      assert.deepEqual(await page.evaluate(() => window.__resolutionTest.requests), []);
      assert.equal(await page.getByTestId("resolve-confirm").isDisabled(), true);
      await resolution.fill("Manual resolution remains available.");
      assert.equal(await page.getByTestId("resolve-confirm").isDisabled(), false);
      await page.close();
    }

    // Existing human-entered resolution text is preserved while the automatic
    // draft is being generated, even before the user types into this session.
    {
      const { page, resolution } = await newFixture(browser,
        { id: "ordinary-prefilled", title: "Save an existing resolution", tags: [], relatedEntityType: null },
        { "ordinary-prefilled": [{ label: "Review the saved detail", doneAt: "2026-10-01T10:00:00Z", position: 0 }] },
        [{ defer: true }],
        "An existing resolution that must be preserved.");
      await eventuallyNoPending(page);
      await page.evaluate(() => window.__resolutionTest.resolveNext({
        status: 200, body: { status: "generated", draft: "The AI must not replace pre-existing text." },
      }));
      assert.equal(await resolution.inputValue(), "An existing resolution that must be preserved.");
      assert.match(await page.getByTestId("resolution-ai-status").innerText(), /Your existing text was kept/i);
      await page.close();
    }

    // Failed AI calls are retryable; the retry cannot replace text already edited.
    {
      const { page, resolution } = await newFixture(browser,
        { id: "ordinary-retry", title: "Record the update", tags: [], relatedEntityType: null },
        { "ordinary-retry": [{ label: "Record the completed update", doneAt: "2026-10-01T10:00:00Z", position: 0 }] },
        [
          { status: 503, body: { status: "failed", errorCode: "provider_error" } },
          { body: { status: "generated", draft: "A new AI result cannot erase the agent's edits." } },
        ]);
      await page.getByTestId("button-resolution-draft-retry").waitFor();
      assert.match(await page.getByTestId("resolution-ai-status").innerText(), /could not be generated/i);
      await resolution.fill("A summary I personally wrote.");
      await page.getByTestId("button-resolution-draft-retry").click();
      await page.waitForFunction(() => document.querySelector("[data-testid=input-resolve-resolution]").value === "A summary I personally wrote.");
      assert.equal(await resolution.inputValue(), "A summary I personally wrote.");
      await page.close();
    }

    // Pulse items still gate completion until all checklist steps are complete.
    {
      const { page, resolution } = await newFixture(browser,
        { id: "pulse-incomplete", title: "Finish the procedure", relatedEntityType: "status_list_item", tags: ["status_list"] },
        { "pulse-incomplete": [{ label: "One checked step", doneAt: "2026-10-01T10:00:00Z", position: 0 }, { label: "One outstanding step", doneAt: null, position: 1 }] });
      await page.getByTestId("resolution-checklist-gate").waitFor();
      await resolution.fill("Manual text does not bypass the Pulse gate.");
      assert.equal(await page.getByTestId("resolve-confirm").isDisabled(), true);
      assert.deepEqual(await page.evaluate(() => window.__resolutionTest.requests), []);
      assert.match(await page.getByTestId("resolution-checklist-gate").innerText(), /steps remain/i);
      await page.close();
    }

    // A checklist read failure is explicit and manual entry still works for
    // ordinary tasks whose closure semantics are deliberately unchanged.
    {
      const { page, resolution } = await newFixture(browser,
        { id: "ordinary-checklist-error", title: "Write the result", tags: [], relatedEntityType: null },
        { "ordinary-checklist-error": "fail" });
      await page.getByTestId("button-resolution-checklist-retry").waitFor();
      assert.match(await page.getByTestId("resolution-ai-status").innerText(), /checklist could not be loaded/i);
      await resolution.fill("Manual result after an explicit checklist loading error.");
      assert.equal(await page.getByTestId("resolve-confirm").isDisabled(), false);
      await page.close();
    }
  } catch (error) {
    errors.push(error);
  } finally {
    await browser.close();
  }
  if (errors.length) throw errors[0];
  console.log("Task resolution browser checks passed: ordinary and Pulse auto-drafts, checked evidence, accessible indeterminate animation with reduced-motion support, no-steps manual fallback, edit/retry/late-result safety, dialog-close and task-switch races, checklist-load error, and strict Pulse closure gate.");
}

main().catch(error => { console.error(error); process.exitCode = 1; });