import test from "node:test";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { getStatusListHistoryCopy } from "../client/src/components/status-list-history-copy";
test("real history IF controls, serialized values, workflow and searchable help", async () => {
  const server = await createServer({ configFile: "vite.config.ts", logLevel: "error",
    server: { host: "127.0.0.1", port: 4178, strictPort: true } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://127.0.0.1:4178/test-fixtures/status-list-history.html", { timeout: 120000 });
    await page.getByTestId("service-action-condition-mode").selectOption("compound");
    await page.getByText("Pridať podmienku", { exact: true }).click();
    await page.getByTestId("service-action-condition-field-0").selectOption("history.outreach_attempted");
    await page.getByTestId("service-action-condition-value-0").selectOption("false");
    const payload = JSON.parse(await page.getByTestId("payload").innerText());
    assert.deepEqual(JSON.parse(payload.conditionJson).rules, [{ field: "history.outreach_attempted", op: "eq", value: "false" }]);
    await expect(page.getByTestId("service-action-history-help")).toContainText("skrytie položky nevytvára spúšťač");
    await page.getByTestId("status-list-help-open").click();
    await page.getByTestId("status-list-help-search").fill("dôkaz komunikácie");
    await expect(page.getByTestId("status-list-help-article")).toContainText("Samotné odoslanie/doručenie nestačí");
    await page.getByTestId("status-list-help-close").click();
    await page.getByTestId("workflow-open").click();
    await page.getByTestId("status-workflow-nav-if").click();
    await page.getByTestId("status-workflow-condition-field-0").selectOption("history.reached");
    await page.getByTestId("status-workflow-condition-value-0").selectOption("false");
    const rule = JSON.parse(await page.getByTestId("workflow-payload").innerText());
    assert.deepEqual(rule.conditions, [{ field: "history.reached", op: "equals", value: false }]);
    await expect(page.getByTestId("status-workflow-condition-op-0").locator("option")).toHaveCount(2);
    await page.keyboard.press("Escape");
    for (const locale of ["en", "cs", "hu", "ro", "it", "de"]) {
      await page.goto(`http://127.0.0.1:4178/test-fixtures/status-list-history.html?locale=${locale}`);
      await page.getByTestId("service-action-condition-mode").selectOption("compound");
      await expect(page.getByTestId("service-action-history-help")).toContainText(getStatusListHistoryCopy(locale).scope);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
});
