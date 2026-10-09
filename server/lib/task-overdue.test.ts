import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { emitOverdueTask } from "./task-overdue";
import { setEventDispatcher } from "./event-bus";
import { eventMatchesRule } from "./automation-engine";
import { getTaskDeadlineTimestamp, isTaskOverdue } from "../../shared/task-deadline";

test("Task deadlines: shared calendar boundary, absolute timestamps and DST", () => {
  assert.equal(getTaskDeadlineTimestamp("2026-10-08"), Date.parse("2026-10-08T22:00:00Z"));
  assert.equal(getTaskDeadlineTimestamp(new Date("2026-10-08T00:00:00Z")), Date.parse("2026-10-08T22:00:00Z"));
  assert.equal(getTaskDeadlineTimestamp("2026-03-29"), Date.parse("2026-03-29T22:00:00Z"));
  assert.equal(getTaskDeadlineTimestamp("2026-10-25"), Date.parse("2026-10-25T23:00:00Z"));
  assert.equal(getTaskDeadlineTimestamp("2026-10-08T13:25:00Z"), Date.parse("2026-10-08T13:25:00Z"));
  assert.equal(getTaskDeadlineTimestamp("2026-02-30"), null);
  assert.equal(isTaskOverdue("pending", "2026-10-08", Date.parse("2026-10-08T08:30:55Z")), false);
  assert.equal(isTaskOverdue("pending", "2026-10-08", Date.parse("2026-10-08T22:00:00Z")), true);
  assert.equal(isTaskOverdue("completed", "2026-10-08", Date.parse("2026-10-09T10:00:00Z")), false);
});

