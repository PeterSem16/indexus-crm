const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { build } = require("esbuild");
const postcss = require("postcss");
const tailwindcss = require("tailwindcss");
const loadConfig = require("tailwindcss/loadConfig");
const { chromium } = require("@playwright/test");

// Render the real shared Sheet and production CSS, without touching app auth.
const root = process.cwd();
const harness = `
import React from "react";
import {createRoot} from "react-dom/client";
import {Sheet,SheetContent,SheetTitle} from "@/components/ui/sheet";
const config = window.drawerCase;
createRoot(document.getElementById("root")).render(
  config.custom ? <div data-testid="panel" data-fluid-drawer-width={config.size}
    className="fixed inset-y-0 right-0 w-[960px] max-w-[95vw] z-[51]"><button>Close</button></div> :
  <Sheet open><SheetContent data-testid="panel" side={config.side || "right"}
    drawerWidth={config.size} className={config.className || "w-[900px] sm:max-w-[900px] z-[9994]"}
    style={config.style}>
    <SheetTitle>Responsive drawer</SheetTitle>
    <div className="overflow-y-auto h-[120px]">${"Content<br/>".repeat(40)}</div>
  </SheetContent></Sheet>);
`;

async function main() {
  const compiled = await build({
    stdin: { contents: harness, resolveDir: root, sourcefile: "drawer-test.tsx", loader: "tsx" },
    bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
    alias: { "@": path.join(root, "client/src") },
  });
  const css = await postcss([tailwindcss({
    ...loadConfig(path.join(root, "tailwind.config.ts")),
    content: [{ raw: harness, extension: "tsx" }, "client/src/components/ui/sheet.tsx"],
  })]).process(fs.readFileSync("client/src/index.css", "utf8"), { from: undefined });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium",
    headless: true, args: ["--no-sandbox"],
  });
  let checks = 0;
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const viewport of [375, 640, 767, 768, 1024, 1440, 1920, 2560]) {
      await page.setViewportSize({ width: viewport, height: 900 });
      for (const size of ["compact", "standard", "wide"]) {
        for (const custom of [false, true]) {
          await page.setContent(`<style>${css.css}</style><div id="root"></div>`);
          await page.evaluate(config => { window.drawerCase = config; }, { size, custom });
          await page.addScriptTag({ content: compiled.outputFiles[0].text });
          const panel = page.getByTestId("panel");
          await panel.waitFor();
          await page.waitForTimeout(550);
          const box = await panel.boundingBox();
          const [minimum, ratio, cap] = {
            compact: [480, .4, 720], standard: [720, .72, 1200], wide: [900, .8, 1600],
          }[size];
          const expected = viewport <= 767 ? viewport : Math.min(viewport, Math.max(minimum, Math.min(viewport * ratio, cap)));
          assert.ok(Math.abs(box.width - expected) < 1, `${size} custom=${custom} ${viewport}: ${box.width} != ${expected}`);
          assert.ok(box.x >= -1 && box.x + box.width <= viewport + 1, "drawer outside screen");
          assert.equal(await panel.evaluate(el => getComputedStyle(el).zIndex), custom ? "51" : "9994");
          assert.ok(await panel.locator("button").last().isVisible(), "close button hidden");
          checks++;
        }
      }
    }
    // Navigation opt-out and bottom drawers must not inherit side-drawer sizing.
    for (const config of [
      { size: "none", side: "left", style: { width: "288px" }, className: "max-w-none" },
      { size: "wide", side: "bottom", style: { width: "320px" } },
    ]) {
      await page.setViewportSize({ width: 375, height: 900 });
      await page.setContent(`<style>${css.css}</style><div id="root"></div>`);
      await page.evaluate(config => { window.drawerCase = config; }, config);
      await page.addScriptTag({ content: compiled.outputFiles[0].text });
      await page.getByTestId("panel").waitFor();
      await page.waitForTimeout(550);
      const width = (await page.getByTestId("panel").boundingBox()).width;
      assert.ok(Math.abs(width - parseFloat(config.style.width)) < 1, `excluded ${config.side}: ${width}`);
      checks++;
    }
    assert.deepEqual(errors, []);
    console.log(`PASS: ${checks} responsive drawer browser checks (real Sheet/CSS, mobile/tablet/desktop, custom panels, close visibility, stacking and exclusions).`);
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
