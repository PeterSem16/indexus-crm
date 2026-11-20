"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), vm = require("node:vm");
const { runThreeLiveSummaries, browserScript } = require("./live-mailbox-three-summaries.cjs");
function harness(options = {}) {
  const posts = [], calls = [], polls = new Map(), jobs = new Map(), prompts = [], histories = new Map();
  const window = {
    prompt: (question, value) => {
      prompts.push(question);
      if (options.cancel) return null;
      if (question.startsWith("Jazyk")) return options.language || "sk";
      if (question.startsWith("Číslo")) return options.mailboxChoice || value;
      return options.selection || value;
    },
    confirm: () => !options.decline,
  };
  let configReads = 0, active = 0, maxActive = 0;
  const messages = Array.from({ length: options.tooFew ? 2 : 5 }, (_, i) => ({
    id: "real-fixture-message-" + i, subject: "Source " + i,
    body: { content: "<p>Actual saved fixture source " + i + "</p>" },
    from: { emailAddress: { name: "Fixture sender" } }, receivedDateTime: "2026-11-20T12:00:00Z",
  }));
  const reply = (value, status = 200) => ({ status, json: async () => {
    if (options.badJSON && status === 202) throw Error("invalid JSON"); return value;
  } });
  const job = (n, emailId, status) => ({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-" + String(n).padStart(12, "0"),
    service: "email.summary", entityType: "email", entityId: emailId, status,
    attempts: status === "pending" ? 0 : options.extraAttempt ? 2 : 1,
    result: status === "completed" ? { summary: options.emptyResult ? "" : "<p>Saved source summary.</p>" } : null,
    errorCode: status === "failed" ? "ai_timeout" : null,
    metrics: { queueMs: 10, gatewayMs: 50, requestId: "fixture-request" },
  });
  const fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method || "GET" });
    if (init.method === "POST") {
      assert.equal(url, "/api/users/signed-in-user/ms365-ai-summary");
      const body = JSON.parse(init.body); posts.push(body);
      assert.deepEqual(Object.keys(body).sort(), ["emailId", "language", "mailbox"]);
      active++; maxActive = Math.max(active, maxActive); await Promise.resolve(); active--;
      if (options.transport) throw Error("uncertain submission");
      const n = options.duplicateJob ? 1 : posts.length, row = job(n, body.emailId, "pending");
      jobs.set(row.id, row);
      return reply({ job: options.wrongIdentity ? { ...row, entityId: "different" } : row,
        jobId: row.id }, options.status || 202);
    }
    assert.equal(init.method, undefined);
    if (url === "/api/auth/me") return reply({ user: { id: "signed-in-user" } });
    if (url === "/api/configurator/ai") {
      configReads++;
      return reply({
        version: options.changed && configReads > 1 ? 17 : 16,
        runtime: { mode: "routed", production: !options.dev, replit: false, serverAllowed: true },
        gateway: { enabled: true }, queue: { ready: !options.noWorker },
        services: [{ id: "email.summary", route: {
          provider: options.openai ? "openai" : "internal", enabled: true, model: "Solaris",
        } }],
      });
    }
    if (url === "/api/configurator/ai/maintenance") return reply({
      mode: options.paused ? "paused" : "running", version: 0,
      workers: { alive: 1, unsupported: 0, confirmed: options.unconfirmed ? 0 : 1 },
    });
    if (url.endsWith("/ms365-available-mailboxes")) return reply([
      { id: "personal", email: "personal@fixture.invalid", type: "personal", isDefault: true },
      ...(options.shared ? [{ id: "shared-id", email: "shared@fixture.invalid", type: "shared" }] : []),
    ]);
    if (url.includes("/ms365-recent-emails?")) {
      const mailbox = new URL(url, "https://fixture.invalid").searchParams.get("mailbox");
      assert.equal(mailbox, options.shared && options.mailboxChoice === "2" ? "shared@fixture.invalid" : "personal");
      return reply({ connected: !options.disconnected, emails: messages });
    }
    if (url.startsWith("/api/ai/jobs?")) {
      const p = new URL(url, "https://fixture.invalid").searchParams, id = p.get("entityId");
      assert.equal(p.get("service"), "email.summary");
      const reads = (histories.get(id) || 0) + 1; histories.set(id, reads);
      const existing = options.existing || options.oneExisting && id.endsWith("-1") ||
        options.race && id.endsWith("-0") && reads > 2;
      return reply({ jobs: existing ? [{ id: "prior-job" }] : [] });
    }
    if (url.startsWith("/api/ai/jobs/")) {
      const id = url.split("/").pop(), current = jobs.get(id); assert(current);
      const count = (polls.get(id) || 0) + 1; polls.set(id, count);
      return reply({ job: job(Number(id.slice(-12)), current.entityId,
        options.failed ? "failed" : count === 1 ? "processing" : "completed") });
    }
    throw Error("UNEXPECTED_ENDPOINT:" + url);
  };
  const context = vm.createContext({ window, fetch, URLSearchParams,
    setTimeout: callback => queueMicrotask(callback),
    console: { log() {}, table() {}, error() {} } });
  if (options.timeout) {
    let tick = 0;
    context.Date = class extends Date { static now() { return tick += 16 * 60_000; } };
  }
  const run = vm.runInContext("(" + runThreeLiveSummaries.toString() + ")", context);
  return { posts, calls, window, prompts, context, maxActive: () => maxActive,
    run: () => run(), messages };
}
test("three actual saved IDs produce three sequential asynchronous summaries, not synthetic bodies", async () => {
  const h = harness(), r = await h.run();
  assert.equal(r.status, "three_live_summaries_completed_review_pending");
  assert.equal(h.posts.length, 3); assert.equal(h.maxActive(), 1);
  assert.deepEqual(h.posts.map(p => p.emailId), h.messages.slice(0, 3).map(m => m.id));
  assert(h.posts.every(p => p.mailbox === "personal@fixture.invalid" && p.language === "sk"));
  assert(r.results.every(row => row.status === "completed" && row.job.attempts === 1 &&
    row.source.emailBody.startsWith("Actual saved fixture") && row.job.metrics.requestId === "fixture-request"));
  assert(h.calls.filter(c => c.method !== "GET").every(c => c.method === "POST" && c.url.endsWith("/ms365-ai-summary")));
  assert(!h.calls.some(c => /\/retry|\/ms365-email\/|send|draft|\/route|\/test$/.test(c.url)));
  await assert.rejects(h.run(), /TEST_ALREADY_STARTED/);
});
for (const option of ["cancel", "decline", "dev", "noWorker", "openai", "paused", "unconfirmed",
  "changed", "existing", "tooFew", "disconnected", "race"]) {
  test("no inference when " + option, async () => {
    const h = harness({ [option]: true }), r = await h.run();
    assert.equal(r.status, "stopped_do_not_repeat"); assert.equal(h.posts.length, 0);
  });
}
for (const selection of ["1,1,2", "0,1,2", "1,2,99", "1,2", "1.0,2,3", "1,2,3,4"]) {
  test("invalid message selection is rejected: " + selection, async () => {
    const h = harness({ selection }), r = await h.run();
    assert.equal(r.status, "stopped_do_not_repeat"); assert.equal(h.posts.length, 0);
  });
}
test("selecting an already summarized message is rejected, not retried or overwritten", async () => {
  const h = harness({ oneExisting: true, selection: "1,2,3" }), r = await h.run();
  assert.equal(r.status, "stopped_do_not_repeat"); assert.equal(h.posts.length, 0);
});
for (const options of [{ transport: true }, { status: 200 }, { status: 503 }, { badJSON: true },
  { wrongIdentity: true }, { extraAttempt: true }, { failed: true }, { emptyResult: true }]) {
  test("failure retains the attempted message and never retries: " + JSON.stringify(options), async () => {
    const h = harness(options), r = await h.run();
    assert.equal(r.status, "stopped_do_not_repeat"); assert.equal(h.posts.length, 1);
    assert.equal(r.results.length, 1); assert(r.current.observerStoppedAt);
  });
}
test("duplicate returned job identity blocks the third submission", async () => {
  const h = harness({ duplicateJob: true }), r = await h.run();
  assert.equal(r.status, "stopped_do_not_repeat"); assert.equal(h.posts.length, 2);
});
test("observer timeout retains the pending job and never cancels, resubmits or retries it", async () => {
  const h = harness({ timeout: true }), r = await h.run();
  assert.equal(r.error, "OBSERVER_TIMEOUT_JOB_NOT_CANCELLED_DO_NOT_REPEAT");
  assert.equal(h.posts.length, 1); assert.equal(r.current.job.status, "pending");
  assert(r.current.jobId); assert(!h.calls.some(c => /cancel|retry/.test(c.url)));
});
test("selected shared mailbox stays bound to the signed-in user", async () => {
  const h = harness({ shared: true, mailboxChoice: "2" }), r = await h.run();
  assert.equal(r.status, "three_live_summaries_completed_review_pending");
  assert(h.posts.every(p => p.mailbox === "shared@fixture.invalid"));
});
test("all seven existing language codes are accepted without multiplying the three requested emails", async () => {
  for (const language of ["sk", "cs", "en", "hu", "ro", "it", "de"]) {
    const h = harness({ language }), r = await h.run();
    assert.equal(r.results.length, 3); assert(h.posts.every(p => p.language === language));
  }
});
test("the exact generated F12 script parses and runs in a browser context", async () => {
  const h = harness(); await vm.runInContext(browserScript(), h.context);
  assert.equal(h.window.indexusThreeLiveSummaries.results.length, 3);
});
