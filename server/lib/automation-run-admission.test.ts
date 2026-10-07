import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { admitAutomationRun } from "./automation-run-admission";

test("PostgreSQL quota admission is atomic, rolling, fail-closed and excludes skipped events", async () => {
  const schema = `automation_quota_${randomUUID().replace(/-/g, "")}`;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 20 });
  const setup = await pool.connect();
  const scoped = { connect: async () => {
    const client = await pool.connect();
    await client.query(`SET search_path TO "${schema}"`);
    return client;
  } };
  const request = (ruleId: string, eventId: string | null = randomUUID()) => admitAutomationRun(scoped, {
    ruleId, eventId, payload: { event: { id: eventId }, note: "No actions in this test" }, causationChain: [],
  });
  try {
    await setup.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}";
      CREATE TABLE workflow_rules (id text PRIMARY KEY, rate_limit_per_hour integer);
      CREATE TABLE workflow_runs (
        id text PRIMARY KEY DEFAULT gen_random_uuid(), rule_id text NOT NULL REFERENCES workflow_rules(id),
        event_id text, status text, skipped_reason text, payload jsonb, causation_chain text[],
        started_at timestamp NOT NULL DEFAULT now(), finished_at timestamp
      );
      INSERT INTO workflow_rules VALUES ('parallel',3),('independent',1),('rolling',1),
        ('failed',1),('unlimited',NULL),('zero',0),('negative',-1),('edited',5);
    `);
    const parallel = await Promise.all(Array.from({ length: 24 }, () => request("parallel")));
    assert.equal(parallel.filter(result => result.admitted).length, 3);
    assert.equal(new Set(parallel.map(result => result.runId)).size, 24);
    const rows = (await setup.query("SELECT status,count(*)::int AS count FROM workflow_runs WHERE rule_id='parallel' GROUP BY status")).rows;
    assert.equal(rows.find(row => row.status === "running").count, 3);
    assert.equal(rows.find(row => row.status === "skipped").count, 21);
    assert.equal((await request("independent")).admitted, true);
    assert.equal((await request("independent")).admitted, false);

    await setup.query(`INSERT INTO workflow_runs (rule_id,status,skipped_reason,started_at) VALUES
      ('rolling','success',NULL,clock_timestamp()-interval '61 minutes'),
      ('rolling','skipped','rate_limit',clock_timestamp()),
      ('rolling','skipped','condition_false',clock_timestamp()),
      ('rolling','skipped','loop_guard',clock_timestamp()),
      ('failed','failed',NULL,clock_timestamp());
    `);
    const scheduledRun = await request("rolling", null);
    assert.equal(scheduledRun.admitted, true);
    assert.equal((await request("rolling")).admitted, false);
    assert.equal((await request("failed")).admitted, false); // Failed actual attempts consume quota.
    await setup.query("UPDATE workflow_runs SET started_at=clock_timestamp()-interval '61 minutes' WHERE rule_id='rolling' AND status='running'");
    assert.equal((await request("rolling")).admitted, true); // Recent skips do not prolong blocking.
    for (const id of ["unlimited", "zero", "negative"]) {
      const results = await Promise.all(Array.from({ length: 5 }, () => request(id)));
      assert.equal(results.every(result => result.admitted), true);
    }
    assert.equal((await request("edited")).admitted, true);
    await setup.query("UPDATE workflow_rules SET rate_limit_per_hour=1 WHERE id='edited'");
    assert.equal((await request("edited")).admitted, false); // Uses saved quota, not a caller snapshot.
    await setup.query("UPDATE workflow_rules SET rate_limit_per_hour=0 WHERE id='edited'");
    assert.equal((await request("edited")).admitted, true);
    const scheduled = (await setup.query("SELECT event_id,causation_chain FROM workflow_runs WHERE id=$1", [scheduledRun.runId])).rows;
    assert.equal(scheduled[0].event_id, null);
    assert.deepEqual(scheduled[0].causation_chain, []);
    const beforeMissing = (await setup.query("SELECT count(*)::int AS count FROM workflow_runs")).rows[0].count;
    await assert.rejects(request("deleted-rule"), /no longer exists/);
    assert.equal((await setup.query("SELECT count(*)::int AS count FROM workflow_runs")).rows[0].count, beforeMissing);
    const lockCheck = await scoped.connect();
    try {
      await lockCheck.query("BEGIN");
      assert.equal((await lockCheck.query("SELECT pg_try_advisory_xact_lock(hashtextextended('indexus:automation:quota:parallel',0)) AS locked")).rows[0].locked, true);
      await lockCheck.query("ROLLBACK");
    } finally { lockCheck.release(); }
  } finally {
    await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    setup.release();
    await pool.end();
  }
});

test("engine reserves before actions and keeps schedule payload identity bounded", async () => {
  const source = await readFile("server/lib/automation-engine.ts", "utf8");
  const entry = source.slice(source.indexOf("export async function runRule("));
  assert.ok(entry.indexOf("admitAutomationRun(pool") < entry.indexOf("const actions ="));
  assert.ok(entry.indexOf("if (!reservation.admitted) return") < entry.indexOf("await handler("));
  assert.match(entry, /eventId: scheduled \? null : event\.id/);
  assert.doesNotMatch(source, /rateLimitOk/);
});

test("database failure rolls back and releases instead of admitting an action", async () => {
  let released = false;
  const queries: string[] = [];
  await assert.rejects(admitAutomationRun({ connect: async () => ({
    query: async sql => { queries.push(sql); if (sql.includes("pg_advisory")) throw new Error("lock unavailable"); return { rows: [] }; },
    release: () => { released = true; },
  }) }, { ruleId: "r", eventId: null, payload: {}, causationChain: [] }), /lock unavailable/);
  assert.deepEqual(queries.map(sql => sql.split(" ")[0]), ["BEGIN", "SELECT", "ROLLBACK"]);
  assert.equal(released, true);
});
