import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { pool } from "../db";
import { STANDALONE_AUTOMATION_SCHEMA, ensureStandaloneAutomationSchema } from "./standalone-automation-schema";

test("real PostgreSQL: fresh and legacy bootstrap preserve rows and access settings", async () => {
  const client = await pool.connect();
  const schema = `automation_test_${randomUUID().replaceAll("-", "")}`;
  try {
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    // Legacy rule table predates the three country/scheduling additions.
    const legacyRules = STANDALONE_AUTOMATION_SCHEMA.match(/CREATE TABLE IF NOT EXISTS workflow_rules \([\s\S]+?\n\);/)![0]
      .replace("country_code text, country_codes text[]", "country_code text");
    await client.query(legacyRules);
    await client.query(`INSERT INTO workflow_rules (id,name,module,trigger,actions,enabled)
      VALUES ('kept','test','task','{}','[]',false)`);
    await ensureStandaloneAutomationSchema(client);
    await client.query(`UPDATE task_assignment_access SET allowed_user_ids=ARRAY['test-only'] WHERE id=1`);
    await client.query(`INSERT INTO workflow_events (id,source,module,entity_type,event_type)
      VALUES ('kept-event','manual','task','task','created')`);
    await ensureStandaloneAutomationSchema(client);
    assert.equal((await client.query("SELECT count(*)::int n FROM workflow_rules")).rows[0].n, 1);
    assert.equal((await client.query("SELECT count(*)::int n FROM workflow_events")).rows[0].n, 1);
    assert.equal((await client.query("SELECT enabled FROM workflow_rules WHERE id='kept'")).rows[0].enabled, false);
    assert.deepEqual((await client.query("SELECT allowed_user_ids FROM task_assignment_access WHERE id=1")).rows[0].allowed_user_ids, ["test-only"]);
    assert.equal((await client.query("SELECT count(*)::int n FROM workflow_runs")).rows[0].n, 0);
    assert.equal((await client.query("SELECT count(*)::int n FROM workflow_action_log")).rows[0].n, 0);
    // A separate entirely fresh schema tests all five CREATE paths.
    const fresh = `${schema}_fresh`;
    await client.query(`CREATE SCHEMA "${fresh}"`);
    await client.query(`SET LOCAL search_path TO "${fresh}", public`);
    await ensureStandaloneAutomationSchema(client);
    assert.equal((await client.query("SELECT count(*)::int n FROM workflow_rules")).rows[0].n, 0);
    assert.equal((await client.query("SELECT allowed_user_ids FROM task_assignment_access")).rows[0].allowed_user_ids, null);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});