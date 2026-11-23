"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), vm = require("node:vm");
const source = fs.readFileSync(require.resolve("./three-emails-f12.js"), "utf8");
async function fixture(options = {}) {
  const posts = [], window = { indexusEmailTest: options.previous,
    prompt: text => text.startsWith("Číslo") ? "1" : "sk",
    confirm: () => options.confirm !== false };
  const config = { version: 1, runtime: { mode: "routed", production: true, replit: false, serverAllowed: true },
    gateway: { enabled: true }, queue: { ready: true },
    services: [{ id: "email.summary", route: { provider: "internal", enabled: true, model: "unchanged" } }] };
  const emails = Array.from({ length: 6 }, (_, i) => ({ id: "email-" + i, subject: "Synthetic " + i }));
  const fetch = async (url, init = {}) => {
    const u = new URL(url, "https://example.invalid");
    let body;
    if (u.pathname === "/api/auth/me") body = { user: { id: "synthetic-user" } };
    else if (u.pathname === "/api/configurator/ai") body = config;
    else if (u.pathname.endsWith("/maintenance")) body = {
      mode: "running", version: 1, workers: { alive: 1, unsupported: 0, confirmed: 1 } };
    else if (u.pathname.endsWith("/ms365-available-mailboxes")) body = [{ id: "personal", email: "test@example.invalid" }];
    else if (u.pathname.endsWith("/ms365-recent-emails")) body = { connected: true, emails };
    else if (u.pathname === "/api/ai/jobs") body = { jobs:
      (options.allUsed || u.searchParams.get("entityId") === "email-0") ? [{ status: "failed" }] : [] };
    else if (u.pathname.endsWith("/ms365-ai-summary")) {
      assert.equal(init.method, "POST");
      const request = JSON.parse(init.body); posts.push(request);
      if (options.uncertain) throw Error("synthetic ambiguous acceptance");
      const id = "11111111-1111-4111-8111-" + String(posts.length).padStart(12, "0");
      return { status: 202, json: async () => ({ jobId: id, job: {
        id, service: "email.summary", entityType: "email", entityId: request.emailId,
        attempts: 1, status: "completed", result: { summary: "<p>Synthetic result</p>" } } }) };
    } else throw Error("Unexpected endpoint");
    return { status: 200, json: async () => body };
  };
  await vm.runInNewContext(source, { window, fetch, URLSearchParams, setTimeout,
    console: { log() {}, table() {}, error() {} } });
  return { window, posts };
}
test("skips prior jobs and admits exactly three fresh emails with unchanged route", async () => {
  const f = await fixture();
  assert.deepEqual(f.posts.map(p => p.emailId), ["email-1", "email-2", "email-3"]);
  assert.equal(f.window.indexusEmailTest.status, "completed_review_pending");
});
test("the screenshot's stopped empty run can proceed without clearing state", async () => {
  const f = await fixture({ previous: { status: "stopped_do_not_repeat", results: [],
    mailbox: "test@example.invalid", language: "sk" } });
  assert.equal(f.posts.length, 3);
});
test("a run that may have submitted a request cannot be overwritten or replayed", async () => {
  await assert.rejects(fixture({ previous: { status: "stopped_do_not_repeat", results: [{}] } }),
    /Generovanie neopakujem/);
});
test("cancellation and an insufficient fresh set never submit a request", async () => {
  assert.equal((await fixture({ confirm: false })).posts.length, 0);
  assert.equal((await fixture({ allUsed: true })).posts.length, 0);
});
test("ambiguous acceptance stops after one POST and retains its guard", async () => {
  const f = await fixture({ uncertain: true });
  assert.equal(f.posts.length, 1); assert.equal(f.window.indexusEmailTest.results.length, 1);
  assert.equal(f.window.indexusEmailTest.status, "stopped_do_not_repeat");
});
