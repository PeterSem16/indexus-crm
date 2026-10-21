import test from "node:test";
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
const base = "http://127.0.0.1:4174";
test("real Pulse components: final Batch answers, no early writes, safe response retry and Immediate mode", async () => {
  const server = await createServer({ configFile: "vite.config.ts", logLevel: "error",
    server: { host: "127.0.0.1", port: 4174, strictPort: true } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    for (const mode of ["batch", "immediate"] as const) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      let answers: Record<string, any> = { qa: true };
      let states: any[] = [];
      let failNextConfirmation = mode === "batch";
      const writes: Array<{ path: string; body: any }> = [];
      const item = { id: "step", stepId: "step", label: "Execution test step", itemType: "step",
        confirmationType: "manual", questionSelectionMode: "multiple", isHidden: false, automations: [],
        questions: [
          { id: "qa", questionText: "Choice A", fieldType: "radio", groupName: "group", logicOperator: "ONE", sortOrder: 0 },
          { id: "qb", questionText: "Choice B", fieldType: "radio", groupName: "group", logicOperator: "ONE", sortOrder: 1 },
        ] };
      await page.route("**/api/**", async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        const method = request.method();
        const json = (value: any) => route.fulfill({ json: value });
        if (path === "/api/auth/me") return json({ user: { id: "agent-1", username: "test", fullName: "Test Agent", role: "agent", assignedCountries: ["SK"] } });
        if (path.endsWith("/status-list") && method === "GET") return json([item]);
        if (path.endsWith("/status-list-state") && method === "GET") return json(states);
        if (path.endsWith("/status-list-workflows") && method === "GET") return json({ answers, catalog: [], runs: [], transitions: [], notes: {}, executionIssues: [] });
        if (method === "POST" || method === "PUT" || method === "PATCH") {
          const body = request.postDataJSON();
          writes.push({ path, body });
          if (path.endsWith("/status-list-workflows/answers")) {
            for (const change of body.changes) answers[change.questionId] = change.value;
            return json({ ok: true, saved: true, serviceActions: [] });
          }
          if (path.endsWith("/status-list-state/step")) {
            states = body.confirm ? [{ id: "state", campaignContactId: "campaign-contact-1", statusListItemId: "step", confirmedAt: new Date().toISOString() }] : [];
            if (failNextConfirmation) { failNextConfirmation = false; return route.abort("failed"); }
            return json({ ok: true, confirmed: body.confirm, actionResults: [] });
          }
          return json({ ok: true });
        }
        if (path.endsWith("/status-list-rules")) return json([]);
        return json([]);
      });
      await page.goto(`${base}/test-fixtures/pulse-status-notes.html?mode=${mode}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await expect(page.getByTestId("btn-sl-q-qb")).toBeVisible({ timeout: 30_000 }).catch(async error => {
        console.error(JSON.stringify({ errors, body: (await page.locator("body").innerText()).slice(0, 3000) }));
        await page.screenshot({ path: `generated-artifacts/status-list-execution/${mode}-failure.png` });
        throw error;
      });
      await page.getByTestId("btn-sl-q-qb").click();
      if (mode === "batch") {
        assert.equal(writes.length, 0, "answer selection must not write before Save");
        await page.getByTestId("sl-check-step").click();
        assert.equal(writes.length, 0, "step selection must not write before Save");
        // Real query invalidation must not erase the draft.
        await page.evaluate(async () => {
          const { queryClient } = await import("/src/lib/queryClient.ts");
          await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", "campaign-1", "contacts", "campaign-contact-1", "status-list-state"] });
        });
        await page.getByTestId("btn-sl-batch-save").click();
        const confirm = page.getByTestId("btn-sl-batch-save-confirm");
        await confirm.click();
        await expect.poll(() => writes.filter(write => write.path.endsWith("/status-list-state/step")).length).toBe(1);
        const firstAnswers = writes.find(write => write.path.endsWith("/answers"))!;
        assert.deepEqual(firstAnswers.body.changes, [
          { questionId: "qa", expected: true, value: null }, { questionId: "qb", expected: null, value: true },
        ]);
        // Retry the same still-open save after the first response was lost.
        await expect(confirm).toBeEnabled();
        await confirm.click();
        await expect.poll(() => writes.filter(write => write.path.endsWith("/status-list-state/step")).length).toBe(2);
        const confirmations = writes.filter(write => write.path.endsWith("/status-list-state/step"));
        assert.equal(confirmations[0].body.requestId, confirmations[1].body.requestId);
        assert.equal(writes.filter(write => write.path.endsWith("/answers")).length, 1, "already saved answers must not be replayed");
        for (const write of writes) {
          assert.equal(write.body.executionMode, "batch");
          assert.equal(write.body.commit, true);
          assert.equal(write.body.skipAutomations, undefined, "Batch must not suppress configured actions");
        }
        await expect(confirm).not.toBeVisible();
      } else {
        await expect.poll(() => writes.filter(write => write.path.endsWith("/answers")).length).toBe(1);
        assert.deepEqual(writes[0].body.changes, [
          { questionId: "qa", expected: true, value: null }, { questionId: "qb", expected: null, value: true },
        ]);
        assert.equal(writes[0].body.executionMode, "immediate");
        await expect(page.getByTestId("sl-check-step")).toBeEnabled();
        await page.getByTestId("sl-check-step").click();
        await expect.poll(() => writes.some(write => write.path.endsWith("/status-list-state/step"))).toBe(true);
      }
      await expect(page.getByTestId("btn-sl-q-qa")).not.toHaveClass(/bg-primary/);
      await expect(page.getByTestId("btn-sl-q-qb")).toHaveClass(/bg-primary/);
      await page.getByTestId("status-list-execution-help").click();
      await expect(page.getByRole("dialog")).toContainText(/Immediate/);
      await expect(page.getByRole("dialog")).toContainText(/Batch/);
      await page.screenshot({ path: `generated-artifacts/status-list-execution/${mode}-desktop.png`, fullPage: false });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `generated-artifacts/status-list-execution/${mode}-narrow.png`, fullPage: false });
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); await server.close(); }
});
