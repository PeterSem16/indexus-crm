"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), vm = require("node:vm");
const { runThreeLiveSummaries, browserScript } = require("./live-mailbox-three-summaries.cjs");
function harness(options = {}) {
  const posts = [], writes = [], calls = [], polls = new Map(), jobs = new Map(), prompts = [], histories = new Map();
  const window = {
    prompt: (question, value) => {
      prompts.push(question);
      if (options.cancel) return null;
      if (question.startsWith("Jazyk")) return options.language || "sk";
      if (question.startsWith("Číslo")) return options.mailboxChoice || value;
      return options.selection || value;
    },
    confirm: () => !options.decline,
    addEventListener() {}, removeEventListener() {},
  };
  let configReads = 0, active = 0, maxActive = 0;
  let version = 16, route = { provider: "openai", model: null, enabled: true }, smoke;
  if (options.freshSmoke) smoke = { state: "ready", kind: "smoke", settingsVersion: 16,
    textVerified: true, jsonVerified: true, checkedAt: new Date().toISOString(),
    models: [{ id: "indexus-ai-solaris:v1", outputFormats: ["text", "json_object"], maxOutputTokens: 8192 }] };
  const config = () => ({
    version: options.changed && configReads > 1 ? version + 1 :
      options.foreign && posts.length ? version + 1 : version,
    runtime: { mode: "routed", production: !options.dev, replit: false, serverAllowed: true },
    gateway: { enabled: true }, queue: { ready: !options.noWorker },
    gatewayCheck: smoke,
    services: [{ id: "email.summary", internalEligible: true, models: ["indexus-ai-solaris:v1"],
      route: options.temporaryWindow ? route : {
        provider: options.openai ? "openai" : "internal", enabled: true, model: "Solaris" } },
    { id: "email.reply", route: { provider: "internal", model: "preserved-model", enabled: true } }],
  });
  const messages = Array.from({ length: options.tooFew ? 2 : 5 }, (_, i) => ({
    id: "real-fixture-message-" + i, subject: "Source " + i,
    body: { content: "<p>Actual saved fixture source " + i + "</p>" },
    from: { emailAddress: { name: "Fixture sender" } }, receivedDateTime: "2026-11-20T12:00:00Z",
  }));
  const reply = (value, status = 200) => ({ status, json: async () => {
    if (options.badJSON && status === 202) throw Error("invalid JSON");
    return JSON.parse(JSON.stringify(value));
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
    if (["/api/configurator/ai/test", "/api/configurator/ai/route"].includes(url) && init.method) {
      const body = JSON.parse(init.body); writes.push({ url, method: init.method, body });
      assert.equal(body.expectedVersion, version);
      if (url.endsWith("/test")) {
        assert.equal(init.method, "POST"); assert.equal(body.kind, "smoke");
        if (options.smokeTransport) throw Error("uncertain smoke");
        smoke = { state: options.smokeFail ? "failed" : "ready", kind: "smoke", settingsVersion: version,
          textVerified: true, jsonVerified: true, checkedAt: new Date().toISOString(),
          models: [{ id: "indexus-ai-solaris:v1", outputFormats: ["text", "json_object"], maxOutputTokens: 8192 }] };
      } else {
        assert.equal(init.method, "PUT"); assert.equal(body.service, "email.summary");
        const restoring = body.route.provider === "openai";
        if (restoring && options.restoreConflict) return reply({ code: "version_conflict" }, 409);
        if (!restoring) assert.equal(body.confirmInternal, true);
        route = body.route; version++;
        if (restoring ? options.restoreLostAck : options.switchLostAck) throw Error("uncertain route write");
        if (!restoring && options.badSwitchReadback) return reply({ ...config(), version: 123 });
      }
      return reply(config());
    }
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
      return reply(config());
    }
    if (url === "/api/configurator/ai/maintenance") return reply({
      mode: options.paused || options.pauseDuringRun && posts.length ? "paused" : "running",
      version: (options.pauseDuringRun || options.maintenanceChanged) && posts.length ? 1 : 0,
      workers: { alive: 1, unsupported: 0, confirmed: options.unconfirmed ? 0 : 1 },
      queues: {
        jobs: { pending: [...jobs.values()].filter(j => j.status === "pending").length,
          processing: [...jobs.values()].filter(j => j.status === "processing").length },
        inference: { pending: options.busyRestore && posts.length >= 3 ? 1 : 0,
          processing: options.busyBefore ? 1 : 0 },
      },
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
      const next = job(Number(id.slice(-12)), current.entityId,
        options.pendingForever ? "pending" : options.failed ? "failed" : count === 1 ? "processing" : "completed");
      jobs.set(id, next); return reply({ job: next });
    }
    throw Error("UNEXPECTED_ENDPOINT:" + url);
  };
  const context = vm.createContext({ window, fetch, URLSearchParams,
    setTimeout: callback => queueMicrotask(callback),
    console: { log() {}, table() {}, error() {} } });
  if (options.timeout || options.pendingForever || options.busyRestore) {
    let tick = 0;
    context.Date = class extends Date { static now() {
      const advance = options.busyRestore
        ? posts.length === 3 && [...jobs.values()].every(j => j.status === "completed")
        : posts.length > 0;
      return Date.now() + (advance ? tick += 16 * 60_000 : 0);
    } };
  }
  const run = vm.runInContext("(" + runThreeLiveSummaries.toString() + ")", context);
  return { posts, writes, calls, window, prompts, context, maxActive: () => maxActive,
    run: () => run({ temporaryWindow: options.temporaryWindow === true }), messages,
    currentRoute: () => route, version: () => version };
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
test("temporary window refreshes smoke, switches only summary, performs three jobs and verifies OpenAI restoration", async () => {
  const h = harness({ temporaryWindow: true }), r = await h.run();
  assert.equal(r.status, "three_live_summaries_completed_openai_restored");
  assert.equal(r.restoreStatus, "restored_verified"); assert.equal(h.posts.length, 3);
  assert.deepEqual(h.writes.map(w => [w.method, w.url]), [
    ["POST", "/api/configurator/ai/test"], ["PUT", "/api/configurator/ai/route"], ["PUT", "/api/configurator/ai/route"],
  ]);
  assert.deepEqual(h.writes[1].body, { expectedVersion: 16, service: "email.summary",
    route: { provider: "internal", model: "indexus-ai-solaris:v1", enabled: true }, confirmInternal: true });
  assert.deepEqual(h.writes[2].body, { expectedVersion: 17, service: "email.summary",
    route: { provider: "openai", model: null, enabled: true } });
  assert.deepEqual(h.currentRoute(), { provider: "openai", model: null, enabled: true });
  assert.equal(h.version(), 18); assert.equal(r.gatewayDrain, "unverified");
});
for (const option of ["cancel", "decline", "busyBefore", "smokeFail", "smokeTransport"]) {
  test("temporary window never switches or summarizes when " + option, async () => {
    const h = harness({ temporaryWindow: true, [option]: true }), r = await h.run();
    assert.equal(h.posts.length, 0); assert.equal(h.writes.filter(w => w.method === "PUT").length, 0);
    assert.equal(h.currentRoute().provider, "openai"); assert.equal(r.restoreStatus, "not_switched");
  });
}
for (const option of ["switchLostAck", "badSwitchReadback"]) {
  test("uncertain route switch is never retried or blindly restored: " + option, async () => {
    const h = harness({ temporaryWindow: true, [option]: true }), r = await h.run();
    assert.equal(r.status, "manual_verification_required"); assert.equal(h.posts.length, 0);
    assert.equal(h.writes.filter(w => w.method === "PUT").length, 1);
  });
}
for (const option of ["transport", "badJSON", "wrongIdentity", "foreign", "pauseDuringRun", "maintenanceChanged", "pendingForever", "busyRestore"]) {
  test("unsafe temporary window state prevents forced restoration: " + option, async () => {
    const h = harness({ temporaryWindow: true, [option]: true }), r = await h.run();
    assert.equal(r.restoreStatus, "manual_verification_required");
    assert.equal(h.writes.filter(w => w.method === "PUT").length, 1);
    assert.equal(h.currentRoute().provider, "internal");
    assert(!h.calls.some(c => /retry|cancel|\/maintenance.*PUT/.test(c.url)));
  });
}
test("a known failed job is not retried, and OpenAI is restored after terminal-state checks", async () => {
  const h = harness({ temporaryWindow: true, failed: true }), r = await h.run();
  assert.equal(r.status, "test_stopped_original_route_restored"); assert.equal(h.posts.length, 1);
  assert.equal(r.restoreStatus, "restored_verified"); assert.equal(h.currentRoute().provider, "openai");
});
test("lost restoration acknowledgment is reported, never retried or falsely marked restored", async () => {
  const h = harness({ temporaryWindow: true, restoreLostAck: true }), r = await h.run();
  assert.equal(r.restoreStatus, "manual_verification_required");
  assert.equal(h.writes.filter(w => w.method === "PUT").length, 2);
  assert.equal(h.currentRoute().provider, "openai");
});
test("the complete generated temporary-window block runs without DevTools copy helpers", async () => {
  const h = harness({ temporaryWindow: true });
  await vm.runInContext(browserScript({ temporaryWindow: true }), h.context);
  assert.equal(h.window.indexusThreeLiveSummaries.restoreStatus, "restored_verified");
});
test("a still-valid smoke is reused without duplicate technical inference calls", async () => {
  const h = harness({ temporaryWindow: true, freshSmoke: true }), r = await h.run();
  assert.equal(r.restoreStatus, "restored_verified");
  assert.equal(h.posts.length, 3); assert.equal(h.writes.length, 2);
  assert(h.writes.every(w => w.method === "PUT"));
});
test("a restoration version conflict is not retried or falsely acknowledged", async () => {
  const h = harness({ temporaryWindow: true, restoreConflict: true }), r = await h.run();
  assert.equal(r.restoreStatus, "manual_verification_required");
  assert.equal(r.restoreError, "WINDOW_ROUTE_HTTP_409_DO_NOT_REPEAT");
  assert.equal(h.writes.filter(w => w.method === "PUT").length, 2);
});