test("Overdue cron: production premature-event recovery, country scope, cycles and transactional dedup", async () => {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const fired: string[] = [];
  const now = new Date("2026-10-09T14:09:14Z");
  const rule = { enabled: true, module: "task", countryCodes: ["SK"],
    trigger: { type: "event", entityType: "task", eventType: "task.overdue" } } as any;
  const schema = `test_task_overdue_${randomUUID().replace(/-/g, "")}`;
  try {
    // Isolated disposable schema: two connections can test real races, without application records or messages.
    await client.query(`CREATE SCHEMA "${schema}"; SET search_path="${schema}",public;
      CREATE TABLE tasks (LIKE public.tasks INCLUDING DEFAULTS);
      CREATE TABLE workflow_events (LIKE public.workflow_events INCLUDING DEFAULTS);
      CREATE TABLE workflow_rules (LIKE public.workflow_rules INCLUDING DEFAULTS);
      CREATE TABLE customers (id text,country text);
      CREATE TABLE clinics (id text,country_code text);
      CREATE TABLE hospitals (id text,country_code text);
      CREATE TABLE collaborators (id text,country_code text);
      CREATE TABLE task_group_members (group_id text,user_id text);
      INSERT INTO customers VALUES ('contact','SK');
      INSERT INTO clinics VALUES ('clinic','CZ');
      INSERT INTO workflow_rules (name,module,country_codes,trigger,actions,created_at)
        VALUES ('Fixture rule','task',ARRAY['SK'],
          '{"type":"event","entityType":"task","eventType":"task.overdue"}'::jsonb,
          '[]'::jsonb,'2026-10-08T09:44:42Z');`);
    const database = drizzle(client);
    setEventDispatcher(async id => {
      const event = (await client.query("SELECT * FROM workflow_events WHERE id=$1", [id])).rows[0];
      assert.ok(event, "Dispatcher observes a committed event");
      fired.push(id);
    });
    const task = async (id: string, due = "2026-10-08T00:00:00Z", status = "pending") => {
      await client.query(`INSERT INTO tasks (id,title,status,priority,assigned_user_id,created_by_user_id,customer_id,due_date,tags)
        VALUES ($1,'Test task',$2,'medium','agent','creator','contact',$3,ARRAY['group_id:one'])`, [id, status, due]);
    };
    const legacy = async (id: string, created: string, country: string | null = "SK",
      dueDate = "2026-10-08T00:00:00Z") => {
      await client.query(`INSERT INTO workflow_events (source,module,entity_type,entity_id,event_type,new_values,country_code,created_at)
        VALUES ('cron','task','task',$1,'task.overdue',$2::jsonb,$3,$4)`,
      [id, JSON.stringify({ dueDate }), country, created]);
    };
    await task("production");
    await legacy("production", "2026-10-08T08:30:55Z");
    assert.equal(await emitOverdueTask("production", new Date("2026-10-08T21:59:59Z"), database), null);
    const repaired = await emitOverdueTask("production", now, database);
    assert.ok(repaired);
    const repairedEvent = (await client.query("SELECT * FROM workflow_events WHERE id=$1", [repaired])).rows[0];
    assert.equal(repairedEvent.country_code, "SK");
    assert.equal(repairedEvent.new_values.overdueDeadlineAt, "2026-10-08T22:00:00.000Z");
    assert.deepEqual(repairedEvent.new_values.taskGroupIds, ["one"]);
    assert.equal(eventMatchesRule(rule, { module: repairedEvent.module, entityType: repairedEvent.entity_type,
      eventType: repairedEvent.event_type, countryCode: repairedEvent.country_code, newValues: repairedEvent.new_values } as any), true);
    assert.equal(await emitOverdueTask("production", now, database), null);
    assert.equal(await emitOverdueTask("production", now, drizzle(client)), null, "No process-local cursor required after restart");

    await task("late");
    await legacy("late", "2026-10-08T22:10:00Z");
    assert.equal(await emitOverdueTask("late", now, database), null, "Correct legacy deliveries are not repeated");
    await task("historic", "2026-10-07T00:00:00Z");
    await legacy("historic", "2026-10-07T09:31:40Z", "SK", "2026-10-07T00:00:00Z");
    assert.equal(await emitOverdueTask("historic", now, database), null,
      "Rules created after yesterday's deadline must not retroactively send yesterday's emails");
    await task("unscoped");
    await legacy("unscoped", "2026-10-08T22:10:00Z", null);
    assert.ok(await emitOverdueTask("unscoped", now, database), "Unknown-country legacy event does not block trusted SK event");
    await task("future", "2026-10-09T00:00:00Z");
    assert.equal(await emitOverdueTask("future", now, database), null, "Calendar deadline today is not overdue during today");
    await task("completed", "2026-10-08T00:00:00Z", "completed");
    await task("cancelled", "2026-10-08T00:00:00Z", "cancelled");
    for (const id of ["completed", "cancelled", "deleted"])
      assert.equal(await emitOverdueTask(id, now, database), null);
    await task("exact", "2026-10-09T14:09:14Z");
    assert.ok(await emitOverdueTask("exact", now, database), "Exact boundary is inclusive");
    await task("related");
    await client.query("UPDATE tasks SET customer_id=null,related_entity_type='clinic',related_entity_id='clinic' WHERE id='related'");
    const relatedId = await emitOverdueTask("related", now, database);
    assert.equal((await client.query("SELECT country_code FROM workflow_events WHERE id=$1", [relatedId])).rows[0].country_code, "CZ");
    await task("country_recovery");
    await client.query("UPDATE tasks SET customer_id=null WHERE id='country_recovery'");
    const unknownId = await emitOverdueTask("country_recovery", now, database);
    assert.equal((await client.query("SELECT country_code FROM workflow_events WHERE id=$1", [unknownId])).rows[0].country_code, null);
    await client.query("UPDATE tasks SET customer_id='contact' WHERE id='country_recovery'");
    assert.ok(await emitOverdueTask("country_recovery", now, database), "Unknown-country occurrence can recover once when its contact is linked");
    assert.equal(await emitOverdueTask("country_recovery", now, database), null);

    await client.query(`UPDATE tasks SET due_date='2026-10-10T00:00:00Z' WHERE id='production'`);
    assert.equal(await emitOverdueTask("production", now, database), null);
    assert.ok(await emitOverdueTask("production", new Date("2026-10-11T00:00:00Z"), database), "Changed deadline can expire again");
    await client.query(`UPDATE tasks SET due_date='2026-10-08T00:00:00Z' WHERE id='production';
      INSERT INTO workflow_events(source,module,entity_type,entity_id,event_type,old_values,new_values,changed_fields,created_at)
      VALUES ('storage','task','task','production','status_changed','{"status":"completed"}','{"status":"pending"}',ARRAY['status'],'2026-10-09T14:00:00Z');`);
    assert.ok(await emitOverdueTask("production", now, database), "Reopening starts a new occurrence");
    assert.equal(await emitOverdueTask("production", now, database), null);

    await task("retry");
    await client.query(`CREATE FUNCTION pg_temp.reject_overdue() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.entity_id='retry' THEN RAISE EXCEPTION 'test insert failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_overdue BEFORE INSERT ON workflow_events FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_overdue();`);
    await assert.rejects(emitOverdueTask("retry", now, database));
    await client.query("DROP TRIGGER reject_overdue ON workflow_events");
    assert.ok(await emitOverdueTask("retry", now, database), "Rolled-back insertion is retried");

    // Independent connections compete for the same advisory key without touching real task data.
    const holder = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await holder.connect();
    await task("concurrent");
    try {
      await holder.query(`SET search_path="${schema}",public`);
      await holder.query("BEGIN");
      await holder.query("SELECT pg_advisory_xact_lock(hashtextextended('task-overdue:concurrent',0))");
      const pending = emitOverdueTask("concurrent", now, database);
      await new Promise(resolve => setTimeout(resolve, 30));
      await holder.query("COMMIT");
      const competing = emitOverdueTask("concurrent", now, drizzle(holder));
      assert.equal((await Promise.all([pending, competing])).filter(Boolean).length, 1,
        "Independent replicas serialize and insert exactly one event");
      assert.equal(await emitOverdueTask("concurrent", now, database), null);
    } finally { await holder.end(); }
    assert.equal(fired.length, 10);
  } finally {
    setEventDispatcher(async () => {});
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  }
});
