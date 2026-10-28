import assert from "node:assert/strict";
import test from "node:test";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { isStatusListInfoHeading } from "../shared/status-list-confirmation-kind";

// Real CommunicationCanvas + save dialog; only fixture transport is simulated.
// Server interpretation and read-only previews are also covered by the DB test.
const groups = ["received-group", "validated-group", "proposal-group"];
const choices = ["received", "validated", "pending"];
const items = [
  ...groups.map(id => ({ id, label: id, parentId: null, itemType: "step",
    confirmationType: "info", questionSelectionMode: "single", tab: "contract",
    stepId: id, automations: [], questions: [], isHidden: false })),
  ...choices.map((id, index) => ({ id, label: id, parentId: groups[index],
    itemType: "step", confirmationType: "info", tab: "contract", stepId: id,
    automations: [], questions: [], isHidden: false })),
  { id: "received-no", label: "not received", parentId: groups[0], itemType: "step",
    confirmationType: "info", tab: "contract", stepId: "received-no",
    automations: [], questions: [], isHidden: false },
];

test("legacy info answers: received, validated, rules-only Batch, manual callback and immediate replacement", async () => {
  const server = await createServer({ configFile: "vite.config.ts", logLevel: "error",
    cacheDir: "/tmp/indexus-legacy-choice-vite-cache",
    server: { host: "127.0.0.1", port: 4191, strictPort: true } });
  await server.listen();
  const base = "http://127.0.0.1:4191";
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    for (const scenario of ["rules", "reschedule", "immediate"] as const) {
      const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, timezoneId: "Europe/Bratislava" });
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(120000);
      const errors: string[] = [], confirmations: any[] = [], callbackWrites: any[] = [];
      page.on("pageerror", error => errors.push(error.message));
      let states: any[] = scenario === "immediate"
        ? [{ id: "old", statusListItemId: "received-no", confirmedAt: new Date().toISOString() }] : [];
      const mode = scenario === "immediate" ? "immediate" : "batch";
      await page.addInitScript(() => { localStorage.setItem("locale", "en"); });
      await page.route("**/api/**", async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        const method = request.method();
        let body: any;
        try { body = request.postDataJSON(); } catch { body = {}; }
        let json: any = [];
        if (path === "/api/auth/me") json = { user: { id: "agent-1", username: "test", role: "agent" } };
        else if (path === "/api/campaigns/campaign-1/status-list") json = items;
        else if (path.endsWith("/status-list-state") && method === "GET") json = states;
        else if (path.endsWith("/status-list-workflows") && method === "GET") json = { answers: {}, notes: {}, runs: [], catalog: [] };
        else if (path.endsWith("/confirmation-preview")) {
          for (const change of body.changes || []) {
            const item = items.find(item => item.id === change.id);
            assert.ok(item && !isStatusListInfoHeading(item, items), "preview cannot admit a heading");
          }
          json = { readOnly: true, mode, actions: [] };
        } else if (/\/status-list-state\/[^/]+$/.test(path) && method === "POST") {
          const id = path.split("/").at(-1)!;
          const item = items.find(item => item.id === id);
          assert.ok(item && !isStatusListInfoHeading(item, items));
          assert.equal(body.executionMode, mode);
          assert.equal(body.commit, true);
          assert.match(body.requestId, /^[a-f0-9-]{36}$/i);
          confirmations.push({ id, confirm: body.confirm });
          states = states.filter(row => row.statusListItemId !== id);
          if (body.confirm) states.push({ id, statusListItemId: id, confirmedAt: new Date().toISOString() });
          json = { ok: true, confirmed: body.confirm, actionResults: [] };
        } else if (path === "/api/campaigns/campaign-1/contacts/campaign-contact-1" && method === "PATCH") {
          callbackWrites.push(body);
          json = { ok: true };
        }
        await route.fulfill({ json });
      });
      await page.goto(`${base}/test-fixtures/pulse-status-notes.html?mode=${mode}`, { waitUntil: "networkidle" });
      try {
        await page.getByTestId("sl-phase-contract").click();
      } catch (error) {
        console.error("Fixture render diagnostics", JSON.stringify({
          errors, body: (await page.locator("body").innerText()).slice(0, 1200),
        }));
        throw error;
      }
      await expect(page.getByTestId("sl-check-received-group")).toHaveCount(0);
      await page.getByTestId("sl-check-received").click();
      if (scenario === "immediate") {
        await expect.poll(() => confirmations.length).toBe(2);
        assert.deepEqual(confirmations, [{ id: "received-no", confirm: false }, { id: "received", confirm: true }]);
      } else {
        await page.getByTestId("sl-check-validated").click();
        await page.getByTestId("sl-check-pending").click();
        assert.deepEqual(confirmations, [], "draft selection must not write before Save");
        const save = page.getByTestId("btn-sl-batch-save");
        await expect(save).toBeEnabled();
        await save.click();
        await page.locator(".sl-batch-action").nth(scenario === "rules" ? 0 : 1).click();
        if (scenario === "reschedule") {
          await page.locator(".sl-batch-presets button").first().click();
          await page.getByTestId("status-list-batch-callback-hour").selectOption("13");
          await page.getByTestId("status-list-batch-callback-minute").selectOption("17");
        }
        await page.getByTestId("btn-sl-batch-save-confirm").click();
        await expect.poll(() => confirmations.length).toBe(3);
        assert.deepEqual(confirmations, choices.map(id => ({ id, confirm: true })));
        if (scenario === "reschedule") {
          await expect.poll(() => callbackWrites.length).toBe(1);
          assert.equal(callbackWrites[0].status, "callback_scheduled");
          assert.ok(Number.isFinite(new Date(callbackWrites[0].callbackDate).getTime()));
        } else assert.deepEqual(callbackWrites, [], "rules-only must not invent a manual callback");
        await expect(page.getByTestId("btn-sl-batch-save-confirm")).toHaveCount(0);
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); await server.close(); }
});
