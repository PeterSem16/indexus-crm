import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { readBackgroundDiagnostics } from "./status-list-background-diagnostics";
import { createStatusListServiceWriteGuard } from "./status-list-native-service";

if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) throw Error("Development fixtures only");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
const schema = `background_truth_${randomUUID().replaceAll("-", "")}`;
try {
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET search_path TO "${schema}"`);
  await client.query(`
    CREATE TABLE campaigns(id varchar PRIMARY KEY,name text,country_codes text[]);
    CREATE TABLE campaign_contacts(id varchar PRIMARY KEY,campaign_id varchar);
    CREATE TABLE campaign_status_list_items(id varchar PRIMARY KEY,campaign_id varchar,parent_id varchar,label text,sort_order int,is_hidden boolean);
    CREATE TABLE campaign_status_list_questions(id varchar PRIMARY KEY,item_id varchar);
    CREATE TABLE campaign_status_list_automations(id varchar PRIMARY KEY,status_list_item_id varchar,question_id varchar);
    CREATE TABLE mission_status_list_sources(question_id varchar,campaign_id varchar);
    CREATE TABLE mission_status_list_option_sources(group_id varchar PRIMARY KEY,campaign_id varchar,config jsonb,revision varchar);
    CREATE TABLE mission_status_list_option_source_state(campaign_contact_id varchar,group_id varchar,config_revision varchar,value text,updated_at timestamptz);
    CREATE TABLE mission_status_list_rules(id varchar,campaign_id varchar,definition jsonb);
    CREATE TABLE mission_status_list_transitions(id varchar,campaign_id varchar,question_id varchar,created_at timestamptz,baseline boolean,target_kind text,previous_label text,value_label text);
    INSERT INTO campaigns VALUES('mission','Test',ARRAY['SK']),('foreign','Foreign',ARRAY['HU']);
    INSERT INTO campaign_contacts VALUES('one','mission'),('two','mission'),('three','mission'),('outsider','foreign');
    INSERT INTO campaign_status_list_items VALUES
      ('group','mission',NULL,'Reachability',0,true),('option','mission','group','Reachable',1,false),
      ('manual','mission',NULL,'Manual',2,false),('foreign-option','foreign',NULL,'Foreign',0,false);
    INSERT INTO campaign_status_list_questions VALUES('derived-question','manual');
    INSERT INTO mission_status_list_sources VALUES('derived-question','mission');
    INSERT INTO campaign_status_list_automations VALUES('action','option',NULL),('q-action','manual','derived-question'),('foreign-action','foreign-option',NULL);
    INSERT INTO mission_status_list_option_sources VALUES('group','mission','{"source":"reachability"}','current');
    INSERT INTO mission_status_list_option_source_state VALUES
      ('one','group','current','reachable','2026-10-01T10:00:00Z'),
      ('two','group','old','unreachable','2026-10-01T11:00:00Z'),
      ('outsider','group','current','reachable','2026-10-02T10:00:00Z');
    INSERT INTO mission_status_list_rules VALUES
      ('background','mission','{"name":"Background","enabled":true,"trigger":"background_transition","source":{"kind":"item","id":"option"}}'),
      ('disabled','mission','{"name":"Disabled","enabled":false,"trigger":"background_transition","source":{"kind":"item","id":"option"}}'),
      ('manual-rule','mission','{"name":"Manual","enabled":true,"trigger":"agent_confirmation","source":{"kind":"item","id":"option"}}'),
      ('foreign-rule','foreign','{"name":"Foreign","enabled":true,"trigger":"background_transition","source":{"kind":"item","id":"option"}}');
    INSERT INTO mission_status_list_transitions VALUES
      ('baseline','mission','group','2026-10-01T10:00:00Z',true,'item',NULL,'Reachable'),
      ('change','mission','group','2026-10-01T11:00:00Z',false,'item','Reachable','Unreachable'),
      ('foreign-change','foreign','group','2026-10-02T10:00:00Z',false,'item','X','Y');
  `);
  await client.query("BEGIN READ ONLY");
  const result = await readBackgroundDiagnostics(client, "mission");
  assert.equal(result.groups.length, 1);
  const group = result.groups[0];
  assert.equal(group.totalContacts, 3);
  assert.equal(group.evaluatedContacts, 2);
  assert.equal(group.currentRevisionContacts, 1);
  assert.deepEqual(group.states, [{ value: "reachable", count: 1 }]);
  assert.equal(group.lastEvaluatedAt.toISOString(), "2026-10-01T11:00:00.000Z");
  assert.deepEqual(group.legacyActions, [{ itemId: "option", label: "Reachable", count: 1 }]);
  assert.deepEqual(group.rules.map((r: any) => r.id), ["background", "disabled", "manual-rule"]);
  assert.deepEqual(group.transitions.map((t: any) => [t.id,t.baseline]), [["change",false],["baseline",true]]);
  assert.deepEqual(await readBackgroundDiagnostics(client, "foreign"), { groups: [] });
  // A GET diagnostic must never establish a baseline, alter answers or claim runs.
  assert.deepEqual(await readBackgroundDiagnostics(client, "mission"), result);
  const guard = createStatusListServiceWriteGuard({
    query: (sql, values) => client.query(sql, values),
    gateway: async () => null,
  });
  async function checkGuard(itemId: string, method: string, expected: number, extra = {}, role = "admin") {
    let status = 0, body: any, next = false;
    await guard({ method, params: { campaignId: "mission", itemId, ...extra },
      session: { user: { id: "admin", role, assignedCountries: [] } },
      body: { actionType: "set_callback" } } as any,
    { status(code: number) { status = code; return this; }, json(value: any) { body = value; } } as any,
    () => { next = true; });
    assert.equal(status, expected);
    assert.equal(next, expected === 0);
    if (expected === 409) assert.equal(body.error, "background_service_action_not_supported");
  }
  await checkGuard("option", "POST", 409);
  await checkGuard("group", "POST", 409);
  await checkGuard("option", "PUT", 409, { autoId: "action" });
  await checkGuard("manual", "POST", 409, { questionId: "derived-question" });
  await checkGuard("manual", "PUT", 409, { autoId: "q-action" });
  await checkGuard("manual", "POST", 0);
  await checkGuard("option", "DELETE", 0, { autoId: "action" });
  await checkGuard("option", "POST", 403, {}, "user");
  await client.query("ROLLBACK");
  console.log("Background truth: read-only diagnostics, Mission isolation, revisions, baseline/change evidence, service write guards and delete access passed");
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.query("SET search_path TO public");
  await client.query(`DROP SCHEMA "${schema}" CASCADE`);
  client.release();
  await pool.end();
}
