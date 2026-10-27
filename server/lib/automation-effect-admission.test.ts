import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { analysisEffectSourceKey, claimAnalysisEffect } from "./automation-effect-admission";
import { ensureAutomationRetrySchema } from "./automation-retry-schema";

test("durable effects serialize workers, preserve legacy history and resume only unstarted positions", async () => {
  const schema = `retry_effect_${randomUUID().replaceAll("-", "")}`;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 12 });
  const setup = await pool.connect();
  const scoped = { connect: async () => {
    const client = await pool.connect();
    await client.query(`SET search_path TO "${schema}",public`);
    return client;
  } };
  const input = { ruleId: "rule", runId: "new", entityId: "message", eventType: "chat.received",
    sourceKey: JSON.stringify(["communication", "chat.received", "message"]), actionIndex: 0 };
  try {
    await setup.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}",public;
      CREATE TABLE workflow_events(id text PRIMARY KEY,module text,event_type text,entity_id text);
      CREATE TABLE workflow_runs(id text PRIMARY KEY,rule_id text,event_id text,status text,payload jsonb,finished_at timestamptz);
      CREATE TABLE workflow_action_log(id text PRIMARY KEY,run_id text,action_index integer,status text);
      INSERT INTO workflow_events VALUES ('e','communication','chat.received','message');
    `);
    await ensureAutomationRetrySchema(setup);
    const parallel = await Promise.all(Array.from({ length: 32 }, (_, i) =>
      claimAnalysisEffect(scoped, { ...input, runId: `parallel-${i}` })));
    assert.equal(parallel.filter(r => r === "claimed").length, 1, "only one worker may call any external provider");
    assert.equal(parallel.filter(r => r === "uncertain").length, 31);
    assert.equal(await claimAnalysisEffect(scoped, input), "uncertain", "crash before/after provider response is never retried");
    await setup.query("UPDATE workflow_analysis_effects SET status='success'");
    assert.equal(await claimAnalysisEffect(scoped, input), "success", "completed effect is remembered across workers");
    assert.equal(await claimAnalysisEffect(scoped, { ...input, actionIndex: 1 }), "claimed", "unstarted action can continue");
    assert.equal(await claimAnalysisEffect(scoped, { ...input, eventType: "task.message_received", sourceKey: "other" }), "claimed");
    assert.equal(await claimAnalysisEffect(scoped, { ...input, ruleId: "another" }), "claimed");
    await setup.query(`DELETE FROM workflow_analysis_effects;
      INSERT INTO workflow_runs VALUES('legacy','rule','e','failed','{"rule":{"actions":[]}}',now());
      INSERT INTO workflow_action_log VALUES('l','legacy',0,'success'),('l2','legacy',1,'failed');
    `);
    assert.equal(await claimAnalysisEffect(scoped, input), "success");
    assert.equal(await claimAnalysisEffect(scoped, { ...input, actionIndex: 1 }), "uncertain",
      "a failed email may have been accepted, so it is not resent");
    assert.equal(await claimAnalysisEffect(scoped, { ...input, actionIndex: 2 }), "claimed");
    assert.notEqual(analysisEffectSourceKey({ id: "v1", module: "communication", entityId: "task", eventType: "task.body_received" }),
      analysisEffectSourceKey({ id: "v2", module: "communication", entityId: "task", eventType: "task.body_received" }),
      "a later Task revision remains an independently processable source");
    assert.equal((await setup.query("SELECT count(*)::int n FROM workflow_action_log")).rows[0].n, 2,
      "legacy audit rows are never overwritten");
    await setup.query(`DELETE FROM workflow_analysis_effects; DELETE FROM workflow_action_log;
      UPDATE workflow_runs SET status='running',finished_at=NULL`);
    assert.equal(await claimAnalysisEffect(scoped, { ...input, actionIndex: 9 }), "uncertain",
      "an interrupted pre-ledger run has unknown unlogged effects");
    await setup.query(`DELETE FROM workflow_analysis_effects;
      UPDATE workflow_runs SET payload='{"effectAdmission":"v1","rule":{"actions":[]}}'`);
    assert.equal(await claimAnalysisEffect(scoped, { ...input, actionIndex: 9 }), "claimed",
      "new interrupted runs use durable per-action claims rather than blocking unstarted actions");
    assert.equal(await claimAnalysisEffect(scoped, { ...input, actionIndex: 10, actions: [{ type: "send_email" }] }), "uncertain",
      "moving/editing actions cannot resend completed effects at another index");
    await setup.query(`DELETE FROM workflow_analysis_effects;
      UPDATE workflow_runs SET status='skipped',payload=NULL,finished_at=now()`);
    assert.equal(await claimAnalysisEffect(scoped, input), "claimed", "skipped analysis has no external effect");
    await ensureAutomationRetrySchema(setup);
    assert.equal((await setup.query("SELECT count(*)::int n FROM workflow_analysis_effects")).rows[0].n, 1);
  } finally {
    await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    setup.release();
    await pool.end();
  }
});
