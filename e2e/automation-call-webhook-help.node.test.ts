import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig";
import copy from "../client/src/i18n/automation-editor-help-translations";

test("Call and Webhook help: seven languages, integration guidance and real parent-modal layers", async () => {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
    assert.deepEqual(Object.keys(copy[locale]).sort(), Object.keys(copy.en).sort());
    assert.equal(copy[locale].call.length, 5);
    assert.equal(copy[locale].webhook.length, 7);
    assert.match(copy[locale].webhook.join(" "), /Zapier/);
    assert.match(copy[locale].webhook.join(" "), /Trello/);
    assert.match(copy[locale].webhook.join(" "), /Mailchimp/);
    assert.match(copy[locale].call[0], /THEN/);
  }
  const pageSource = await readFile("client/src/pages/automations.tsx", "utf8");
  const catalogSource = await readFile("client/src/components/automation-service-catalog.tsx", "utf8");
  assert.match(pageSource, /draft\.module === "call" && <AutomationStepHelp step="call"/);
  assert.match(pageSource, /<AutomationStepHelp step="webhook"/);
  assert.match(catalogSource, /id === "webhook" && <AutomationStepHelp/);
  assert.equal((catalogSource.match(/AutomationStepHelp step="call"/g) || []).length, 2);

  const result = await build({
    stdin: { contents: `
      import React from "react";
      import {createRoot} from "react-dom/client";
      import {Dialog,DialogContent,DialogTitle,DialogDescription} from "./client/src/components/ui/dialog";
      import {AutomationStepHelp} from "./client/src/components/automation-step-help";
      import copy from "./client/src/i18n/automation-editor-help-translations";
      createRoot(document.getElementById("root")).render(
        <Dialog open><DialogContent className="task-modern-modal automation-editor-dialog automation-rule-dialog"
          overlayClassName="task-modern-modal-overlay" data-testid="parent">
          <DialogTitle>Automation</DialogTitle><DialogDescription>Event and action help</DialogDescription>
          <div className="task-modern-modal-body">
            <AutomationStepHelp step="call" copy={copy.sk}/>
            <AutomationStepHelp step="webhook" copy={copy.sk}/>
          </div>
        </DialogContent></Dialog>);
    `, loader: "tsx", resolveDir: process.cwd() },
    plugins: [{
      name: "help-language",
      setup(builder) {
        builder.onResolve({ filter: /^@\/i18n$/ }, () => ({ path: "language", namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `export const useI18n=()=>({t:{common:{close:"Zavrieť"}}});`, loader: "ts",
        }));
      },
    }],
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const styles = await postcss([tailwindcss({ ...loadConfig(`${process.cwd()}/tailwind.config.ts`), content: [
    "client/src/components/automation-step-help.tsx", "client/src/components/ui/{dialog,button,popover}.tsx",
  ] })]).process(await readFile("client/src/index.css", "utf8"), { from: `${process.cwd()}/client/src/index.css` });
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setContent('<div id="root"></div>');
    await page.addStyleTag({ content: styles.css +
      await readFile("client/src/components/tasks/task-modal-modern.css", "utf8") +
      await readFile("client/src/pages/automations-workspace.css", "utf8") });
    await page.addScriptTag({ content: result.outputFiles[0].text });
    for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      for (const step of ["call", "webhook"] as const) {
        await page.getByTestId(`automation-${step}-help`).click();
        const content = page.getByTestId(`automation-${step}-help-content`);
        await expect(content).toBeVisible();
        for (const paragraph of copy.sk[step]) await expect(content).toContainText(paragraph);
        const bounds = await content.boundingBox();
        assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1);
        await page.screenshot({ path: `/tmp/automation-${step}-help-${viewport.width}.png` });
        await page.keyboard.press("Escape");
        await expect(content).toHaveCount(0);
        await expect(page.getByTestId("parent")).toBeVisible();
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
