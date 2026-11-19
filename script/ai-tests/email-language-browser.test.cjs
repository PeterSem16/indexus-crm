"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), vm = require("node:vm");
const { runInBrowser, casesFor } = require("./email-language-matrix.cjs");
function harness(options = {}) {
  const posts = [], state = {}, logs = [], calls = [];
  let active = 0, maxActive = 0, reads = 0;
  const config = () => ({ version: options.changed && reads > 1 ? 2 : 1,
    runtime: { mode: "routed" }, gateway: { enabled: true },
    services: ["email.reply", "email.compose", "email.translation"].map(id => ({
      id, route: { enabled: true, provider: options.external ? "openai" : "internal", model: "synthetic-model" },
    })) });
  const fetch = async (url, init) => {
    calls.push(url);
    if (init.method !== "POST") {
      if (url === "/api/auth/me") return { status: 200, json: async () => ({ user: { id: "synthetic-user" } }) };
      reads++; return { status: 200, json: async () => config() };
    }
    active++; maxActive = Math.max(maxActive, active); posts.push({ url, body: JSON.parse(init.body) });
    await Promise.resolve(); active--;
    if (options.failure) throw Error("synthetic transport failure");
    return { status: options.status || 200, json: async () => ({
      suggestion: "<p>Synthetic receipt.</p>", translated: "<p>24 November 2026, 10:30.</p>",
      draft: "<p>Hello.</p><p>Send materials.</p><p>Thank you.</p>",
    }) };
  };
  const run = vm.runInNewContext("(" + runInBrowser.toString() + ")", {
    window: state, fetch, performance: { now: () => 0 },
    console: { log: row => logs.push(row), table() {} },
  });
  return { state, posts, calls, maxActive: () => maxActive,
    run: () => run(casesFor()) };
}
test("browser matrix issues 21 serial synthetic POSTs, never sends mail or claims language quality", async () => {
  const h = harness(), results = await h.run();
  assert.equal(results.length, 21); assert.equal(h.posts.length, 21); assert.equal(h.maxActive(), 1);
  assert(h.posts.every(x => /\/ms365-ai-(translate|suggest-reply|compose)$/.test(x.url)));
  assert(results.every(x => x.formatOK && x.numericFactsOK && !x.languageAndMeaningVerified));
  await assert.rejects(h.run(), /TEST_ALREADY_STARTED/); assert.equal(h.posts.length, 21);
});
test("external provider stops the entire matrix before inference", async () => {
  const h = harness({ external: true }); await assert.rejects(h.run(), /INTERNAL_SERVICE_REQUIRED/);
  assert.equal(h.posts.length, 0);
});
test("settings changed between admission checks stop before a POST", async () => {
  const h = harness({ changed: true }); await assert.rejects(h.run(), /SETTINGS_CHANGED/);
  assert.equal(h.posts.length, 0);
});
for (const options of [{ failure: true }, { status: 502 }, { status: 202 }]) {
  test("uncertain or failed inference is never automatically retried: " + JSON.stringify(options), async () => {
    const h = harness(options); await assert.rejects(h.run()); assert.equal(h.posts.length, 1);
    assert.equal(h.state.indexusAILanguageResults.length, 0);
  });
}
