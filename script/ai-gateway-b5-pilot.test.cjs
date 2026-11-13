"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const P = require("./ai-gateway-b4-pilot.cjs");
const B5 = require("./ai-gateway-b5-pilot.cjs");
const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const TIMES = [27958, 20318, 15776, 18882, 25416, 25354, 18056, 31069, 21495, 17116];
const catalogSource = fs.readFileSync("server/lib/ai/service-catalog.ts", "utf8");
const catalog = [...catalogSource.matchAll(/^\s*"([a-z0-9_.]+)":\s*"(?:chat|transcription|speech|responses|chat_probe)",?\s*$/gm)].map(m => m[1]);
function snapshot() {
  return P.snapshot({ version: 5, value: { gateway: {
    enabled: false, baseURL: "https://ai.cordbloodcenter.com/gateway/", timeoutMs: 30000,
    maxRetries: 0, temperature: null, maxTokens: null,
  }, routes: {} } }, catalog);
}
function baselineFixture() {
  // A local synthetic fixture representing the reviewed error classes, NOT a live model result.
  const plan = { schema: P.SCHEMA, instruction: P.INSTRUCTION, corpus: P.CORPUS,
    planSha256: hash({ schema: P.SCHEMA, instruction: P.INSTRUCTION, corpus: P.CORPUS }) };
  const rows = P.CORPUS.map((doc, i) => {
    const value = structuredClone(doc.expected);
    if ([2, 3, 4, 5, 7, 8, 9].includes(i)) value.document_id = value.document_type + " " + doc.id;
    if (i === 6) value.issue_date = "2026-03-04";
    return { id: doc.id, attempted: true, durationMs: TIMES[i], ...P.evaluate(JSON.stringify(value), doc.expected) };
  });
  const report = { model: P.MODEL, code: null, finalVerified: true, rows,
    before: snapshot(), after: snapshot(), planSha256: plan.planSha256, summary: P.aggregate(rows, true) };
  return { report, plan };
}
function baseline() {
  const fixture = baselineFixture();
  return B5.verifyBaseline(fixture.report, fixture.plan);
}
function harness(complete = async doc => JSON.stringify(doc.expected)) {
  let reads = 0, calls = 0, tick = 0;
  const files = new Map();
  return {
    get reads() { return reads; }, get calls() { return calls; }, files,
    options: { phase: "B5", instruction: B5.INSTRUCTION, baseline: baseline(),
      finalize: B5.finalize, render: B5.markdown,
      readSnapshot: async () => { reads++; return snapshot(); },
      complete: async doc => { calls++; return complete(doc); },
      persist: async (name, value) => { assert(!files.has(name)); files.set(name, value); },
      clock: () => { tick += 100; return tick; } },
  };
}
test("B5 preserves the original corpus, schema and expected results byte-for-byte", () => {
  const oldSource = spawnSync("git", ["show",
    "8bf57f3fdc1ca5739acc32895247f4ae95e90bf4:script/ai-gateway-b4-pilot.cjs"], { encoding: "utf8" });
  assert.equal(oldSource.status, 0);
  const old = { exports: {} };
  vm.runInNewContext(oldSource.stdout, { module: old, require, process, console, Buffer,
    AbortController, setTimeout, clearTimeout });
  assert.equal(JSON.stringify(P.SCHEMA), JSON.stringify(old.exports.SCHEMA));
  assert.equal(JSON.stringify(P.CORPUS), JSON.stringify(old.exports.CORPUS));
  assert.equal(P.INSTRUCTION, old.exports.INSTRUCTION);
  assert.notEqual(B5.INSTRUCTION, P.INSTRUCTION);
  assert.match(B5.INSTRUCTION, /ONLY the standalone document identifier token/);
  assert.match(B5.INSTRUCTION, /NEVER substitute a delivery date/);
  assert.match(B5.INSTRUCTION, /slash date with unspecified locale/);
  for (const doc of P.CORPUS) assert(!B5.INSTRUCTION.includes(doc.id));
});
test("B4 baseline scores are recomputed and match 72/80, seven identifier errors and one unsupported date", () => {
  const b = baseline();
  assert.equal(b.summary.correctFields, 72);
  assert.equal(b.summary.exactDocuments, 2);
  assert.equal(b.summary.unsupportedValues, 1);
  assert.equal(b.summary.meanProcessingMs, 22144);
  assert.equal(b.rows.flatMap(r => r.wrong).filter(k => k === "document_id").length, 7);
});
test("changed expected results, tampered scores, wrong model and unreviewed error patterns stop before inference", () => {
  const changes = [
    f => { f.plan = structuredClone(f.plan); f.plan.corpus[0].expected.total_amount = 7; },
    f => { f.report.summary.correctFields = 80; },
    f => { f.report.rows[0].correct = 0; },
    f => { f.report.model = "different-model"; },
    f => { f.report.finalVerified = false; },
    f => { f.report.rows[0].durationMs = -1; },
    f => { f.report.rows[0].actual = null; },
    f => { f.report.rows[1].id = f.report.rows[0].id; },
  ];
  for (const change of changes) {
    const fixture = baselineFixture(); change(fixture);
    assert.throws(() => B5.verifyBaseline(fixture.report, fixture.plan), P.PilotError);
  }
});
test("one B5 run emits one combined comparison report and a distinct test plan, no changes to fixtures", async () => {
  const h = harness();
  const r = await P.executePilot(h.options);
  assert.equal(h.calls, 10); assert.equal(h.reads, 2);
  assert.equal(r.phase, "B5");
  assert.equal(r.comparison.baseline.fieldAccuracyPercent, 90);
  assert.equal(r.comparison.fieldAccuracyDeltaPercentagePoints, 10);
  assert.equal(r.comparison.fixedOriginalErrors, 8);
  assert.equal(r.comparison.previouslyCorrectFieldsNowWrongOrUnverified, 0);
  assert.equal(r.comparison.meanProcessingMsDelta, 100 - 22144);
  assert.equal(r.optimizationPassed, true);
  assert.equal(r.summary.recommendation, "VALIDATE_ON_UNSEEN_SYNTHETIC_DOCUMENTS_BEFORE_REAL_USE");
  assert.equal(r.comparison.schemaUnchanged, true);
  assert.equal(r.comparison.corpusUnchanged, true);
  assert.equal(r.comparison.expectedUnchanged, true);
  assert.equal(h.files.get("plan.json").instruction, B5.INSTRUCTION);
  assert.equal(h.files.get("plan.json").corpus, P.CORPUS);
  assert(h.files.has("baseline-b4.json"));
  assert.match(h.files.get("report.md"), /# B5/);
  assert.match(h.files.get("report.md"), /Porovnanie B4 a B5/);
});
test("remaining original errors and new regressions are counted separately", async () => {
  const h = harness(async doc => {
    const v = { ...doc.expected };
    if (doc.id === "SYN-B4-03") v.document_id = "wrong";
    if (doc.id === "SYN-B4-01") v.total_amount = 999;
    return JSON.stringify(v);
  });
  const r = await P.executePilot(h.options);
  assert.equal(r.comparison.fixedOriginalErrors, 7);
  assert.equal(r.comparison.remainingOriginalErrors, 1);
  assert.equal(r.comparison.previouslyCorrectFieldsNowWrongOrUnverified, 1);
  assert.equal(r.optimizationPassed, false);
  assert.equal(r.summary.recommendation, "NOT_READY_FOR_REAL_USE");
});
test("configuration changed since B4 prevents all ten B5 inference calls", async () => {
  const h = harness();
  h.options.readSnapshot = async () => ({ ...snapshot(), version: 6 });
  const r = await P.executePilot(h.options);
  assert.equal(h.calls, 0);
  assert.equal(r.code, "B5_CONFIGURATION_DIFFERS_FROM_B4");
  assert.equal(r.optimizationPassed, false);
});
test("B5 request changes only system prompt; supported deterministic settings and payload stay the same", async () => {
  const previous = global.fetch, requests = [];
  const doc = P.CORPUS[0];
  global.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return Response.json({ object: "chat.completion", model: P.MODEL,
      choices: [{ index: 0, finish_reason: "stop",
        message: { role: "assistant", content: JSON.stringify(doc.expected) } }] });
  };
  try {
    await P.requestCompletion(doc, "synthetic-token");
    await P.requestCompletion(doc, "synthetic-token", undefined, B5.INSTRUCTION);
    const [b4, b5] = requests;
    assert.equal(b4.messages[0].content, P.INSTRUCTION);
    assert.equal(b5.messages[0].content, B5.INSTRUCTION);
    b4.messages[0].content = b5.messages[0].content;
    assert.deepEqual(b4, b5);
    assert.equal(b5.temperature, 0); assert.equal(b5.stream, false);
    assert.equal(b5.max_tokens, 512); assert(!Object.hasOwn(b5, "seed"));
  } finally { global.fetch = previous; }
});
test("B5 network/auth error does not retry or claim success; comparison remains readable", async () => {
  const h = harness(async () => { throw new P.PilotError("B4_HTTP_403"); });
  const r = await P.executePilot(h.options);
  assert.equal(h.calls, 1); assert.equal(h.reads, 2);
  assert.equal(r.optimizationPassed, false);
  assert.equal(r.summary.recommendation, "NOT_READY_FOR_REAL_USE");
  assert.match(h.files.get("report.md"), /B4_HTTP_403/);
});
test("B5 help and Replit production guard cannot consume pilot approval or execute inference", () => {
  const file = "script/ai-gateway-b5-pilot.cjs";
  const help = spawnSync(process.execPath, [file, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0); assert.match(help.stdout, /--run-b5 --baseline/);
  const blocked = spawnSync(process.execPath, [file, "--run-b5", "--baseline", "/tmp/report.json"], {
    encoding: "utf8", env: { ...process.env, REPL_ID: "local-test" } });
  assert.equal(blocked.status, 1); assert.match(blocked.stderr, /B4_CORPCRM01_ONLY/);
});
test("complete B5 server launch has an independent journal and output; B4 files are never overwritten", async () => {
  const files = new Map([["/home/seman/.indexus-b4/b4-started.json", "previous B4 marker"]]);
  const sql = [], requests = [];
  const root = "/var/www/indexus-crm", reportPath = "/home/seman/.indexus-b4/run-test/report.json";
  let baselineReads = 0;
  const fakeFs = {
    realpathSync: () => root, existsSync: () => true,
    readFileSync: name => name.endsWith("service-catalog.ts") ? catalogSource : Buffer.from(""),
    lstatSync: () => ({ isDirectory: () => true, isSymbolicLink: () => false, mode: 0o700, uid: 1001 }),
    mkdtempSync: prefix => { assert.match(prefix, /\.indexus-b5\/run-$/); return prefix + "test"; },
    writeFileSync: (name, value, options) => {
      assert(!name.includes(".indexus-b4/"));
      if (files.has(name)) throw Error("EEXIST");
      assert.equal(options.mode, 0o600); assert.equal(options.flag, "wx");
      files.set(name, value);
    },
  };
  class Client {
    constructor(options) { assert.match(options.options, /default_transaction_read_only=on/); }
    async connect() {}
    async end() {}
    async query(query) {
      sql.push(query);
      if (query === "SHOW transaction_read_only") return { rows: [{ transaction_read_only: "on" }] };
      if (query.startsWith("SELECT")) {
        return { rows: [{ version: 5, value: { routes: {}, gateway: {
          enabled: false, baseURL: "https://ai.cordbloodcenter.com/gateway/", timeoutMs: 30000,
          maxRetries: 0, temperature: null, maxTokens: null,
        } } }] };
      }
      assert(["BEGIN READ ONLY", "ROLLBACK"].includes(query));
      return { rows: [] };
    }
  }
  const fakeProcess = { argv: ["node", "b5.cjs", "--run-b5", "--baseline", reportPath],
    platform: "linux", getuid: () => 1001, on() {}, removeListener() {},
    env: { NODE_ENV: "production", INDEXUS_AI_GATEWAY_ENABLED: "true",
      INDEXUS_AI_GATEWAY_BASE_URL: "https://ai.cordbloodcenter.com/gateway/",
      INDEXUS_AI_ROUTER_MODE: "routed", INDEXUS_AI_GATEWAY_TOKEN: "synthetic-loader-token" } };
  const context = { module: { exports: {} }, process: fakeProcess, console: { log() {}, error() {} },
    Buffer, AbortController, setTimeout, clearTimeout,
    require: name => {
      if (name === "node:fs") return fakeFs;
      if (name === "node:os") return { hostname: () => "CORPCRM01", homedir: () => "/home/seman" };
      if (name === root + "/node_modules/pg") return { Client };
      if (name === root + "/node_modules/dotenv") return { parse: () => ({ DATABASE_URL: "synthetic-db" }) };
      return require(name);
    },
    fetch: async (url, options) => {
      requests.push(url);
      const body = JSON.parse(options.body);
      assert.equal(body.messages[0].content, B5.INSTRUCTION);
      const doc = P.CORPUS.find(d => d.text === body.messages[1].content);
      assert(doc);
      return Response.json({ object: "chat.completion", model: P.MODEL, choices: [
        { index: 0, finish_reason: "stop", message: {
          role: "assistant", content: JSON.stringify(doc.expected) } },
      ] });
    },
  };
  vm.runInNewContext(fs.readFileSync("script/ai-gateway-b4-pilot.cjs", "utf8"), context);
  const options = { ...B5.options(), loadBaseline: name => {
    assert.equal(name, reportPath); baselineReads++; return baseline();
  } };
  await context.module.exports.main(options);
  assert.equal(fakeProcess.exitCode, 0);
  assert.equal(baselineReads, 1);
  assert.equal(requests.length, 10);
  assert(requests.every(url => url.endsWith("/v1/chat/completions")));
  assert.equal(sql.filter(q => q.startsWith("SELECT")).length, 2);
  assert.equal(files.get("/home/seman/.indexus-b4/b4-started.json"), "previous B4 marker");
  assert(files.has("/home/seman/.indexus-b5/b5-started.json"));
  const result = JSON.parse(files.get("/home/seman/.indexus-b5/run-test/report.json"));
  assert.equal(result.phase, "B5");
  assert.equal(result.comparison.baseline.correctFields, 72);
  assert.equal(result.optimizationPassed, true);
  await assert.rejects(context.module.exports.main(options), { code: "B5_ALREADY_STARTED" });
  assert.equal(requests.length, 10);
});
