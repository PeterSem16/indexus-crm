import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { buildSync } from "esbuild";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getFlowchartCopy } from "../i18n/automation-flowchart-copy";
import type { AutomationFlowModel } from "../lib/automation-flow-model";

const bundled = buildSync({
  entryPoints: ["client/src/components/automation-rule-flowchart.tsx"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  packages: "external",
  jsx: "automatic",
  loader: { ".css": "empty" },
});
const loaded = { exports: {} as { AutomationRuleFlowchart: ComponentType<any> } };
new Function("require", "module", "exports", bundled.outputFiles[0].text)(
  createRequire(import.meta.url),
  loaded,
  loaded.exports,
);

const model: AutomationFlowModel = {
  title: "Nested decision",
  enabled: true,
  scope: [],
  trigger: { title: "Record updated", details: [] },
  conditions: {
    kind: "all",
    children: [
      { kind: "leaf", field: "Status", operator: "is", value: "Open" },
      {
        kind: "not",
        children: [{
          kind: "any",
          children: [
            { kind: "leaf", field: "Region", operator: "is", value: "West" },
            { kind: "leaf", field: "Priority", operator: "is", value: "Low" },
          ],
        }],
      },
    ],
  },
  actions: [{ title: "Notify owner", details: [] }],
  elseActions: [{ title: "Log non-match", details: [] }],
};

for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
  const copy = getFlowchartCopy(locale);
  const html = renderToStaticMarkup(createElement(loaded.exports.AutomationRuleFlowchart, { model, locale }));

  assert.ok(html.includes(copy.branchThen), `${locale}: THEN branch label is rendered`);
  assert.ok(html.includes(copy.branchThenHint), `${locale}: whole-IF true explanation is rendered`);
  assert.ok(html.includes(copy.branchElse), `${locale}: ELSE branch label is rendered`);
  assert.ok(html.includes(copy.branchElseHint), `${locale}: whole-IF false explanation is rendered`);
  assert.ok(html.includes(copy.decisionSummary), `${locale}: root distinguishes local NOT from whole IF`);
  assert.ok(html.includes(copy.notHint), `${locale}: nested NOT explains its local scope`);
  assert.ok(html.includes('data-flow-branch="yes"') && html.includes('data-flow-branch="no"'));
  assert.ok(html.includes("Notify owner") && html.includes("Log non-match"), `${locale}: nested decision retains both branch actions`);
  assert.equal((html.match(/class="indexus-flowchart__logic-badge /g) || []).length, 3);
}

console.log("Automation flowchart clarity SSR regression passed for seven locales and nested NOT conditions.");

// Opt-in native-browser layout check of the real component and stylesheet, without
// bypassing app authentication or sending requests to automation execution routes.
if (process.argv.includes("--browser")) {
  void (async () => {
    const { readFile } = await import("node:fs/promises");
    const { chromium } = await import("@playwright/test");
    const css = await readFile("client/src/components/automation-rule-flowchart.css", "utf8");
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/repl/tools/bin/chromium",
      headless: true,
    });
    try {
      const page = await browser.newPage();
      for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"] as const) {
        for (const width of [1200, 768, 390]) {
          await page.setViewportSize({ width, height: 900 });
          const html = renderToStaticMarkup(createElement(loaded.exports.AutomationRuleFlowchart, { model, locale }));
          await page.setContent(`<style>body{margin:0;padding:16px;box-sizing:border-box}*,*::before,*::after{box-sizing:border-box}${css}</style>${html}`);
          const copy = getFlowchartCopy(locale);
          assert.ok(await page.locator('[data-flow-branch="yes"]').innerText().then(text => text.includes(copy.branchThenHint)));
          assert.ok(await page.locator('[data-flow-branch="no"]').innerText().then(text => text.includes(copy.branchElseHint)));
          assert.ok(await page.locator(".indexus-flowchart__logic-badge--not").locator("..").innerText().then(text => text.includes(copy.notHint)));
          const layout = await page.evaluate(() => ({
            fits: document.documentElement.scrollWidth <= window.innerWidth,
            labelsFit: [...document.querySelectorAll<HTMLElement>(".indexus-flowchart__branch-label")].every(el => el.scrollWidth <= el.clientWidth),
          }));
          assert.ok(layout.fits && layout.labelsFit, `${locale}/${width}: branch labels remain readable without horizontal overflow`);
        }
      }
      console.log("Native browser clarity layout passed: seven locales × desktop/tablet/mobile, no horizontal overflow.");
    } finally {
      await browser.close();
    }
  })().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
