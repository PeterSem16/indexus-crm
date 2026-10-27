import assert from "node:assert/strict";
import test from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { getStatusListTriggerScopeCopy } from "../client/src/components/status-list-trigger-scope-copy";

test("background triggers activate and save unchanged settings without bypassing safety gates", async () => {
  const vite = await createServer({
    configFile: false, root: "client", cacheDir: "/tmp/indexus-automatic-activation-cache",
    resolve: { alias: { "@": `${process.cwd()}/client/src`, "@shared": `${process.cwd()}/shared` } },
    esbuild: { jsx: "automatic" }, server: { host: "127.0.0.1", port: 0 }, logLevel: "error",
  });
  await vite.listen();
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const errors: string[] = [], payloads: any[] = [];
    page.on("pageerror", error => errors.push(error.message));
    let scenario: "saved" | "source" | "heading" | "blocked" = "saved";
    let enabled = true, revision: string | null = "revision";
    await page.route("**/test-fixtures/activation.html*", route => route.fulfill({
      contentType: "text/html",
      body: '<html><body><div id="root"></div><script type="module" src="/test-fixtures/status-list-automatic.tsx"></script></body></html>',
    }));
    await page.route("**/api/**", async route => {
      const request = route.request(), path = new URL(request.url()).pathname;
      if (path.endsWith("/automatic-contacts")) return route.fulfill({ json: { contacts: [] } });
      if (path.includes("/automatic-items/")) {
        if (request.method() === "PUT") {
          const payload = request.postDataJSON();
          payloads.push(payload);
          assert.equal(payload.acknowledged, true);
          assert.equal(payload.expectedRevision, revision);
          enabled = payload.enabled;
          revision ||= "created-revision";
        }
        return route.fulfill({ json: {
          item: { id: "item", label: "Background answer", isHidden: true,
            confirmationType: scenario === "source" || scenario === "heading" ? "info" : "auto",
            systemSourceAnswer: scenario === "source" },
          config: { trigger: "background_change", enabled, revision, backgroundExecution: "mission" },
          mode: "immediate",
          actions: [{ id: "action", actionType: "notify_role", questionLabel: null, issues: scenario === "blocked" ? ["owner_required"] : [] }],
          supportedConditionFields: ["healthcare.state"],
        } });
      }
      throw Error(`Unexpected request: ${request.method()} ${path}`);
    });
    const port = (vite.httpServer!.address() as { port: number }).port;
    const go = async (locale: string, extra = "") => {
      await page.goto(`http://127.0.0.1:${port}/test-fixtures/activation.html?locale=${locale}${extra}`, {
        waitUntil: "domcontentloaded", timeout: 90000,
      });
      await expect(page.locator(".slati-skeleton")).toHaveCount(0);
      await expect(page.locator(".slati-save-row button")).toBeVisible();
    };
    const save = page.locator(".slati-save-row button");
    const ack = page.locator(".slati-ack input");
    for (const locale of ["sk", "en", "cs", "hu", "ro", "it", "de"]) {
      scenario = "saved"; enabled = true; revision = "revision";
      await go(locale);
      await expect(save).toBeDisabled();
      await ack.check();
      await expect(save).toBeEnabled();
      const before = payloads.length;
      await save.click();
      await expect(ack).not.toBeChecked();
      assert.equal(payloads.length, before + 1, "unchanged settings can be saved after acknowledgment");
      assert.equal(payloads.at(-1).trigger, "background_change");

      scenario = "source"; enabled = false; revision = null;
      await go(locale);
      const select = page.locator(".slati-controls select").first();
      await expect(select).toBeEnabled();
      await expect(select.locator("option[value=agent_confirmation]")).toHaveAttribute("disabled", "");
      await expect(select.locator("option[value=card_open]")).toHaveAttribute("disabled", "");
      await expect(select.locator("option[value=pulse_open]")).toHaveAttribute("disabled", "");
      await page.locator(".slati-switch input").check();
      await expect(save).toBeDisabled();
      await ack.check();
      await expect(save).toBeEnabled();
      if (locale === "sk") await page.screenshot({ path: "/tmp/automatic-trigger-activation.png", fullPage: true });
      await save.click();
      await expect(ack).not.toBeChecked();
      assert.equal(payloads.at(-1).expectedRevision, null);
      await ack.check();
      await save.click();
      await expect(ack).not.toBeChecked();
      assert.equal(payloads.at(-1).expectedRevision, "created-revision");
      await page.reload();
      await expect(page.locator(".slati-switch input")).toBeChecked();
    }
    assert.equal(payloads.length, 21);
    scenario = "heading"; enabled = false;
    await go("sk");
    await expect(save).toBeDisabled();
    await expect(page.locator(".slati-switch input")).toBeDisabled();
    await expect(page.locator(".slati-controls select").first()).toBeDisabled();

    scenario = "blocked"; enabled = true;
    await go("sk");
    await ack.check();
    await expect(save).toBeDisabled();
    await expect(page.getByText(getStatusListTriggerScopeCopy("sk").activationBlock, { exact: true })).toBeVisible();

    scenario = "saved";
    await go("sk", "&disabled=1");
    await expect(save).toBeDisabled();
    await expect(ack).toBeDisabled();
    await expect(page.getByText(getStatusListTriggerScopeCopy("sk").editorBlocked, { exact: true })).toBeVisible();
    assert.equal(payloads.length, 21, "locked and invalid states cannot save");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await vite.close();
  }
});
