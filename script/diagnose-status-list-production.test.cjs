"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { safeError, probe, parseDatabaseUrl } = require("./diagnose-status-list-production.cjs");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
test("standalone stdin entry needs no separately installed operator helper", () => {
  const source = fs.readFileSync(require.resolve("./diagnose-status-list-production.cjs"), "utf8");
  assert.ok(!source.includes("automation-production-db-admin.cjs"));
  const result = spawnSync(process.execPath, ["-"], { input: source, encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stderr.trim()).code, "WRONG_HOST");
});
test("standalone configuration parsing accepts quoted URLs and rejects malformed configuration", () => {
  for (const quoted of ["postgresql://localhost/example", "'postgresql://localhost/example'", '"postgresql://localhost/example"']) {
    assert.equal(parseDatabaseUrl(`OTHER=value\nDATABASE_URL=${quoted}\n`), "postgresql://localhost/example");
  }
  assert.throws(() => parseDatabaseUrl("OTHER=value"), { code: "DATABASE_CONFIG_MISSING" });
  assert.throws(() => parseDatabaseUrl("DATABASE_URL=not-a-url"), { code: "DATABASE_CONFIG_INVALID" });
  assert.throws(() => parseDatabaseUrl("DATABASE_URL=https://localhost/example"), { code: "DATABASE_CONFIG_INVALID" });
});
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
