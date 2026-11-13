"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const P = require("./ai-gateway-b4-pilot.cjs");
const B5 = require("./ai-gateway-b5-pilot.cjs");
const B6 = require("./ai-gateway-b6-pilot.cjs");
const N = require("./lib/ai-gateway-b6-normalization.cjs");
const Baseline = require("./lib/ai-gateway-b6-baseline.cjs");
const hash = x => crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
const catalogSource = fs.readFileSync("server/lib/ai/service-catalog.ts", "utf8");
const catalog = [...catalogSource.matchAll(/^\s*"([a-z0-9_.]+)":\s*"(?:chat|transcription|speech|responses|chat_probe)",?\s*$/gm)].map(m => m[1]);
function state() {
  return { version: 5, value: { routes: {}, gateway: { enabled: false,
    baseURL: "https://ai.cordbloodcenter.com/gateway/", timeoutMs: 30000,
    maxRetries: 0, temperature: null, maxTokens: null } } };
}
const snapshot = () => P.snapshot(state(), catalog);
function b5Fixture() {
  // Simulated baseline for local tests, never represented as an executed model result.
  const plan = { schema: P.SCHEMA, instruction: B5.INSTRUCTION, corpus: P.CORPUS };
  plan.planSha256 = hash(plan);
  const rows = P.CORPUS.map(doc => {
    const actual = { ...doc.expected };
    if (["SYN-B4-03", "SYN-B4-09"].includes(doc.id))
      actual.document_id = "Názov dokumentu " + doc.id;
    return { id: doc.id, attempted: true, durationMs: 20000,
      ...P.evaluate(JSON.stringify(actual), doc.expected) };
  });
  const report = { phase: "B5", model: P.MODEL, before: snapshot(), after: snapshot(),
    code: null, finalVerified: true, rows, summary: P.aggregate(rows, true),
    planSha256: plan.planSha256 };
  return { report, plan };
}
const baseline = () => {
  const fixture = b5Fixture();
  return Baseline.verifyBaseline(fixture.report, fixture.plan);
};
function harness(complete = async doc => JSON.stringify(doc.expected)) {
  let reads = 0, ticks = 0;
  const calls = [], files = new Map();
  return { files, calls, get reads() { return reads; }, options: {
    ...B6.options(), baseline: baseline(),
    readSnapshot: async () => { reads++; return snapshot(); },
    complete: async doc => { calls.push(doc.id); return complete(doc); },
    persist: async (name, value) => { assert(!files.has(name)); files.set(name, value); },
    clock: () => { ticks += 50; return ticks; },
  } };
}
test("B6 keeps the ten original cases/schema and all B5 rules, then adds ten distinct valid cases", () => {
  assert.equal(B6.CORPUS.length, 20);
  assert.equal(JSON.stringify(B6.CORPUS.slice(0, 10)), JSON.stringify(P.CORPUS));
  assert(B6.INSTRUCTION.startsWith(B5.INSTRUCTION));
  assert.equal(new Set(B6.CORPUS.map(d => d.id)).size, 20);
  assert.equal(B6.NEW_CORPUS.length, 10);
  assert.equal(new Set(B6.NEW_CORPUS.map(d => d.expected.document_id)).size, 10);
  for (const doc of B6.NEW_CORPUS) {
    assert(!/^SYN-B4-/.test(doc.expected.document_id));
    assert.match(doc.text, /SYNTET|SYNTHET/);
    assert(!B6.INSTRUCTION.includes(doc.expected.document_id));
    assert.equal(P.evaluate(JSON.stringify(doc.expected), doc.expected).schemaValid, true);
    assert.equal(P.evaluate(JSON.stringify(doc.expected), doc.expected).correct, 8);
  }
  assert(B6.NEW_CORPUS.some(d => d.expected.document_id === "00007421"));
  assert(B6.NEW_CORPUS.some(d => d.expected.issue_date === null));
});
test("normalizer strips only a unique supported source-backed identifier; no expected answers required", () => {
  assert.deepEqual(N.normalizeDocumentId("Dodací list SYN-B4-03", "SYNTETICKÝ dodací list SYN-B4-03."),
    { applied: true, before: "Dodací list SYN-B4-03", after: "SYN-B4-03", reason: "UNIQUE_SOURCE_MATCH" });
  assert.equal(N.normalizeDocumentId("SYN-B4-03", "ID SYN-B4-03.").reason, "ALREADY_EXACT");
  assert.equal(N.normalizeDocumentId("Objednávka SYN-B4-09", "Objednávka SYN-B4-09.").after, "SYN-B4-09");
});
test("normalizer refuses ambiguities, wrong IDs, adjacent characters, missing IDs and other formats", () => {
  for (const [value, source] of [
    ["SYN-B4-03 SYN-B4-09", "Dokument SYN-B4-03"],
    ["SYN-B4-03", "Dokument SYN-B4-03 alebo SYN-B4-09"],
    ["Objednávka SYN-B4-09", "Dokument SYN-B4-03"],
    ["Dokument", "Dokument SYN-B4-03"],
    ["SYN-B4-03 SYN-B4-03", "Dokument SYN-B4-03"],
    ["XSYN-B4-03", "Dokument SYN-B4-03"],
    ["SYN-B4-030", "Dokument SYN-B4-03"],
    ["SYN-B4-03-X", "Dokument SYN-B4-03"],
    ["Dokument SYN-B4-03 / REF-123", "Dokument SYN-B4-03"],
    ["Dokument SYN-B4-03 / OTHER-X", "Dokument SYN-B4-03"],
    ["Dodací list DL_27_008", "Dodací list DL_27_008"],
    [7421, "Purchase order 00007421"],
  ]) {
    const result = N.normalizeDocumentId(value, source);
    assert.equal(result.applied, false, String(value));
    assert.equal(result.after, value);
  }
});
test("raw values and scores are retained; dates and other fields are never repaired", () => {
  const doc = P.CORPUS[2], value = { ...doc.expected,
    document_id: "Dodací list " + doc.id, issue_date: "2026-01-01" };
  const result = N.evaluateResponse(JSON.stringify(value), doc);
  assert.equal(result.correct, 6);
  assert.equal(result.normalized.correct, 7);
  assert.equal(result.actual.document_id, "Dodací list SYN-B4-03");
  assert.equal(result.normalized.actual.document_id, "SYN-B4-03");
  for (const key of P.FIELDS.filter(k => k !== "document_id"))
    assert.equal(result.actual[key], result.normalized.actual[key]);
  // A deliberately changed answer key affects scoring, not normalization.
  const altered = { ...doc, expected: { ...doc.expected, document_id: "DIFFERENT" } };
  assert.equal(N.evaluateResponse(JSON.stringify(value), altered).normalized.actual.document_id, "SYN-B4-03");
});
test("normalization cannot conceal invalid JSON, duplicate keys, extra keys or an invalid schema", () => {
  const doc = P.CORPUS[2], value = { ...doc.expected, document_id: "Dodací list SYN-B4-03" };
  for (const text of [
    "not JSON", JSON.stringify({ ...value, approved: true }),
    JSON.stringify({ ...value, total_amount: "12" }),
    JSON.stringify(value).replace('{"document_id":', '{"document_id":"SYN-B4-03","document_id":'),
  ]) {
    const result = N.evaluateResponse(text, doc);
    assert.equal(result.normalization.applied, false);
    assert.equal(result.schemaValid, false);
    assert.equal(result.normalized.schemaValid, false);
    assert.equal(result.normalized.correct, result.correct);
  }
});
test("B5 baseline validates the reviewed two errors and rejects changed fixtures or scores", () => {
  assert.equal(baseline().summary.correctFields, 78);
  assert.equal(baseline().summary.exactDocuments, 8);
  for (const change of [
    f => { f.report.summary.correctFields = 80; },
    f => { f.report.rows[0].actual.issue_date = "2026-01-01"; },
    f => { f.plan.instruction += "changed"; },
    f => { f.report.finalVerified = false; },
    f => { f.report.rows[0].durationMs = -1; },
  ]) {
    const f = b5Fixture(); change(f);
    assert.throws(() => Baseline.verifyBaseline(f.report, f.plan), P.PilotError);
  }
});
test("single run sends the original ten first, then ten new cases and records 160 honest raw/normalized scores", async () => {
  const h = harness(async doc => {
    const actual = { ...doc.expected };
    if (["SYN-B4-03", "SYN-B4-09"].includes(doc.id)) actual.document_id = "Názov dokumentu " + doc.id;
    return JSON.stringify(actual);
  });
  const report = await P.executePilot(h.options);
  assert.deepEqual(h.calls, B6.CORPUS.map(d => d.id));
  assert.equal(h.reads, 2);
  assert.equal(report.summary.totalFields, 160);
  assert.equal(report.summary.correctFields, 158);
  assert.equal(report.normalizedSummary.correctFields, 160);
  assert.equal(report.groups[0].raw.correctFields, 78);
  assert.equal(report.groups[0].normalized.correctFields, 80);
  assert.equal(report.groups[1].raw.correctFields, 80);
  assert.equal(report.groups[1].normalized.correctFields, 80);
  assert.equal(report.normalizationEffect.applied, 2);
  assert.equal(report.rawPassed, false);
  assert.equal(report.normalizedPassed, true);
  assert.equal(report.status, "MODEL_ERRORS_REPAIRED_BY_TEST_NORMALIZATION");
  assert.equal(h.files.get("plan.json").testPolicy.normalization.expectedAnswersUsed, false);
  assert.equal(h.files.get("plan.json").corpus.length, 20);
  assert(h.files.has("baseline-b5.json"));
  assert(h.files.has("report.json")); assert(h.files.has("report.md"));
  const repaired = h.files.get("report.md").split("\n").find(line => line.startsWith("| SYN-B4-03 |"));
  assert(repaired.endsWith("| — |"));
});
test("new formats are scored unchanged: a label around a new ID remains a model error, never masked", async () => {
  const h = harness(async doc => JSON.stringify({ ...doc.expected,
    document_id: "Názov " + doc.expected.document_id }));
  const report = await P.executePilot(h.options);
  assert.equal(report.groups[0].raw.exactDocuments, 0);
  assert.equal(report.groups[0].normalized.exactDocuments, 10);
  assert.equal(report.groups[1].raw.exactDocuments, 0);
  assert.equal(report.groups[1].normalized.exactDocuments, 0);
  assert.equal(report.groups[1].normalizationApplied, 0);
  assert.equal(report.summary.recommendation, "NOT_READY_FOR_REAL_USE");
});
test("transport failure stops all remaining cases, no retries or fabricated completion of either group", async () => {
  const h = harness(async () => { throw new P.PilotError("B4_HTTP_403"); });
  const report = await P.executePilot(h.options);
  assert.equal(h.calls.length, 1); assert.equal(h.reads, 2);
  assert.equal(report.groups[1].raw.attempted, 0);
  assert.equal(report.normalizedPassed, false);
  assert.equal(report.summary.totalFields, 160);
  assert.equal(report.status, "FAILED_OR_INCOMPLETE");
});
test("configuration drift before or after calls cannot pass, even with perfect model responses", async () => {
  for (const before of [true, false]) {
    const h = harness(); let reads = 0;
    h.options.readSnapshot = async () => ({ ...snapshot(), version: ++reads === 1 && !before ? 5 : 6 });
    const report = await P.executePilot(h.options);
    assert.equal(report.rawPassed, false); assert.equal(report.normalizedPassed, false);
    assert.equal(h.calls.length, before ? 0 : 20);
  }
});
test("B6 help is inert and the production guard prevents running from Replit", () => {
  const file = "script/ai-gateway-b6-pilot.cjs";
  const help = spawnSync(process.execPath, [file, "--help"], { encoding: "utf8" });
  assert.equal(help.status, 0); assert.match(help.stdout, /20 syntetických/);
  assert.match(help.stdout, /--run-b6/);
  const blocked = spawnSync(process.execPath, [file, "--run-b6"], {
    encoding: "utf8", env: { ...process.env, REPL_ID: "local-test" } });
  assert.equal(blocked.status, 1); assert.match(blocked.stderr, /B4_CORPCRM01_ONLY/);
});
test("whole B6 console entry loads existing B5 marker automatically, uses read-only SQL and has an independent one-run journal", async () => {
  const old = b5Fixture(), files = new Map(), sql = [], sent = [];
  const root = "/var/www/indexus-crm";
  const marker = "/home/seman/.indexus-b5/b5-started.json";
  const reads = new Map([
    [marker, JSON.stringify({ runDir: "/home/seman/.indexus-b5/run-fixture" })],
    ["/home/seman/.indexus-b5/run-fixture/report.json", JSON.stringify(old.report)],
    ["/home/seman/.indexus-b5/run-fixture/plan.json", JSON.stringify(old.plan)],
  ]);
  const fakeFs = {
    realpathSync: filename => filename, existsSync: () => true,
    readFileSync: filename => filename.endsWith("service-catalog.ts") ? catalogSource :
      reads.has(filename) ? reads.get(filename) : Buffer.from(""),
    lstatSync: filename => ({ isFile: () => reads.has(filename), isDirectory: () => !reads.has(filename),
      isSymbolicLink: () => false, mode: reads.has(filename) ? 0o600 : 0o700, uid: 1001, size: 10000 }),
    mkdtempSync: prefix => { assert.match(prefix, /\.indexus-b6\/run-$/); return prefix + "test"; },
    writeFileSync: (filename, data, options) => {
      assert(filename.startsWith("/home/seman/.indexus-b6/"));
      if (files.has(filename)) throw Error("EEXIST");
      assert.equal(options.mode, 0o600); assert.equal(options.flag, "wx"); files.set(filename, data);
    },
  };
  class Client {
    constructor(options) { assert.match(options.options, /default_transaction_read_only=on/); }
    async connect() {}
    async end() {}
    async query(q) {
      sql.push(q);
      if (q === "SHOW transaction_read_only") return { rows: [{ transaction_read_only: "on" }] };
      if (q.startsWith("SELECT")) return { rows: [state()] };
      assert(["BEGIN READ ONLY", "ROLLBACK"].includes(q)); return { rows: [] };
    }
  }
  const processMock = { argv: ["node", "b6.cjs", "--run-b6"], platform: "linux",
    getuid: () => 1001, on() {}, removeListener() {},
    env: { NODE_ENV: "production", INDEXUS_AI_GATEWAY_ENABLED: "true", INDEXUS_AI_ROUTER_MODE: "routed",
      INDEXUS_AI_GATEWAY_BASE_URL: "https://ai.cordbloodcenter.com/gateway/",
      INDEXUS_AI_GATEWAY_TOKEN: "synthetic-loader-token" } };
  const commonRequire = name => {
    if (name === "node:fs") return fakeFs;
    if (name === "node:os") return { hostname: () => "CORPCRM01", homedir: () => "/home/seman" };
    if (name === root + "/node_modules/pg") return { Client };
    if (name === root + "/node_modules/dotenv") return { parse: () => ({ DATABASE_URL: "synthetic-db" }) };
    return require(name);
  };
  const loaderContext = { module: { exports: {} }, process: processMock,
    require: name => name === "../ai-gateway-b4-pilot.cjs" ? P :
      name === "../ai-gateway-b5-pilot.cjs" ? B5 : commonRequire(name) };
  vm.runInNewContext(fs.readFileSync("script/lib/ai-gateway-b6-baseline.cjs", "utf8"), loaderContext);
  const context = { module: { exports: {} }, process: processMock, Buffer, AbortController,
    setTimeout, clearTimeout, console: { log() {}, error() {} }, require: commonRequire,
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.messages[0].content, B6.INSTRUCTION);
      const doc = B6.CORPUS.find(d => d.text === body.messages[1].content);
      assert(doc); sent.push({ id: doc.id, url });
      return Response.json({ object: "chat.completion", model: P.MODEL, choices: [
        { index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(doc.expected) } },
      ] });
    },
  };
  vm.runInNewContext(fs.readFileSync("script/ai-gateway-b4-pilot.cjs", "utf8"), context);
  const options = { ...B6.options(), loadBaseline: loaderContext.module.exports.loadBaseline };
  await context.module.exports.main(options);
  assert.equal(processMock.exitCode, 0);
  assert.deepEqual(sent.map(r => r.id), B6.CORPUS.map(d => d.id));
  assert(sent.every(r => r.url.endsWith("/v1/chat/completions")));
  assert.equal(sql.filter(q => q.startsWith("SELECT")).length, 2);
  const result = JSON.parse(files.get("/home/seman/.indexus-b6/run-test/report.json"));
  assert.equal(result.phase, "B6"); assert.equal(result.summary.correctFields, 160);
  assert.equal(result.normalizedSummary.correctFields, 160);
  assert.equal(result.rawPassed, true);
  assert(!JSON.stringify(result).includes("synthetic-loader-token"));
  assert(files.has("/home/seman/.indexus-b6/b6-started.json"));
  await assert.rejects(context.module.exports.main(options), { code: "B6_ALREADY_STARTED" });
  assert.equal(sent.length, 20);
});
