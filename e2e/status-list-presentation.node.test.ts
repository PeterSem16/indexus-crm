import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";

const server = await createServer({ configFile: "vite.config.ts", logLevel: "error",
  server: { host: "127.0.0.1", port: 0, strictPort: false } });
await server.listen();
const address = server.httpServer?.address();
const testPort = address && typeof address === "object" ? address.port : 4187;
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1050, height: 900 } });
const errors: string[] = [];
page.on("pageerror", error => errors.push(error.message));
try {
  for (const locale of ["en", "sk", "cs", "hu", "ro", "it", "de"]) {
    await page.goto(`http://127.0.0.1:${testPort}/test-fixtures/status-list-presentation.html?locale=${locale}`);
    const appearance = page.getByTestId("appearance-value");
    await expect(appearance).toContainText('"color":"green"');
    await expect(appearance).toContainText('"icon":"legacy-icon"');
    assert.ok((await page.locator(".slqs-color-swatch").allTextContents()).every(text => text.trim().length));
    await page.locator(".slqs-color-swatch").first().click();
    await expect(appearance).toContainText('"color":"#4f8178"');
    const color = page.locator('input[type="color"]');
    await color.fill("#123456");
    await expect(appearance).toContainText('"color":"#123456"');
    const picker = page.locator('[data-testid="quick-option-icon-picker"]');
    await expect(picker).toBeVisible();
    const iconButton = picker.locator("button").filter({ has: page.locator("svg") }).first();
    await iconButton.click();
    await expect(appearance).not.toContainText("legacy-icon");
    const answered = page.getByTestId("sl-question-answered-q");
    await expect(answered).toContainText("Test Agent");
    const timestamp = await page.evaluate(language => new Date("2026-10-21T12:30:00Z")
      .toLocaleString(language, { dateStyle: "short", timeStyle: "short" }), locale);
    await expect(answered).toContainText(timestamp);
    await page.getByTestId("toggle-pending").click();
    await expect(page.getByTestId("sl-question-pending-q")).toBeVisible();
    await expect(answered).toHaveCount(0);
    const note = page.getByTestId("sl-question-note-q");
    await note.fill("Changed independently");
    await page.getByTestId("sl-question-note-save-q").click();
    await expect(page.getByTestId("saved-note")).toContainText('"saves":1');
    await expect(page.getByTestId("sl-question-pending-q")).toBeVisible();
    await note.fill("");
    await page.getByTestId("sl-question-note-save-q").click();
    await expect(page.getByTestId("saved-note")).toContainText('"note":null');
    await page.getByTestId("toggle-failure").click();
    await note.fill("Keep draft on failure");
    await page.getByTestId("sl-question-note-save-q").click();
    await expect(note).toHaveValue("Keep draft on failure");
    await expect(page.getByTestId("saved-note")).toContainText('"saves":2');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://127.0.0.1:${testPort}/test-fixtures/status-list-presentation.html?locale=sk&dark=1`);
  await expect(page.getByTestId("sl-question-answered-q")).toBeVisible();
  const bounds = await page.locator(".sl-agent-dialog-frame").boundingBox();
  assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 391, "mobile dialog fits");
  const bg = await page.locator(".sl-agent-dialog-frame").evaluate(el => getComputedStyle(el).backgroundColor);
  assert.equal(bg, "rgb(33, 31, 27)");
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal page overflow");
  await mkdir("generated-artifacts/status-list-ui", { recursive: true });
  await page.screenshot({ path: "generated-artifacts/status-list-ui/presentation-mobile-dark.jpg", fullPage: true });
  assert.deepEqual(errors, []);
  console.log("Status List presentation browser passed: seven locales, icon/color controls, persisted provenance, pending Batch, independent note edits, clear/failure, mobile dark.");
} finally { await browser.close(); await server.close(); }
