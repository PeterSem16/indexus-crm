import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { transformSync } from "esbuild";
import pg from "pg";
import { getTableColumns, SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { callLogs } from "../../shared/schema";
import { STATUS_LIST_SERVICE_SCHEMA } from "./status-list-service-schema";
import { executeCallbackEvent, drainCallbackEvents, runManagedCallback, callbackBarrier, callbackAdmission, CALLBACK_CONVERTER } from "./status-list-service";
import { readCallbackServiceStatus } from "./status-list-service-status";
import { readTransitionInventory } from "./status-list-transition-inventory";
import { medicalPartnerAudit, MEDICAL_PARTNER_AUDIT_CAMPAIGN } from "../../shared/status-list-transition-audit";
import { prepareCallbackTransition } from "./status-list-service-transition";
import { CALLBACK_TRANSITION_SCHEMA } from "./status-list-callback-transition-schema";
import { persistCallbackConfirmation } from "./status-list-callback-transition";
import { transitionConditionPasses } from "../../shared/status-list-transition";
import { CALLBACK_DEFERRED_PREDICATE } from "./status-list-service-pending";

if (process.env.NODE_ENV === "production") throw new Error("Development-only integration test");
const schema = `callback_test_${randomUUID().replace(/-/g, "")}`;
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
await admin.query(`CREATE SCHEMA ${schema}`);
const options = { connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema},public`, connectionTimeoutMillis: 5000 };
const pool = new pg.Pool({ ...options, max: 10 });
const admissionPool = new pg.Pool({ ...options, max: 4 });
const campaignId = MEDICAL_PARTNER_AUDIT_CAMPAIGN;
const audited = medicalPartnerAudit(campaignId)!;
try {
  await pool.query(`
    CREATE TABLE campaigns(id varchar PRIMARY KEY,country_codes jsonb);
    CREATE TABLE campaign_contacts(id varchar PRIMARY KEY,campaign_id varchar,contact_type text,
      clinic_id varchar,hospital_id varchar,collaborator_id varchar,customer_id varchar,
      status text,callback_date timestamptz,callback_note text,callback_status_list_item_id varchar,
      assigned_to varchar,disposition_code text,updated_at timestamptz);
    CREATE TABLE campaign_status_list_items(id varchar PRIMARY KEY,campaign_id varchar,step_id text,sort_order int,
      parent_id varchar,question_selection_mode text DEFAULT 'multiple');
    CREATE TABLE campaign_status_list_questions(id varchar,item_id varchar);
    CREATE TABLE campaign_dispositions(id varchar PRIMARY KEY,campaign_id varchar,action_type text,code text);
    CREATE TABLE campaign_status_list_automations(id varchar PRIMARY KEY,status_list_item_id varchar,
      question_id varchar,action_type text,disposition_id varchar,condition_json text,
      condition_field text,condition_operator text,condition_value text,
      callback_offset_days int,callback_time text,callback_business_days_only boolean,
      callback_existing_policy text,sort_order int,service_action_config jsonb,service_action_owner_id varchar);
    CREATE TABLE campaign_contact_status_list_state(id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      campaign_contact_id varchar,status_list_item_id varchar,confirmed_by_user_id varchar,
      confirmed_at timestamptz DEFAULT now());
    CREATE TABLE campaign_contact_history(id bigserial PRIMARY KEY,campaign_contact_id varchar,user_id varchar,action text,metadata jsonb);
    CREATE TABLE mission_status_list_rules(id varchar,campaign_id varchar);
    CREATE TABLE mission_status_list_sources(question_id varchar,campaign_id varchar);
    CREATE TABLE mission_status_list_option_sources(group_id varchar,campaign_id varchar);
    CREATE TABLE mission_status_list_dirty(kind text,entity_id varchar);
  `);
  // Use the actual application's call-log definition, including all required
  // fields and defaults. A hand-written contact_id substitute hid a real error.
  const dialect = new PgDialect();
  const literal = (value: unknown): string => value instanceof SQL ? dialect.sqlToQuery(value).sql :
    typeof value === "string" ? `'${value.replace(/'/g, "''")}'` : String(value);
  const callLogDdl = Object.values(getTableColumns(callLogs)).map(column =>
    `"${column.name}" ${column.getSQLType()}${column.notNull ? " NOT NULL" : ""}${column.primary ? " PRIMARY KEY" : ""}` +
    (column.default === undefined ? "" : ` DEFAULT ${literal(column.default)}`)).join(",");
  await pool.query(`CREATE TABLE call_logs(${callLogDdl})`);
  const logColumns = (await pool.query(`SELECT column_name FROM information_schema.columns
    WHERE table_schema=$1 AND table_name='call_logs'`, [schema])).rows.map(r => r.column_name);
  assert.ok(!logColumns.includes("contact_id"));
  assert.ok(logColumns.includes("customer_id") && logColumns.includes("campaign_contact_id"));
  const routeSource = readFileSync(new URL("../routes.ts", import.meta.url), "utf8");
  assert.equal((routeSource.match(/callbackAdmission\(callbackAdmissionPool,/g) ?? []).length, 2,
    "both real HTTP routes must use the dedicated lock pool");
  assert.ok(!routeSource.includes("callbackAdmission(pool,"));
  await pool.query(CALLBACK_TRANSITION_SCHEMA);
  await pool.query(STATUS_LIST_SERVICE_SCHEMA);
  await pool.query(STATUS_LIST_SERVICE_SCHEMA); // startup is idempotent
  await pool.query("INSERT INTO campaigns VALUES($1,'[\"SK\"]')", [campaignId]);
  for (const a of audited.actions.filter(a => a.callback)) {
    await pool.query("INSERT INTO campaign_status_list_items VALUES($1,$2,$3,0)", [a.itemId, campaignId, a.stepCode]);
    if (a.dispositionId) await pool.query("INSERT INTO campaign_dispositions VALUES($1,$2,'callback',$3)", [a.dispositionId, campaignId, `disp:${a.stepCode}`]);
    const condition = a.condition.kind === "call_count" ? { logic: a.condition.logic,
      rules: a.condition.rules.map(r => ({ field: "call_count", op: r.op, value: String(r.value) })) } : null;
    await pool.query(`INSERT INTO campaign_status_list_automations VALUES($1,$2,NULL,$3,$4,$5,
      NULL,NULL,NULL,$6,$7,true,'replace',0)`,
    [a.id, a.itemId, a.type, a.dispositionId, condition && JSON.stringify(condition), a.callback!.days, a.callback!.time]);
  }
  // Real startup adds this default; inventory and SQL enqueue must hash it identically.
  await pool.query("ALTER TABLE campaign_status_list_automations ADD COLUMN execution_policy text NOT NULL DEFAULT 'inherit'");
  // Unenrolled insert has NO effect. Historical state becomes baseline on enrollment.
  await pool.query(`INSERT INTO campaign_contacts VALUES('c',$1,'clinic','clinic',NULL,NULL,NULL,
    'callback_scheduled','2020-01-01T08:00Z','old note',NULL,'old agent','old disposition',now())`, [campaignId]);
  await pool.query("INSERT INTO campaigns VALUES('other-mission','[\"SK\"]')");
  await pool.query(`INSERT INTO campaign_contacts(id,campaign_id,contact_type,clinic_id)
    VALUES('c-other-mission','other-mission','clinic','clinic'),
      ('unrelated','other-mission','clinic','unrelated-clinic')`);
  const burstAction = audited.actions.find(a => a.type === "set_callback")!;
  async function assertCapacityBurst(enrolled: boolean) {
    let completed = 0;
    const failures: unknown[] = [];
    const ids: string[] = [];
    const handler = callbackAdmission(admissionPool, async () => {
      // Every handler holds admission while it needs the ordinary query pool.
      await pool.query("SELECT pg_sleep(0.005)");
      const connection = await pool.connect();
      const id = randomUUID();
      ids.push(id);
      try {
        await connection.query("BEGIN");
        await connection.query("SELECT set_config('indexus.callback_context','{\"admitted\":true}',true)");
        await connection.query(`INSERT INTO campaign_contact_status_list_state
          VALUES($1,'c',$2,'capacity agent',now())`, [id, burstAction.itemId]);
        await connection.query("COMMIT");
      } finally { connection.release(); }
      await drainCallbackEvents(pool);
      completed++;
    });
    await Promise.all(Array.from({ length: 10 }, () => handler({ params: { campaignId } } as any,
      {} as any, error => { if (error) failures.push(error); })));
    assert.deepEqual(failures, []);
    assert.equal(completed, 10, "pool-capacity request burst must finish without starvation");
    const receipts = (await pool.query("SELECT state FROM mission_callback_service_events WHERE event_id=ANY($1)",
      [ids.map(id => `confirmation:${id}`)])).rows;
    assert.equal(receipts.length, enrolled ? 10 : 0);
    assert.ok(receipts.every(r => r.state === "done"));
    assert.ok(admissionPool.totalCount <= 4);
  }
  await assertCapacityBurst(false);
  await pool.query(`INSERT INTO campaign_contact_status_list_state(id,campaign_contact_id,status_list_item_id,confirmed_by_user_id)
    VALUES('baseline','c',$1,'old agent')`, [audited.actions[0].itemId]);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM mission_callback_service_events")).rows[0].n, 0);
  // Production converter must refuse fixture data pretending to be the audited raw config.
  await assert.rejects(() => prepareCallbackTransition(pool, campaignId), /callback_audit_changed/);

  // Test the real administrative functions against PostgreSQL with an independently
  // captured fixture audit. Only historical evidence is injected, never the DB,
  // executor, ownership checks, fingerprinting or transactional implementation.
  const auditClient = await pool.connect();
  const fixtureAudit = await readTransitionInventory(auditClient, campaignId).finally(() => auditClient.release());
  const source = readFileSync(new URL("./status-list-service-transition.ts", import.meta.url), "utf8").replace(/^import[\s\S]*?;\s*$/gm, "");
  const compiled = transformSync(source, { loader: "ts", format: "cjs", target: "es2022" }).code;
  const module = { exports: {} as any };
  new Function("module", "readTransitionInventory", "callbackBarrier", "CALLBACK_CONVERTER",
    "MEDICAL_PARTNER_AUDIT_CAMPAIGN", "medicalPartnerAudit", "CALLBACK_DEFERRED_PREDICATE", compiled)(
    module, readTransitionInventory, callbackBarrier, CALLBACK_CONVERTER, campaignId, () => fixtureAudit, CALLBACK_DEFERRED_PREDICATE);
  const { prepareCallbackTransition: prepare, approveCallbackTransition: approve, switchCallbackOwnership: switchOwner } = module.exports;
  await pool.query(`INSERT INTO mission_callback_ownership VALUES($1,'compatible','other',now())`, [campaignId]);
  await assert.rejects(() => prepare(pool, campaignId), /callback_other_executor_active/);
  await pool.query("DELETE FROM mission_callback_ownership");
  const plan = await prepare(pool, campaignId);
  assert.equal(plan.activationAllowed, false);
  await prepare(pool, campaignId);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM mission_callback_groups")).rows[0].n, 1);
  const evidence = { executorVersion: CALLBACK_CONVERTER, liveInventoryVerified: true, runtimeParityVerified: true,
    entryPathsDrained: true, deferredExecutionsReviewed: true, unknownDeferredExecutions: 0, backupRestoreVerified: true };
  async function approveFor(target: string, generation: number, extra = {}) {
    return approve(pool, { campaignId, fingerprint: plan.fingerprint, generation, target, approvedBy: "approver",
      backupReference: "private-backup-reference", evidence, expiresAt: new Date(Date.now() + 60000), ...extra });
  }
  await assert.rejects(() => approveFor("enroll", 0, { evidence: { ...evidence, runtimeParityVerified: false } }), /approval_incomplete/);
  await assert.rejects(() => approveFor("enroll", 0, { backupReference: "" }), /approval_incomplete/);
  await assert.rejects(() => approveFor("enroll", 0, { evidence: { ...evidence, unknownDeferredExecutions: 1 } }), /approval_incomplete/);
  await assert.rejects(() => switchOwner(pool, campaignId, "model_match"), /approval_required/);
  const enroll = await approveFor("enroll", 0);
  await pool.query("INSERT INTO mission_status_list_dirty VALUES('clinic','clinic')");
  await assert.rejects(() => switchOwner(pool, campaignId, enroll), /deferred_or_unknown_work/);
  await pool.query("DELETE FROM mission_status_list_dirty");
  await pool.query("INSERT INTO mission_status_list_dirty VALUES('unknown-kind','unknown')");
  await assert.rejects(() => switchOwner(pool, campaignId, enroll), /deferred_or_unknown_work/);
  await pool.query("DELETE FROM mission_status_list_dirty");
  await pool.query(`INSERT INTO mission_callback_events(campaign_id,campaign_contact_id,confirmation_id,
    automation_id,item_id,actor_id,owner,payload) VALUES($1,'c','prior-confirmation',$2,$3,'prior agent','legacy','{}')`,
  [campaignId, audited.actions[0].id, audited.actions[0].itemId]);
  await assert.rejects(() => switchOwner(pool, campaignId, enroll), /callback_other_executor_pending/);
  await pool.query("UPDATE mission_callback_events SET status='done'");
  await switchOwner(pool, campaignId, enroll);
  await pool.query("SELECT mission_callback_enqueue('baseline')");
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM mission_callback_service_events")).rows[0].n, 0, "no historical replay");
  assert.equal((await pool.query("SELECT callback_note FROM campaign_contacts WHERE id='c'")).rows[0].callback_note, "old note");
  await assert.rejects(() => switchOwner(pool, campaignId, enroll), /approval_required/);
  await assertCapacityBurst(true);
  const bridgeAction = plan.actions.find((a: any) => a.type === "set_callback");
  await pool.query(`INSERT INTO campaign_contacts(id,campaign_id,contact_type,clinic_id)
    VALUES('bridge-contact',$1,'clinic','clinic')`, [campaignId]);
  await pool.query(`ALTER TABLE campaign_contact_status_list_state ADD COLUMN created_at timestamptz DEFAULT now(),
    ADD COLUMN item_note text, ADD COLUMN note_updated_at timestamptz`);
  const bridged = await persistCallbackConfirmation({ campaignId, campaignContactId: "bridge-contact",
    itemId: bridgeAction.itemId, actorId: "bridge agent", itemNote: null,
    manualDate: "2026-11-03T08:00:00.000Z", note: "bridge note", skipAutomations: false }, pool);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM mission_callback_events WHERE confirmation_id=$1", [bridged.id])).rows[0].n, 0);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM mission_callback_service_events WHERE event_id=$1",
    [`confirmation:${bridged.id}`])).rows[0].n, 1);
  await drainCallbackEvents(pool);
  assert.equal((await pool.query("SELECT assigned_to FROM campaign_contacts WHERE id='bridge-contact'")).rows[0].assigned_to, "bridge agent");
  await pool.query("ALTER TABLE campaign_contact_status_list_state DROP COLUMN created_at,DROP COLUMN item_note,DROP COLUMN note_updated_at");

  // Every callback and threshold boundary, with real writes and acting-agent attribution.
  for (const action of plan.actions) {
    for (const callCount of [0, 1, 2]) {
      await pool.query("DELETE FROM call_logs");
      for (let i = 0; i < callCount; i++) await pool.query(`INSERT INTO call_logs
        (user_id,phone_number,customer_id,campaign_id,campaign_contact_id)
        VALUES('call agent','fixture',$1,'other-mission',$2)`,
      [i === 0 ? "clinic" : null, i === 0 ? null : "c-other-mission"]);
      const id = randomUUID();
      await pool.query(`INSERT INTO campaign_contact_status_list_state VALUES($1,'c',$2,'acting agent','2026-10-23T12:00Z')`, [id, action.itemId]);
      await Promise.all([drainCallbackEvents(pool), drainCallbackEvents(pool)]);
      const receipt = (await pool.query("SELECT * FROM mission_callback_service_events WHERE event_id=$1", [`confirmation:${id}`])).rows[0];
      assert.equal(receipt.state, "done");
      assert.equal(receipt.payload.callCount, callCount, "count all entity calls across Missions and both schema-supported links");
      const pass = transitionConditionPasses(action.condition, callCount);
      assert.equal(receipt.result.status, pass ? "changed" : "condition_false");
      const count = (await pool.query("SELECT count(*)::int AS n FROM campaign_contact_history WHERE metadata->>'eventId'=$1", [`confirmation:${id}`])).rows[0].n;
      assert.equal(count, pass ? 1 : 0);
      if (pass) {
        const cc = (await pool.query("SELECT * FROM campaign_contacts WHERE id='c'")).rows[0];
        assert.equal(cc.assigned_to, "acting agent");
        assert.equal(cc.callback_status_list_item_id, action.itemId);
      }
      await pool.query("SELECT mission_callback_enqueue($1)", [id]); // replay same confirmation
      assert.equal(await drainCallbackEvents(pool), 0);
    }
  }
  const callback = plan.actions.find((a: any) => a.type === "set_callback");
  await pool.query("DELETE FROM call_logs");
  await pool.query(`INSERT INTO call_logs(user_id,phone_number,customer_id,campaign_id,campaign_contact_id)
    VALUES('call agent','fixture','clinic','other-mission','c-other-mission'),
      ('call agent','fixture','unrelated-clinic','other-mission','unrelated'),
      ('call agent','fixture',NULL,NULL,NULL)`);
  const bothLinks = randomUUID();
  await pool.query("INSERT INTO campaign_contact_status_list_state VALUES($1,'c',$2,'agent',now())", [bothLinks, callback.itemId]);
  assert.equal((await pool.query("SELECT payload->>'callCount' AS n FROM mission_callback_service_events WHERE event_id=$1",
    [`confirmation:${bothLinks}`])).rows[0].n, "1", "both links count once; unrelated and unattributed logs do not count");
  await drainCallbackEvents(pool);
  const skipped = randomUUID(), baselineSource = randomUUID();
  const suppression = await pool.connect();
  try {
    await suppression.query("BEGIN");
    await suppression.query("SELECT set_config('indexus.callback_context','{\"suppress\":true,\"skip\":true}',true)");
    await suppression.query("INSERT INTO campaign_contact_status_list_state VALUES($1,'c',$2,'agent',now())", [skipped, callback.itemId]);
    await suppression.query("SELECT set_config('indexus.callback_context','{\"suppress\":true}',true)");
    await suppression.query("INSERT INTO campaign_contact_status_list_state VALUES($1,'c',$2,'agent',now())", [baselineSource, callback.itemId]);
    await suppression.query("COMMIT");
  } finally { suppression.release(); }
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM mission_callback_service_events WHERE event_id=ANY($1)",
    [[`confirmation:${skipped}`, `confirmation:${baselineSource}`]])).rows[0].n, 0);
  await pool.query("SELECT mission_callback_enqueue($1)", [skipped]);
  assert.equal(await drainCallbackEvents(pool), 0, "skipped automation is not replayed later");
  // Only explicitly dispatched chained confirmation can activate a suppressed
  // answer write; retries use the same confirmation identity.
  await pool.query("SELECT mission_callback_enqueue($1)", [baselineSource]);
  assert.equal(await drainCallbackEvents(pool), 1);
  await pool.query("SELECT mission_callback_enqueue($1)", [baselineSource]);
  assert.equal(await drainCallbackEvents(pool), 0);
  const serviceApproval = await approveFor("service", 1);
  // Cutover must wait for the WHOLE admitted legacy handler, even after its
  // confirmation has committed and the browser has disconnected.
  let start!: () => void, finish!: () => void;
  const started = new Promise<void>(resolve => { start = resolve; });
  const finishHandler = new Promise<void>(resolve => { finish = resolve; });
  const pending = randomUUID();
  const admitted = callbackAdmission(admissionPool, async () => {
    start();
    await finishHandler;
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      await connection.query("SELECT set_config('indexus.callback_context','{\"admitted\":true}',true)");
      await connection.query("INSERT INTO campaign_contact_status_list_state VALUES($1,'c',$2,'agent',now())", [pending, callback.itemId]);
      await connection.query("COMMIT");
    } finally { connection.release(); }
  });
  const handler = admitted({ params: { campaignId } } as any, {} as any, (error?: unknown) => { if (error) throw error; });
  await started;
  let switched = false;
  const switching = switchOwner(pool, campaignId, serviceApproval).then(() => { switched = true; });
  const rejectsPending = assert.rejects(() => switching, /inflight_or_unresolved/);
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(switched, false);
  finish();
  await handler;
  await rejectsPending;
  await drainCallbackEvents(pool);
  await switchOwner(pool, campaignId, serviceApproval);
  const manualInput = { campaignId, campaignContactId: "c", actionId: callback.id, actorId: "manual agent",
    eventId: randomUUID(), manualDate: "2026-11-01T10:30", note: "manual note" };
  const first = await runManagedCallback(pool, manualInput);
  assert.equal(first.callbackDate, "2026-11-01T09:30:00.000Z");
  const repeat = await runManagedCallback(pool, manualInput);
  assert.deepEqual(repeat, first);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM campaign_contact_history WHERE metadata->>'eventId'=$1",
    [`manual:${manualInput.eventId}`])).rows[0].n, 1);
  await assert.rejects(() => runManagedCallback(pool, { ...manualInput, note: "different" }), /identity_conflict/);
  const cc = (await pool.query("SELECT * FROM campaign_contacts WHERE id='c'")).rows[0];
  assert.equal(cc.assigned_to, "manual agent");
  assert.equal(cc.callback_note, "manual note");
  assert.equal(cc.callback_date.toISOString(), first.callbackDate);
  assert.equal((await pool.query("SELECT owner FROM mission_callback_service_events WHERE event_id=$1", [`manual:${manualInput.eventId}`])).rows[0].owner, "service");

  // Callback+history+receipt are atomic when the DB rejects the history write.
  await pool.query(`CREATE FUNCTION reject_history() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'test failure'; END $$;
    CREATE TRIGGER reject_history BEFORE INSERT ON campaign_contact_history FOR EACH ROW EXECUTE FUNCTION reject_history();`);
  const crashId = randomUUID();
  await pool.query("INSERT INTO campaign_contact_status_list_state VALUES($1,'c',$2,'crash agent',now())", [crashId, callback.itemId]);
  assert.equal(await drainCallbackEvents(pool), 0);
  assert.equal((await pool.query("SELECT assigned_to FROM campaign_contacts WHERE id='c'")).rows[0].assigned_to, "manual agent");
  assert.equal((await pool.query("SELECT state FROM mission_callback_service_events WHERE event_id=$1", [`confirmation:${crashId}`])).rows[0].state, "pending");
  await pool.query("DROP TRIGGER reject_history ON campaign_contact_history");
  await drainCallbackEvents(pool);
  const rollbackApproval = await approveFor("legacy", 2);
  await switchOwner(pool, campaignId, rollbackApproval);
  await runManagedCallback(pool, manualInput);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM campaign_contact_history WHERE metadata->>'eventId'=$1",
    [`manual:${manualInput.eventId}`])).rows[0].n, 1, "dedup survives owner switch");

  // Changed live configuration invalidates approval; unresolved events remain owned,
  // block switching and are never silently re-created through the old mechanism.
  const stale = await approveFor("service", 3);
  await pool.query("UPDATE campaign_dispositions SET code='changed' WHERE id=$1", [plan.actions.find((a: any) => a.dispositionId).dispositionId]);
  await assert.rejects(() => switchOwner(pool, campaignId, stale), /plan_stale/);
  await pool.query("UPDATE campaign_status_list_automations SET callback_offset_days=99 WHERE id=$1", [callback.id]);
  await pool.query("INSERT INTO campaign_contact_status_list_state VALUES($1,'c',$2,'agent',now())", [randomUUID(), callback.itemId]);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM mission_callback_service_events WHERE state='blocked'")).rows[0].n, 1);

  // keep_existing protects overdue pending rows without inventing a history event.
  const direct = await pool.connect();
  try {
    await direct.query("BEGIN");
    await direct.query("UPDATE campaign_contacts SET callback_date='2020-01-01T08:00Z' WHERE id='c'");
    const result = await executeCallbackEvent(direct, { id: "direct", campaign_id: campaignId, campaign_contact_id: "c",
      event_id: "direct", action_id: callback.id, owner: "legacy", generation: 3, actor_id: "other",
      occurred_at: new Date(), payload: { action: { ...callback, callback: { ...callback.callback, existing: "keep_existing" } }, callCount: 0 } });
    assert.equal(result.status, "kept_existing");
    assert.equal(result.callbackDate, "2020-01-01T08:00:00.000Z");
    await assert.rejects(() => executeCallbackEvent(direct, { id: "direct", campaign_id: campaignId, campaign_contact_id: "c",
      event_id: "direct", action_id: callback.id, owner: "legacy", generation: 3, actor_id: "other",
      occurred_at: new Date(), payload: { action: { ...callback, type: "notify_role" }, callCount: 0 } }), /action_unsupported/);
    await direct.query("ROLLBACK");
  } finally { direct.release(); }
  const status = await readCallbackServiceStatus(pool, campaignId);
  assert.equal(status.activationAllowed, false);
  assert.equal(status.counts.blocked, 1);
  assert.equal(status.cutovers.length, 3);
  assert.equal(status.cutovers[0].actorId, "approver");
  assert.ok(!JSON.stringify(status).includes("manual note"));
  assert.ok(!JSON.stringify(status).includes("private-backup-reference"));
  assert.ok(!JSON.stringify(status).includes("clinic"));
  console.log("Real PostgreSQL callback checks passed: actual call-log schema, cross-Mission entity counts, 10-request pool-capacity bursts before/after enrollment, eight actions, boundaries, capture, concurrency, dedup, crash rollback, both ownership directions, stale approvals and baseline protection.");
} finally {
  await admissionPool.end();
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);
  await admin.end();
}
