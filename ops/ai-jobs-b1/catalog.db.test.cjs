"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { PRODUCTION_PRIVILEGES } = require("./prepare-db.cjs");

test("real PostgreSQL checks restricted-role privileges without applying sequence ACLs to tables",
  { skip: !(process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN)
      ? "Development catalog only; never connect to CORPCRM01 from this regression" : false },
  async () => {
    const { Client } = require("pg");
    const client = new Client({ connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000, query_timeout: 10000 });
    client.on("error", () => {});
    try {
      await client.connect();
      // A superuser privilege target masks this PostgreSQL wrong-object failure.
      // The predefined restricted role exercises the same type check as B1,
      // without creating, altering, granting to or impersonating any role.
      await assert.rejects(client.query(`SELECT has_sequence_privilege('pg_monitor',
        (SELECT oid FROM pg_class WHERE relkind='r' LIMIT 1), 'USAGE')`),
      error => error.code === "42809");
      const results = await client.query(PRODUCTION_PRIVILEGES.replaceAll("'indexus_ai_b1'", "'pg_monitor'"));
      const row = results.find(result => result.rows?.[0]?.json_build_object)?.rows[0].json_build_object;
      assert(row);
      for (const field of ["dataAccess", "sequenceAccess", "definerAccess"])
        assert.equal(typeof row[field], "boolean");
    } finally { await client.end(); }
  });
