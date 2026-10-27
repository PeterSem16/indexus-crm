"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { safeError, probe } = require("./diagnose-status-list-production.cjs");
test("database failures contain only SQLSTATE and safe schema identifiers", () => {
  const result = safeError({ code: "42703", column: "revision", table: "sources",
    message: "private message", detail: "private value", connectionString: "secret" });
  assert.equal(result.code, "42703");
  assert.equal(result.column, "revision");
  assert.ok(!JSON.stringify(result).includes("private"));
  assert.ok(!JSON.stringify(result).includes("secret"));
  assert.equal(safeError({ column: "unsafe value@example.test" }).column, undefined);
});
test("source writer probe is planned inside a read-only transaction and never ANALYZE", async () => {
  const calls = [];
  const client = { query: async sql => { calls.push(sql); return { rows: [] }; } };
  await probe(client, "source_write_plan", "EXPLAIN SELECT 1");
  assert.deepEqual(calls, ["BEGIN READ ONLY", "SET LOCAL statement_timeout='10s'", "EXPLAIN SELECT 1", "ROLLBACK"]);
  await assert.rejects(() => probe(client, "unknown", "SELECT 1"), /UNKNOWN_PROBE/);
});
