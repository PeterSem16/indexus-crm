import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { ensureForwardedCallSchema } from "./forwarded-call-schema";

test("required migration is awaited before routes and queue handling", () => {
  const source = readFileSync("server/index.ts", "utf8");
  const migration = source.indexOf("await ensureForwardedCallSchema(pool)");
  assert.ok(migration > 0);
  assert.ok(source.indexOf("await registerRoutes", migration) > migration);
});

test("migration errors propagate instead of permitting call handling", async () => {
  await assert.rejects(ensureForwardedCallSchema({
    query: async () => { throw new Error("synthetic migration failure"); },
  }), /synthetic migration failure/);
});

test("pre-change database startup creates durable table idempotently with constraints", async () => {
  assert.ok(process.env.DATABASE_URL, "Run this integration test against the development database");
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const schema = `forward_test_${randomUUID().replaceAll("-", "")}`;
  await client.connect();
  try {
    await client.query("BEGIN");
    // Only synthetic objects in this transaction's private schema are touched.
    // Rollback removes them even if assertions or DDL fail.
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET LOCAL search_path TO ${schema}, public`);
    await client.query(`
      CREATE TABLE call_logs (id varchar PRIMARY KEY);
      CREATE TABLE inbound_call_logs (id varchar PRIMARY KEY);
      INSERT INTO call_logs VALUES ('canonical');
      INSERT INTO inbound_call_logs VALUES ('inbound');
    `);
    assert.equal((await client.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema=$1 AND table_name='queue_forwarded_calls'",
      [schema],
    )).rows[0].n, 0);
    await ensureForwardedCallSchema(client);
    await ensureForwardedCallSchema(client);
    const columns = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='queue_forwarded_calls'",
      [schema],
    );
    assert.equal(columns.rows.length, 20);
    const constraints = await client.query(
      "SELECT contype FROM pg_constraint WHERE conrelid=$1::regclass", [`${schema}.queue_forwarded_calls`],
    );
    assert.equal(constraints.rows.filter(row => row.contype === "f").length, 2);
    assert.equal(constraints.rows.filter(row => row.contype === "p").length, 1);
    const indexes = await client.query(
      "SELECT indexname FROM pg_indexes WHERE schemaname=$1 AND tablename='queue_forwarded_calls'", [schema],
    );
    assert.ok(indexes.rows.some(row => row.indexname === "queue_forwarded_calls_pending"));
    const insert = `INSERT INTO queue_forwarded_calls
      (root_unique_id,pbx_host,pbx_ssh_port,inbound_call_log_id,call_log_id,
       transferred_at,recording_name,recording_path,user_id,caller_number)
      VALUES ('root','test.invalid',22,'inbound','canonical',now(),'test','/test','test','synthetic')`;
    await client.query(insert);
    await client.query("SAVEPOINT duplicate");
    await assert.rejects(client.query(insert), (error: any) => error.code === "23505");
    await client.query("ROLLBACK TO SAVEPOINT duplicate");
    assert.equal((await client.query("SELECT count(*)::int AS n FROM queue_forwarded_calls")).rows[0].n, 1);
    await client.query("SAVEPOINT incompatible");
    await client.query("ALTER TABLE queue_forwarded_calls RENAME COLUMN evidence TO incompatible_evidence");
    await assert.rejects(ensureForwardedCallSchema(client), (error: any) => error.code === "42703");
    await client.query("ROLLBACK TO SAVEPOINT incompatible");
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
});