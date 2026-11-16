const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { snapshot } = require("../ai-gateway-b4-pilot.cjs");
const { inventorySummary } = require("./discovery.cjs");
const { originalReference, productionComparison, readProductionSnapshot, executeCheck, catalogFromSource } = require("./b11-check.cjs");
const catalog = catalogFromSource(fs.readFileSync("server/lib/ai/service-catalog.ts", "utf8"));
const row = () => ({ version: 7, value: { routes: {}, gateway: {
  enabled: false, baseURL: "https://ai.cordbloodcenter.com/gateway/", maxRetries: 0,
  maxTokens: null, temperature: null, timeoutMs: 30000,
} } });
const current = () => snapshot(row(), catalog);
test("B11 uses the actual 65-service catalog and rejects incomplete catalogs", () => {
  assert.equal(catalog.length, 65);
  assert.throws(() => catalogFromSource('"email.monitoring": "chat",'), /B11_LIVE_CATALOG_INVALID/);
});
test("original reference requires verified full snapshots; missing hashes are not equal proof", () => {
  const original = { phase: "B1_EMAIL_MONITORING", kind: "LIVE_ISOLATED_SYNTHETIC",
    finalVerified: true, before: current(), after: current() };
  assert.equal(originalReference(original).openai, 65);
  assert.throws(() => originalReference({ ...original, finalVerified: false }), /B11_ORIGINAL_REFERENCE_INVALID/);
  assert.throws(() => originalReference({ ...original, before: {}, after: {} }), /B11_ORIGINAL_REFERENCE_INVALID/);
});
test("production comparison checks both historical and during-check changes, including settings version", () => {
  const s = current();
  assert.equal(productionComparison(s, s, s).afterMatchesOriginal, true);
  assert.equal(productionComparison(s, s, { ...s, version: 8 }).unchangedDuringCheck, false);
  assert.equal(productionComparison(s, { ...s, fullConfigurationSha256: "a".repeat(64) }, s).beforeMatchesOriginal, false);
  assert.throws(() => productionComparison(s, s, { ...s, gatewayEnabled: true }), /B11_SNAPSHOT_INVALID/);
});
test("production database is read-only at connection and transaction levels; only SELECT and rollback are issued", async () => {
  const queries = [];
  class FakeClient {
    constructor(options) { assert.ok(options.options.includes("default_transaction_read_only=on")); }
    async connect() {}
    async query(sql) {
      queries.push(sql);
      if (sql === "SHOW transaction_read_only") return { rows: [{ transaction_read_only: "on" }] };
      if (sql.startsWith("SELECT version,value")) return { rows: [row()] };
      return { rows: [] };
    }
    async end() { queries.push("END_CLIENT"); }
  }
  const result = await readProductionSnapshot({ Client: FakeClient, connectionString: "SYNTHETIC_NOT_CONNECTED", catalog });
  assert.equal(result.openai, 65);
  assert.deepEqual(queries, ["BEGIN READ ONLY", "SHOW transaction_read_only",
    "SELECT version,value FROM ai_router_configuration WHERE singleton=true", "ROLLBACK", "END_CLIENT"]);
});
test("B11 still verifies final production settings if discovery fails; no automatic inference follows", async () => {
  let reads = 0, discoveries = 0;
  const result = await executeCheck({ reference: current(), readSnapshot: async () => { reads++; return current(); },
    discovery: async () => { discoveries++; throw Error("SYNTHETIC_PRIVATE_ERROR"); } });
  assert.equal(reads, 2); assert.equal(discoveries, 1);
  assert.equal(result.inferenceCalls, 0); assert.equal(result.productionRoutingUnchanged, true);
  assert.equal(result.error, "B11_READ_ONLY_CHECK_FAILED");
  assert.equal(JSON.stringify(result).includes("SYNTHETIC_PRIVATE_ERROR"), false);
});
test("successful current discovery does not manufacture a historical model baseline", async () => {
  const result = await executeCheck({ reference: current(), readSnapshot: async () => current(),
    discovery: async () => ({ error: null, inferenceCalls: 0, existingModels: {
      originalDocumentModelListed: true, originalDocumentModelDeclared: true,
    } }) });
  assert.equal(result.discoveryPassed, true); assert.equal(result.productionRoutingUnchanged, true);
  assert.equal(result.existingModelsHistoricallyUnchanged, null);
  assert.equal(result.fullyVerified, false);
  assert.deepEqual(result.remainingEvidence, ["PRE_REGISTRATION_MODEL_INVENTORY_REQUIRED"]);
  const missing = await executeCheck({ reference: current(), readSnapshot: async () => current(),
    discovery: async () => ({ error: null, existingModels: {
      originalDocumentModelListed: false, originalDocumentModelDeclared: false,
    } }) });
  assert.equal(missing.error, "B11_ORIGINAL_MODEL_UNAVAILABLE_OR_UNVERIFIED");
});
test("existing model fingerprint excludes the new registration but detects old-model changes and never claims history", () => {
  const old = { id: "indexus-document-audio:latest", revision: "SYNTHETIC", maxOutputTokens: 512 };
  const added = { id: "indexus-email-monitoring:v1", maxOutputTokens: 200 };
  const a = inventorySummary([old], [old], "SYNTHETIC_SECRET_TOKEN");
  const b = inventorySummary([added, old], [old, added], "SYNTHETIC_SECRET_TOKEN");
  assert.equal(a.inventorySha256, b.inventorySha256);
  assert.equal(b.originalDocumentModelListed, true); assert.equal(b.originalDocumentModelDeclared, true);
  assert.equal(b.historicallyUnchanged, null);
  assert.notEqual(a.inventorySha256, inventorySummary([old], [{ ...old, maxOutputTokens: 100 }], "SYNTHETIC_SECRET_TOKEN").inventorySha256);
  assert.throws(() => inventorySummary([{ id: "SYNTHETIC_SECRET_TOKEN" }], [], "SYNTHETIC_SECRET_TOKEN"), /B1_DISCOVERY_UNSAFE_INVENTORY/);
});
