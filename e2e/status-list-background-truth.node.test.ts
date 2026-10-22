import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { getStatusListBackgroundDiagnosticsCopy } from "../client/src/components/status-list-background-diagnostics-copy";
import { getStatusListBackgroundCopy } from "../client/src/components/status-list-background-copy";

test("background diagnostics are read-only, localized, refreshable and expose actual workflow triggers", async () => {
  const server = await createServer({ configFile: "vite.config.ts", logLevel: "error",
    server: { host: "127.0.0.1", port: 4179, strictPort: true } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors: string[] = [], writes: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    let fail = false;
    await page.route("**/api/campaigns/fixture/status-list-workflows**", async route => {
      const request = route.request();
      if (request.method() !== "GET") writes.push(request.method());
      if (request.url().endsWith("/background-diagnostics")) {
        await route.fulfill({ status: fail ? 500 : 200, json: fail ? { error: "failed" } : { groups: [{
          groupId: "group", label: "Reachability test", source: "reachability", hidden: true,
          totalContacts: 3, evaluatedContacts: 2, currentRevisionContacts: 1, lastEvaluatedAt: "2026-10-22T09:00:00Z",
          states: [{ value: "reachable", count: 1 }],
          legacyActions: [{ itemId: "option", label: "Reachable", count: 2 }],
          rules: [{ id: "rule", name: "Derived answer rule", enabled: true, trigger: "background_transition", sourceId: "option" }],
          transitions: [
            { id: "baseline", occurredAt: "2026-10-22T12:00:00Z", baseline: true, previousLabel: null, valueLabel: "Reachable" },
            { id: "change", occurredAt: "2026-10-21T09:00:00Z", baseline: false, previousLabel: "Waiting", valueLabel: "Reachable" },
          ],
        }] } });
      } else {
        await route.fulfill({ json: { rules: [{
          id: "rule", campaignId: "fixture", name: "Derived answer rule", enabled: true, trigger: "background_transition",
          source: { kind: "item", id: "option" }, logic: "and", conditions: [],
          thenActions: [{ type: "replace_note", target: { kind: "item", id: "target" }, text: "Note" }], elseActions: [],
        }], catalog: [
          { kind: "item", id: "option", label: "Reachable", fieldType: "checkbox", writable: false, hidden: true, backgroundSource: "reachability" },
          { kind: "item", id: "target", label: "Manual step", fieldType: "checkbox", writable: true, hidden: false },
        ] } });
      }
    });
    for (const locale of ["sk","en","cs","hu","ro","it","de"]) {
      const copy = getStatusListBackgroundDiagnosticsCopy(locale);
      await page.goto(`http://127.0.0.1:4179/test-fixtures/status-list-background-truth.html?locale=${locale}`, { timeout: 120000 });
      const panel = page.getByTestId("status-list-background-diagnostics");
      await expect(panel).toContainText(copy.title);
      await expect(panel).toContainText("2 / 3");
      await expect(panel).toContainText(copy.legacyWarning);
      await expect(panel).toContainText(copy.baseline);
      await expect(panel).toContainText(copy.opening);
      await expect(page.getByTestId("status-list-workflows")).toContainText(getStatusListBackgroundCopy(locale).backgroundMode);
      await expect(panel.locator(".slbd-metrics")).not.toContainText(copy.baselineTitle);
    }
    fail = true;
    const copy = getStatusListBackgroundDiagnosticsCopy("de");
    await page.getByTestId("status-list-background-diagnostics").getByRole("button", { name: copy.reload }).click();
    await expect(page.getByRole("alert")).toContainText(copy.loadError);
    fail = false;
    await page.getByRole("button", { name: copy.retry }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No mobile page overflow");
    await page.goto("http://127.0.0.1:4179/test-fixtures/status-list-background-truth.html?groupId=missing");
    await expect(page.getByTestId("status-list-background-diagnostics")).toContainText(getStatusListBackgroundDiagnosticsCopy("sk").groupEmpty);
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});
