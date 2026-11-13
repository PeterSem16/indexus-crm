"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const P = require("./ai-gateway-b4-pilot.cjs");
const catalog = [...fs.readFileSync("server/lib/ai/service-catalog.ts", "utf8")
  .matchAll(/^\s*"([a-z0-9_.]+)":\s*"(?:chat|transcription|speech|responses|chat_probe)",?\s*$/gm)].map(m => m[1]);
const state = () => ({ version: 5, value: { gateway: {
  enabled: false, baseURL: "https://ai.cordbloodcenter.com/gateway/",
  timeoutMs: 30000, maxRetries: 0, temperature: null, maxTokens: null,
}, routes: {} } });
const baseline = () => P.snapshot(state(), catalog);
function harness(overrides = {}) {
  let reads = 0, calls = 0, ticks = 0;
  const files = new Map();
  return {
    files, get reads() { return reads; }, get calls() { return calls; },
    options: {
      readSnapshot: async () => { reads++; return baseline(); },
      complete: async doc => { calls++; return JSON.stringify(doc.expected); },
      persist: async (name, value) => { assert(!files.has(name)); files.set(name, value); },
      clock: () => { ticks += 50; return ticks; },
      ...overrides,
    },
  };
}
test("ten fixed synthetic cases have valid expected schema; local defaults match admin effective routes", () => {
  assert.equal(catalog.length, 65);
  assert.equal(P.CORPUS.length, 10);
  assert.equal(new Set(P.CORPUS.map(d => d.id)).size, 10);
  for (const doc of P.CORPUS) {
    assert(doc.text.includes(doc.id));
    assert.match(doc.text, /SYNTET|SYNTHET/);
    assert.equal(P.evaluate(JSON.stringify(doc.expected), doc.expected).correct, 8);
    assert.equal(P.evaluate(JSON.stringify(doc.expected), doc.expected).schemaValid, true);
  }
  assert.equal(baseline().modelOverrides, 0);
});
test("baseline rejects enabled Gateway, internal/disabled/overridden/unknown routes and catalog drift", () => {
  const cases = [
    s => { s.value.gateway.enabled = true; },
    s => { s.value.gateway.baseURL = "http://wrong/"; },
    s => { s.value.routes["email.summary"] = { provider: "internal", model: null, enabled: true }; },
    s => { s.value.routes["email.summary"] = { provider: "openai", model: "custom", enabled: true }; },
    s => { s.value.routes["email.summary"] = { provider: "openai", model: null, enabled: false }; },
    s => { s.value.routes["email.summary"] = null; },
    s => { s.value.gateway.temperature = "0"; },
    s => { s.value.gateway.timeoutMs = -1; },
    s => { s.value.routes.unknown = {}; },
  ];
  for (const change of cases) { const s = state(); change(s); assert.throws(() => P.snapshot(s, catalog)); }
  assert.throws(() => P.snapshot(state(), catalog.slice(1)));
});
test("hashes cover saved representation, every Gateway parameter and version", () => {
  const original = state(), before = P.snapshot(original, catalog);
  const reordered = structuredClone(original);
  reordered.value.gateway = Object.fromEntries(Object.entries(reordered.value.gateway).reverse());
  assert(P.unchanged(before, P.snapshot(reordered, catalog)));
  const param = structuredClone(original); param.value.gateway.timeoutMs++;
  assert(!P.unchanged(before, P.snapshot(param, catalog)));
  const v = structuredClone(original); v.version++;
  assert(!P.unchanged(before, P.snapshot(v, catalog)));
  const explicit = structuredClone(original);
  explicit.value.routes["email.summary"] = { provider: "openai", model: null, enabled: true };
  assert.equal(before.routesSha256, P.snapshot(explicit, catalog).routesSha256);
  assert(!P.unchanged(before, P.snapshot(explicit, catalog)));
});
test("invalid JSON, missing fields, extra keys, wrong types and real dates are checked", () => {
  const doc = P.CORPUS[0];
  assert.equal(P.evaluate("```json\n{}\n```", doc.expected).jsonValid, false);
  for (const change of [
    x => { delete x.reference; }, x => { x.extra = true; },
    x => { x.total_amount = "120.50"; }, x => { x.issue_date = "2026-02-30"; },
    x => { x.customer_name = []; },
  ]) {
    const a = structuredClone(doc.expected); change(a);
    assert.equal(P.evaluate(JSON.stringify(a), doc.expected).schemaValid, false);
  }
  const duplicate = JSON.stringify(doc.expected).replace('{"document_id":',
    '{"document_id":"fake","document_id":');
  assert.equal(P.evaluate(duplicate, doc.expected).schemaValid, false);
  assert.equal(P.evaluate(duplicate, doc.expected).correct, 0);
});
test("null evidence distinguishes invented values, missing values and ordinary mismatches", () => {
  const doc = P.CORPUS[8], actual = { ...doc.expected, total_amount: 36, customer_name: "guessed",
    reference: null, issue_date: "2026-11-01" };
  const r = P.evaluate(JSON.stringify(actual), doc.expected);
  assert.deepEqual(r.unsupported, ["customer_name", "total_amount"]);
  assert.deepEqual(r.missing, ["reference"]);
  assert(r.wrong.includes("issue_date"));
});
test("perfect mocked pilot has ten sequential calls and exactly two DB reads; expected results never enter prompt", async () => {
  const h = harness();
  const report = await P.executePilot(h.options);
  assert.equal(h.calls, 10); assert.equal(h.reads, 2);
  assert.equal(report.summary.fieldAccuracyPercent, 100);
  assert.equal(report.summary.nonNullFieldAccuracyPercent, 100);
  assert.equal(report.summary.meanProcessingMs, 50);
  assert.equal(report.summary.recommendation, "CONTROLLED_HUMAN_REVIEW_PILOT_ONLY");
  assert.equal(report.status, "PASSED_SYNTHETIC_PILOT");
  assert(h.files.has("plan.json")); assert(h.files.has("before.json"));
  assert(h.files.has("report.json")); assert(h.files.has("report.md"));
});
test("baseline failure sends zero requests but still attempts final read and emits failure report", async () => {
  let reads = 0;
  const h = harness({ readSnapshot: async () => { reads++; throw new P.PilotError("B4_GATEWAY_MUST_BE_OFF"); } });
  const report = await P.executePilot(h.options);
  assert.equal(h.calls, 0); assert.equal(reads, 2);
  assert.equal(report.finalVerified, false); assert.equal(report.after, null);
  assert.equal(report.code, "B4_GATEWAY_MUST_BE_OFF");
});
test("authentication/transport failure stops without retry, includes not-run documents in denominator", async () => {
  let calls = 0;
  const h = harness({ complete: async () => { calls++; throw new P.PilotError("B4_HTTP_401"); } });
  const r = await P.executePilot(h.options);
  assert.equal(calls, 1); assert.equal(h.reads, 2);
  assert.equal(r.rows[9].code, "B4_NOT_RUN");
  assert.equal(r.summary.fieldAccuracyPercent, 0);
  assert.equal(r.summary.totalFields, 80); assert.equal(r.code, "B4_HTTP_401");
});
test("malformed document JSON is recorded, no retry, pilot continues and is not recommended", async () => {
  let calls = 0;
  const h = harness({ complete: async doc => ++calls === 1 ? "not JSON" : JSON.stringify(doc.expected) });
  const r = await P.executePilot(h.options);
  assert.equal(calls, 10); assert.equal(r.summary.validJson, 9);
  assert.equal(r.summary.fieldAccuracyPercent, 90);
  assert.equal(r.summary.recommendation, "NOT_READY_OR_INCOMPLETE");
});
test("configuration drift or unreadable final configuration cannot pass", async () => {
  for (const unreadable of [false, true]) {
    let reads = 0;
    const h = harness({ readSnapshot: async () => {
      if (++reads === 1) return baseline();
      if (unreadable) throw Error("RAW PRIVATE ERROR");
      return { ...baseline(), version: 6 };
    } });
    const r = await P.executePilot(h.options);
    assert.equal(r.finalVerified, false);
    assert.equal(r.status, "FAILED_OR_INCOMPLETE");
    assert(!JSON.stringify(r).includes("RAW PRIVATE ERROR"));
  }
});
test("signal/local filesystem failure performs final check and never sends next request", async () => {
  const h = harness({ stopped: () => true });
  const r = await P.executePilot(h.options);
  assert.equal(h.calls, 0); assert.equal(h.reads, 2); assert.equal(r.code, "B4_INTERRUPTED");
  const h2 = harness();
  const persist = h2.options.persist;
  h2.options.persist = async (name, value) => {
    if (name.startsWith("request-")) throw Error("disk full");
    await persist(name, value);
  };
  const r2 = await P.executePilot(h2.options);
  assert.equal(h2.calls, 0); assert.equal(h2.reads, 2);
  assert.equal(r2.code, "B4_LOCAL_OR_DATABASE_ERROR");
});
test("real request wrapper makes only one completion POST; never discovery or retry; no expected data", async () => {
  const previous = global.fetch; const calls = [];
  const token = "synthetic-test-token", doc = P.CORPUS[0];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ object: "chat.completion", model: P.MODEL,
      choices: [{ index: 0, finish_reason: "stop", message: {
        role: "assistant", content: JSON.stringify(doc.expected) } }] }),
    { headers: { "content-type": "application/json" } });
  };
  try {
    assert.equal(await P.requestCompletion(doc, token), JSON.stringify(doc.expected));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://ai.cordbloodcenter.com/gateway/v1/chat/completions");
    assert.equal(calls[0].options.redirect, "error");
    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.messages[1].content, doc.text);
    assert.equal(body.messages.length, 2);
    assert.deepEqual(body.response_format, { type: "json_object" });
    global.fetch = async () => new Response("private error", { status: 403 });
    await assert.rejects(P.requestCompletion(doc, token), { code: "B4_HTTP_403" });
    global.fetch = async () => { throw Error("private TLS detail"); };
    await assert.rejects(P.requestCompletion(doc, token), { code: "B4_TRANSPORT_ERROR" });
  } finally { global.fetch = previous; }
});
test("abort, truncation, wrong model and token echoes are safe fatal errors", async () => {
  const previous = global.fetch;
  const doc = P.CORPUS[0], token = "synthetic-test-token";
  try {
    for (const update of [
      b => { b.model = "other"; }, b => { b.choices[0].finish_reason = "length"; },
      b => { b.choices[0].message.content = token; },
    ]) {
      const body = { object: "chat.completion", model: P.MODEL,
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "{}" } }] };
      update(body);
      global.fetch = async () => Response.json(body);
      await assert.rejects(P.requestCompletion(doc, token), P.PilotError);
    }
    global.fetch = async (_url, { signal }) => {
      if (signal.aborted) throw new DOMException("abort", "AbortError");
      throw Error("expected aborted signal");
    };
    const controller = new AbortController(); controller.abort();
    await assert.rejects(P.requestCompletion(doc, token, controller.signal), { code: "B4_INTERRUPTED" });
  } finally { global.fetch = previous; }
});
test("configuration loading does not merge conflicting production credentials or expose them", () => {
  const env = { DATABASE_URL: "postgres://synthetic", INDEXUS_AI_GATEWAY_ENABLED: "true",
    INDEXUS_AI_GATEWAY_BASE_URL: "https://ai.cordbloodcenter.com/gateway/",
    INDEXUS_AI_GATEWAY_TOKEN: "synthetic-token", INDEXUS_AI_ROUTER_MODE: "routed", NODE_ENV: "production" };
  assert.equal(P.safeEnvironment(env, {}).NODE_ENV, "production");
  assert.throws(() => P.safeEnvironment(env, { DATABASE_URL: "other-secret" }),
    { code: "B4_ENVIRONMENT_CONFLICT" });
  assert.throws(() => P.safeEnvironment({ ...env, INDEXUS_AI_GATEWAY_TOKEN: "" }, {}),
    { code: "B4_TOKEN_NOT_CONFIGURED" });
});
test("operator entry point is an executable cjs, help is side-effect free, production guard blocks Replit", () => {
  const file = "script/ai-gateway-b4-pilot.cjs";
  const help = spawnSync(process.execPath, [file, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0); assert.match(help.stdout, /CORPCRM01/);
  const blocked = spawnSync(process.execPath, [file, "--run-b4"], {
    encoding: "utf8", env: { ...process.env, REPL_ID: "local-test" } });
  assert.equal(blocked.status, 1); assert.match(blocked.stderr, /B4_CORPCRM01_ONLY/);
});
test("whole server launch uses preloaded credentials, only read-only SQL and ten POSTs, and refuses a second run", async () => {
  const vm = require("node:vm"), realRequire = require;
  const files = new Map(), sql = [], requests = [];
  const root = "/var/www/indexus-crm";
  const fakeFs = {
    realpathSync: () => root,
    readFileSync: name => name.endsWith("service-catalog.ts") ?
      fs.readFileSync("server/lib/ai/service-catalog.ts", "utf8") : Buffer.from("DATABASE_URL=synthetic"),
    existsSync: () => true,
    lstatSync: () => ({ isDirectory: () => true, isSymbolicLink: () => false, mode: 0o700, uid: 1001 }),
    mkdtempSync: () => "/home/seman/.indexus-b4/run-test",
    writeFileSync: (name, contents, options) => {
      assert.equal(options.mode, 0o600); assert.equal(options.flag, "wx");
      if (files.has(name)) throw Error("EEXIST");
      files.set(name, contents);
    },
  };
  class Client {
    constructor(options) { assert.match(options.options, /default_transaction_read_only=on/); }
    async connect() {}
    async end() {}
    async query(query) {
      sql.push(query);
      if (query === "SHOW transaction_read_only") return { rows: [{ transaction_read_only: "on" }] };
      if (query.startsWith("SELECT")) return { rows: [state()] };
      assert(["BEGIN READ ONLY", "ROLLBACK"].includes(query), query);
      return { rows: [] };
    }
  }
  const fakeProcess = { argv: ["node", "pilot.cjs", "--run-b4"], platform: "linux",
    getuid: () => 1001, on() {}, removeListener() {},
    env: { NODE_ENV: "production", INDEXUS_AI_GATEWAY_ENABLED: "true",
      INDEXUS_AI_GATEWAY_BASE_URL: "https://ai.cordbloodcenter.com/gateway/",
      INDEXUS_AI_ROUTER_MODE: "routed", INDEXUS_AI_GATEWAY_TOKEN: "synthetic-loader-token" } };
  const context = { module: { exports: {} }, process: fakeProcess,
    console: { log() {}, error() {} }, Buffer, AbortController, setTimeout, clearTimeout,
    require: name => {
      if (name === "node:fs") return fakeFs;
      if (name === "node:os") return { hostname: () => "CORPCRM01", homedir: () => "/home/seman" };
      if (name === root + "/node_modules/pg") return { Client };
      if (name === root + "/node_modules/dotenv") return { parse: () => ({ DATABASE_URL: "synthetic-db" }) };
      return realRequire(name);
    },
    fetch: async (url, options) => {
      requests.push(url);
      assert.equal(options.headers.authorization, "Bearer synthetic-loader-token");
      const body = JSON.parse(options.body);
      const doc = P.CORPUS.find(d => d.text === body.messages[1].content);
      assert(doc);
      return Response.json({ object: "chat.completion", model: P.MODEL, choices: [
        { index: 0, finish_reason: "stop", message: {
          role: "assistant", content: JSON.stringify(doc.expected) } },
      ] });
    },
  };
  vm.runInNewContext(fs.readFileSync("script/ai-gateway-b4-pilot.cjs", "utf8"), context);
  await context.module.exports.main();
  assert.equal(fakeProcess.exitCode, 0);
  assert.equal(requests.length, 10);
  assert(requests.every(url => url.endsWith("/v1/chat/completions")));
  assert.equal(sql.filter(q => q.startsWith("SELECT")).length, 2);
  const reportText = files.get("/home/seman/.indexus-b4/run-test/report.json");
  assert.equal(JSON.parse(reportText).summary.correctFields, 80);
  assert.equal(reportText.includes("synthetic-loader-token"), false);
  await assert.rejects(context.module.exports.main(), { code: "B4_ALREADY_STARTED" });
  assert.equal(requests.length, 10);
});
