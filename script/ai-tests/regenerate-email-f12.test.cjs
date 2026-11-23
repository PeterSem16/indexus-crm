"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), vm = require("node:vm");
const source = fs.readFileSync(require.resolve("./regenerate-email-f12.js"), "utf8");
const parentId = "11111111-1111-4111-8111-111111111111";
const childId = "22222222-2222-4222-8222-222222222222";
async function fixture(options = {}) {
  const calls = [], logs = [];
  const parent = { id: parentId, service: "email.summary", entityType: "email",
    entityId: "synthetic-message", status: "completed", attempts: 1, result: { summary: "<p>Old synthetic text.</p>" } };
  const child = { ...parent, id: childId, result: { summary: "<p>New synthetic text.</p>" } };
  const window = { prompt: () => parentId, confirm: () => options.confirm !== false,
    indexusEmailRegeneration: options.previous };
  let reads = 0;
  const fetch = async (url, init = {}) => {
    const method = init.method || "GET";
    calls.push({ url, method, body: init.body });
    assert(method === "GET" || method === "POST" && url === `/api/ai/jobs/${parentId}/regeneration`);
    let body;
    if (url === `/api/ai/jobs/${parentId}`) {
      reads++;
      body = { job: reads > 1 && options.parentChanged ? { ...parent, result: {} } : parent };
    } else if (url.endsWith("/regeneration")) {
      if (options.notDeployed) return { status: 404 };
      if (method === "POST" && options.uncertain) throw Error("Synthetic lost response");
      body = { sourceJobId: parentId, jobId: method === "POST" || options.existing ? childId : null,
        job: method === "POST" || options.existing ? { ...child,
          ...(options.failed ? { status: "failed", errorCode: "synthetic_failure" } : {}),
          ...(options.wrongIdentity ? { entityId: "other-message" } : {}),
          ...(options.pending ? { status: "pending", attempts: 0, result: null } : {}),
        } : null };
    } else if (url === `/api/ai/jobs/${childId}`) body = { job: child };
    else if (url === "/api/configurator/ai") body = {
      version: 1, runtime: { mode: "routed", production: true, replit: false, serverAllowed: true },
      gateway: { enabled: true }, queue: { ready: true },
      services: [{ id: "email.summary", route: { provider: options.disabled ? "openai" : "internal", enabled: true, model: "unchanged" } }],
    };
    else if (url.endsWith("/maintenance")) body = {
      mode: "running", version: 1, workers: { alive: 1, unsupported: 0, confirmed: 1 },
    };
    else throw Error("Unexpected endpoint");
    return { status: method === "POST" ? 202 : 200, json: async () => body };
  };
  await vm.runInNewContext(source, { window, fetch, setTimeout: fn => fn(),
    console: { log: (...args) => logs.push(args), error() {}, table() {} } });
  return { run: window.indexusEmailRegeneration, calls, logs };
}
test("one explicit POST targets the exact source and retains separate old and new results", async () => {
  const f = await fixture();
  assert.equal(f.run.status, "completed_review_pending");
  assert.equal(f.run.original.id, parentId); assert.equal(f.run.jobId, childId);
  assert.deepEqual(f.calls.filter(c => c.method === "POST"), [
    { url: `/api/ai/jobs/${parentId}/regeneration`, method: "POST", body: "{}" },
  ]);
});
test("a completed or pending existing child resumes through GET only, even after a page refresh", async () => {
  for (const pending of [false, true]) {
    const f = await fixture({ existing: true, pending });
    assert.equal(f.run.resumed, true);
    assert.equal(f.run.status, "completed_review_pending");
    assert(f.calls.every(c => c.method === "GET"));
  }
});
test("old deployments, cancellation and disabled routing cannot submit a new generation", async () => {
  for (const options of [{ notDeployed: true }, { confirm: false }, { disabled: true }]) {
    const f = await fixture(options);
    assert.equal(f.run.status, "stopped_review_required");
    assert(f.calls.every(c => c.method === "GET"));
  }
});
test("ambiguous acceptance never automatically repeats the POST", async () => {
  const f = await fixture({ uncertain: true });
  assert.equal(f.run.status, "stopped_review_required");
  assert.equal(f.run.postAttempted, true);
  assert.equal(f.calls.filter(c => c.method === "POST").length, 1);
});
test("failed children, mismatched identities and changes to the original are explicit failures", async () => {
  for (const options of [{ existing: true, failed: true }, { wrongIdentity: true }, { parentChanged: true }])
    assert.equal((await fixture(options)).run.status, "stopped_review_required");
});
test("a second concurrent script cannot replace the first run's observation", async () => {
  await assert.rejects(fixture({ previous: { status: "running" } }), /Test už beží/);
});
