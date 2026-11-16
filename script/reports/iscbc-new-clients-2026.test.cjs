"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadConfig, safeError, inspect, INSPECTION, COHORT } = require("./iscbc-new-clients-2026.cjs");

const source = (password, server = "fixture") => `const MSSQL_CONFIG = {
  server:'${server}', user:'fixture', port:1433, database:'CBC',
  password:${password}, options:{instanceName:'REMOVE_ME'}
};`;
const read = (sync, legacy) => file => {
  if (file.endsWith("sync-collaborators-iscbc.cjs")) return sync;
  if (file.endsWith("test-migration-20.cjs")) return legacy;
  throw new Error("Unexpected file");
};

test("loads only configuration, never runs migration body", () => {
  const config = loadConfig("/fixture", {}, read(
    source("'fixture-only'") + "\nthrow new Error('MIGRATION_MUST_NOT_RUN');",
    "unused",
  ));
  assert.equal(config.database, "CBC");
  assert.equal(config.pool.max, 1);
  assert.equal(config.requestTimeout, 60000);
  assert.equal(config.options.instanceName, undefined);
  assert.equal(config.options.readOnlyIntent, true);
});

test("uses existing alternate password only for an exact connection identity", () => {
  assert.equal(loadConfig("/fixture", {}, read(
    source("process.env.CBC_DB_PASSWORD"), source("'fixture-only'"),
  )).password, "fixture-only");
  assert.throws(() => loadConfig("/fixture", {}, read(
    source("undefined"), source("'fixture-only'", "different"),
  )), { code: "CONFIG_IDENTITY_MISMATCH" });
  assert.throws(() => loadConfig("/fixture", {}, read(
    source("undefined"), source("undefined"),
  )), { code: "CONFIG_PASSWORD_MISSING" });
});

test("SQL Server 2008-compatible cohort aggregates derived flags, not a subquery", () => {
  const query = INSPECTION.find(([name]) => name === "COHORT")[1];
  assert.match(query, /FROM \(\s*SELECT/);
  assert.doesNotMatch(query.split("FROM (")[0], /\b(SELECT|EXISTS)\b.*\bFROM\b/i);
  assert.doesNotMatch(query, /SUM\(\s*(?:CONVERT\(\s*bigint,\s*)?CASE WHEN NOT EXISTS/i);
  assert.match(COHORT, />= '20260101'/);
  assert.match(COHORT, /< '20270101'/);
  assert.doesNotMatch(COHORT, /deleted|country/i);
});

test("inspection statements are read-only metadata, reference or aggregate queries", () => {
  for (const [, query] of INSPECTION) {
    if (!query) continue;
    assert.match(query.trim(), /^SELECT\b/);
    assert.doesNotMatch(query, /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|EXEC|MERGE|TRUNCATE|INTO)\b/i);
    assert.doesNotMatch(query, /\b(pda_first_name|pda_last_name|rem_note|cli_note|password)\b/i);
  }
});

test("errors never print raw messages and independent checks continue", async () => {
  const logs = [];
  const error = Object.assign(new Error("DO_NOT_PRINT_PRIVATE_CONTENT"), { code: "EREQUEST", number: 130 });
  let calls = 0;
  const failures = await inspect({ request: () => ({ query: async () => {
    if (++calls === 2) throw error;
    return { recordset: [] };
  } }) }, "/fixture", text => logs.push(text));
  assert.equal(failures, 1);
  assert.equal(calls, INSPECTION.filter(([, sql]) => sql).length);
  assert.match(logs.join("\n"), /SQL_NUMBER=130/);
  assert.doesNotMatch(logs.join("\n"), /DO_NOT_PRINT/);
  assert.equal(safeError(Object.assign(error, { code: "private content" })), "CODE=ERROR SQL_NUMBER=130");
});
