import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const proofDir = "/tmp/pulse-agent-request-proof";
const bundlePath = path.join(proofDir, "fixture.js");
const cssPath = path.join(proofDir, "theme.css");
const fixturePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "agent-task-request-browser-fixture.tsx");
const authoredBody = "Please correct the postal address to 17 Cedar Lane.\n\nPlease retain this second paragraph exactly.";

await mkdir(proofDir, { recursive: true });

// Compile current source utilities/components as well as the repository's real
// index.css + Tailwind output; do not depend on a possibly stale dist build.
execFileSync(
  path.resolve(root, "node_modules/.bin/tailwindcss"),
  ["-c", "tailwind.config.ts", "-i", "client/src/index.css", "-o", cssPath],
  { cwd: root, stdio: "inherit" },
);
await build({
  absWorkingDir: root,
  entryPoints: [fixturePath],
  outfile: bundlePath,
  bundle: true,
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  target: ["es2020"],
  tsconfig: path.join(root, "tsconfig.json"),
  alias: {
    "@": path.join(root, "client/src"),
    "@shared": path.join(root, "shared"),
  },
  logLevel: "info",
});

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="/theme.css" />
    <title>Pulse task request editor regression</title>
  </head>
  <body><div id="root"></div><script src="/fixture.js"></script></body>
</html>`;

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url || "/", "http://localhost").pathname;
  if (pathname === "/fixture.js") {
    response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    response.end(await readFile(bundlePath));
  } else if (pathname === "/theme.css") {
    response.writeHead(200, { "content-type": "text/css; charset=utf-8" });
    response.end(await readFile(cssPath));
  } else {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
let browser;

function relativeLuminance(color) {
  const [r, g, b] = color.match(/\d+/g).slice(0, 3).map(Number).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground, background) {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

try {
  const chromiumPath = process.env.PULSE_CHROMIUM_PATH || "/repl/tools/bin/chromium";
  browser = await chromium.launch({
    headless: true,
    ...(existsSync(chromiumPath) ? { executablePath: chromiumPath } : {}),
  });
  for (const scenario of [
    { name: "desktop", width: 1440, height: 900, expectedColumns: 2 },
    { name: "short-desktop", width: 1024, height: 650, expectedColumns: 2 },
    { name: "mobile", width: 390, height: 844, expectedColumns: 1 },
  ]) {
    const page = await browser.newPage({ viewport: { width: scenario.width, height: scenario.height } });
    page.on("console", (message) => {
      if (message.type() === "error") console.error(`[browser:${scenario.name}]`, message.text());
    });
    page.on("pageerror", (error) => console.error(`[browser:${scenario.name}] page error:`, error));
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
    const editor = page.getByTestId("agent-task-request-editor");
    const context = page.getByTestId("agent-task-request-context");
    const textarea = page.getByTestId("input-create-task-description");
    await editor.waitFor({ state: "visible", timeout: 7000 });
    assert.equal(await page.getByText("Your request", { exact: true }).count(), 1, "actual translated editor title rendered");
    assert.equal(await context.getByText("Task context", { exact: true }).count(), 1, "actual translated context title rendered");
    assert.match(await context.innerText(), /Mila Novak/, "entity appears in the read-only context");
    assert.equal(
      await context.locator("textarea, input, [contenteditable='true']").count(),
      0,
      "automatic context is not editable",
    );

    const gridColumns = await page.getByTestId("fixture-form-grid").evaluate((element) => {
      return getComputedStyle(element).gridTemplateColumns.split(" ").length;
    });
    assert.equal(gridColumns, scenario.expectedColumns, `${scenario.name} uses expected form columns`);

    const colors = await page.evaluate(() => {
      const request = document.querySelector('[data-testid="agent-task-request-editor"]');
      const contextElement = document.querySelector('[data-testid="agent-task-request-context"]');
      const textareaElement = document.querySelector('[data-testid="input-create-task-description"]');
      const title = request.querySelector("label");
      return {
        editorBackground: getComputedStyle(request).backgroundColor,
        contextBackground: getComputedStyle(contextElement).backgroundColor,
        textColor: getComputedStyle(textareaElement).color,
        editorBackgroundForContrast: getComputedStyle(request).backgroundColor,
        titleColor: getComputedStyle(title).color,
      };
    });
    assert.notEqual(colors.editorBackground, colors.contextBackground, "request card and automatic context remain visually distinct");
    assert.ok(contrastRatio(colors.textColor, colors.editorBackgroundForContrast) >= 4.5, "request text remains legible against real app styles");
    assert.ok(contrastRatio(colors.titleColor, colors.editorBackgroundForContrast) >= 4.5, "request title remains legible against real app styles");

    await textarea.fill(authoredBody);
    await page.getByTestId("fixture-change-category").click();
    assert.equal(await textarea.inputValue(), authoredBody, "category change preserves the authored multiline body");
    assert.match(await context.innerText(), /Mila Novak/, "category update retains entity context");
    assert.match(await context.innerText(), /address/i, "selected category phrase appears in automatic context");

    await textarea.focus();
    await page.screenshot({
      path: path.join(proofDir, `${scenario.name}.png`),
      animations: "disabled",
    });

    await page.getByTestId("fixture-submit").click();
    assert.equal(
      await page.getByTestId("fixture-submitted-request").getAttribute("data-request"),
      authoredBody,
      "actual compose helper output is extracted exactly by actual getTaskRequestBrief",
    );
    await page.close();
    console.log(`passed ${scenario.name} (${scenario.width}x${scenario.height})`);
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log(`Pulse task request browser proof saved to ${proofDir}`);