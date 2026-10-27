import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";
import { chromium } from "@playwright/test";

test("Status List sends UUID v4 commands on real HTTP and preserves retry/deduplication semantics", async () => {
  const source = await readFile("client/src/lib/status-list-execution-client.ts", "utf8");
  const { code } = await transform(source, { loader: "ts", format: "iife", globalName: "StatusListClient" });
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const commands: { path: string; body: any }[] = [];
    let loseFirstResponse = true;
    await page.route("http://status-list-test.invalid/**", async route => {
      if (route.request().method() !== "POST") {
        await route.fulfill({ contentType: "text/html", body: `<!doctype html><script>${code}</script>` });
        return;
      }
      const path = new URL(route.request().url()).pathname;
      commands.push({ path, body: route.request().postDataJSON() });
      if (path === "/retry" && loseFirstResponse) {
        loseFirstResponse = false;
        await route.abort("failed");
        return;
      }
      await route.fulfill({ status: path === "/forbidden" ? 403 : 200,
        json: path === "/forbidden" ? { error: "forbidden" } : { ok: true } });
    });
    await page.goto("http://status-list-test.invalid/");
    const result = await page.evaluate(async () => {
      const client = (window as any).StatusListClient.createStatusListExecutionClient();
      const environment = { secure: window.isSecureContext, randomUUID: typeof crypto.randomUUID };
      let transportFailed = false, authorizationFailed = false;
      try { await client.send("/retry", { confirm: true }, "batch", true); }
      catch { transportFailed = true; }
      await client.send("/retry", { confirm: true }, "batch", true);
      await client.send("/retry", { confirm: true }, "batch", true);
      client.clear();
      await client.send("/retry", { confirm: true }, "batch", true);
      await client.send("/immediate", {}, "immediate");
      await client.send("/immediate", {}, "immediate");
      try { await client.send("/forbidden", {}, "batch"); }
      catch (error) { authorizationFailed = (error as Error).message === "forbidden"; }
      return { ...environment, transportFailed, authorizationFailed };
    });
    assert.deepEqual(result, { secure: false, randomUUID: "undefined", transportFailed: true, authorizationFailed: true });
    assert.equal(commands.length, 6);
    for (const { body } of commands) {
      assert.match(body.requestId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
      assert.equal(body.commit, true);
    }
    assert.equal(commands[0].body.requestId, commands[1].body.requestId, "lost response reuses the same request ID");
    assert.notEqual(commands[1].body.requestId, commands[2].body.requestId, "clear starts a new intentional batch");
    assert.notEqual(commands[3].body.requestId, commands[4].body.requestId, "intentional immediate actions stay distinct");
    assert.equal(commands[0].body.executionMode, "batch");
    assert.equal(commands[3].body.executionMode, "immediate");
  } finally {
    await browser.close();
  }
});
