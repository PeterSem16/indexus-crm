"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), vm = require("node:vm");
const { runEmailPostDeploy, browserScript } = require("./email-post-deploy-browser.cjs");
const { casesFor } = require("./email-language-matrix.cjs");
function harness(options = {}) {
  const window = {}, posts = [], reads = [];
  let configReads = 0, active = 0, maxActive = 0;
  const fetch = async (url, init = {}) => {
    if (!init.method) {
      reads.push(url);
      if (url === "/api/auth/me") return { status: 200, json: async () => ({ user: { id: "synthetic-user" } }) };
      if (url.endsWith("/maintenance")) return { status: 200, json: async () => ({
        version: options.maintenanceChanged && configReads > 1 ? 1 : 0,
        mode: options.paused ? "paused" : "running",
        workers: { alive: 1, unsupported: 0, confirmed: options.unconfirmed ? 0 : 1 },
      }) };
      configReads++;
      return { status: options.unauthorized ? 401 : 200, json: async () => ({
        version: options.changed && configReads > 1 ? 17 : 16,
        runtime: { mode: "routed", production: !options.dev, replit: false, serverAllowed: true },
        gateway: { enabled: true }, queue: { ready: !options.noWorker },
        services: ["email.translation", "email.reply", "email.compose"].map(id => ({
          id, route: { enabled: true, provider: options.external ? "openai" : "internal", model: "Solaris" },
        })),
      }) };
    }
    assert.equal(init.method, "POST");
    assert.match(url, /^\/api\/users\/synthetic-user\/ms365-ai-(translate|suggest-reply|compose)$/);
    posts.push({ endpoint: url.split("/").pop(), body: JSON.parse(init.body) });
    active++; maxActive = Math.max(maxActive, active); await Promise.resolve(); active--;
    if (options.transport) throw Error("test transport failure");
    return { status: options.status || 200, json: async () => options.badShape ? {} : ({
      translated: "<p>24 November 2026, 10:30.</p>", suggestion: "<p>Receipt confirmed.</p>",
      draft: "<p>Hello.</p><p>Please send materials.</p><p>Thank you.</p>",
    }) };
  };
  const context = vm.createContext({ window, fetch, performance: { now: () => 0 },
    console: { log() {}, table() {}, error() {} } });
  const run = vm.runInContext("(" + runEmailPostDeploy.toString() + ")", context);
  return { window, posts, reads, context, maxActive: () => maxActive, run: () => run(casesFor()) };
}
test("exact original 21 inputs run sequentially without mail, routing or maintenance writes", async () => {
  const h = harness(), result = await h.run();
  assert.equal(result.status, "outputs_collected_review_pending");
  assert.deepEqual(h.posts, casesFor().map(({ endpoint, body }) => ({ endpoint, body })));
  assert.equal(h.maxActive(), 1);
  assert(result.results.every(r => r.model === "Solaris" && r.status === "completed" &&
    r.startedAt && r.finishedAt && r.formatOK && !r.languageAndMeaningVerified &&
    r.gatewayRequestId === null && r.gatewayOutputPath === null));
  assert(h.reads.every(url => ["/api/auth/me", "/api/configurator/ai",
    "/api/configurator/ai/maintenance"].includes(url)));
  await assert.rejects(h.run(), /TEST_ALREADY_STARTED/);
});
for (const option of ["dev", "noWorker", "paused", "unconfirmed", "external", "changed",
  "maintenanceChanged", "unauthorized"]) {
  test("preflight blocks inference for " + option, async () => {
    const h = harness({ [option]: true }), result = await h.run();
    assert.equal(result.status, "stopped_do_not_repeat"); assert.equal(h.posts.length, 0);
  });
}
for (const options of [{ transport: true }, { status: 202 }, { status: 502 }, { badShape: true }]) {
  test("uncertain outcome is retained without retry: " + JSON.stringify(options), async () => {
    const h = harness(options), result = await h.run();
    assert.equal(result.status, "stopped_do_not_repeat"); assert.equal(h.posts.length, 1);
    assert.equal(result.current.status, "outcome_unknown");
    assert(result.current.startedAt && result.current.observerStoppedAt);
  });
}
test("the delivered F12 script parses and runs in its browser context", async () => {
  const h = harness(); await vm.runInContext(browserScript(), h.context);
  assert.equal(h.window.indexusEmailPostDeploy.results.length, 21);
});
