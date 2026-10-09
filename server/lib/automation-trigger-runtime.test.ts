import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { readFile } from "node:fs/promises";
import { pool as appPool } from "../db";
import { emitEvent, emitEntityCreated, emitEntityUpdated, emitTaskLifecycle, setEventDispatcher } from "./event-bus";
import { eventMatchesRule, dryRunRule } from "./automation-engine";
import { MODULE_EVENTS } from "./automation-capabilities";
import { sendAutomationGraphEmail } from "./automation-email-graph";
import { TASK_STATUSES } from "@shared/schema";

test("every offered WHEN event matches only its module, event, enabled state and verified country", () => {
  let count = 0;
  for (const [module, events] of Object.entries(MODULE_EVENTS)) {
    for (const eventType of events) {
      const rule = { enabled: true, module, countryCodes: ["SK"],
        trigger: { type: "event", entityType: module, eventType } } as any;
      const event = { module, entityType: module, eventType, countryCode: "SK" } as any;
      assert.equal(eventMatchesRule(rule, event), true, `${module}:${eventType}`);
      assert.equal(eventMatchesRule(rule, { ...event, eventType: "not-this-event" }), false);
      assert.equal(eventMatchesRule(rule, { ...event, module: "not-this-module" }), false);
      assert.equal(eventMatchesRule(rule, { ...event, countryCode: "RO" }), false);
      assert.equal(eventMatchesRule(rule, { ...event, countryCode: null }), false);
      assert.equal(eventMatchesRule({ ...rule, enabled: false }, event), false);
      count++;
    }
  }
  assert.ok(count >= 35, "Cover at least the original catalog, plus every subsequently offered event");
});

test("Task status_changed excludes completion in matching and preview, but includes reopening", async () => {
  const rule = { enabled: true, module: "task", countryCodes: ["SK"],
    trigger: { type: "event", entityType: "task", eventType: "status_changed" },
    conditions: null, actions: [] } as any;
  for (const { value: oldStatus } of TASK_STATUSES) {
    for (const { value: newStatus } of TASK_STATUSES) {
      if (oldStatus === newStatus) continue;
      const event = { module: "task", entityType: "task", eventType: "status_changed", countryCode: "SK",
        oldValues: { status: oldStatus }, newValues: { status: newStatus } } as any;
      const expected = newStatus !== "completed";
      assert.equal(eventMatchesRule(rule, event), expected, `${oldStatus} → ${newStatus}`);
      assert.equal((await dryRunRule(rule, event)).conditionMet, expected, `preview ${oldStatus} → ${newStatus}`);
      if (newStatus === "completed") {
        assert.equal(eventMatchesRule({ ...rule, trigger: { ...rule.trigger, eventType: "task.completed" } },
          { ...event, eventType: "task.completed" }), true);
      }
    }
  }
});

test("committed Task lifecycle reaches Slovakia email rules even when stored Task country is empty", async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const originalQuery = appPool.query;
  const dispatched: string[] = [];
  try {
    await client.query(`BEGIN; SET LOCAL search_path=pg_temp;
      CREATE TEMP TABLE workflow_events (LIKE public.workflow_events INCLUDING DEFAULTS);
      CREATE TEMP TABLE customers (id text, country text, first_name text, last_name text);
      CREATE TEMP TABLE clinics (id text, country_code text);
      CREATE TEMP TABLE hospitals (id text, country_code text);
      CREATE TEMP TABLE collaborators (id text, country_code text);
      CREATE TEMP TABLE task_group_members (group_id text,user_id text);
      CREATE TEMP TABLE users (id text,full_name text,username text);
      INSERT INTO customers VALUES ('contact','SK','Test','Contact');
      INSERT INTO clinics VALUES ('clinic','CZ');
      INSERT INTO task_group_members VALUES ('resolver-group','resolver');
      INSERT INTO users VALUES ('creator','Test Creator','creator');`);
    appPool.query = client.query.bind(client) as typeof appPool.query;
    setEventDispatcher(async id => { dispatched.push(id); });
    const task = { id: "task", title: "Test task", country: null, customerId: "contact",
      status: "pending", priority: "medium", assignedUserId: "agent", createdByUserId: "creator",
      tags: ["group_id:one"], dueDate: new Date("2026-10-01T10:00:00Z") };
    const events = async () => (await client.query("SELECT * FROM workflow_events ORDER BY created_at,id")).rows;
    const types = async () => (await events()).map(row => row.event_type).sort();
    const clear = async () => { await client.query("DELETE FROM workflow_events"); dispatched.length = 0; };
    await emitTaskLifecycle(task, undefined, "creator");
    assert.deepEqual(await types(), ["created", "task.assigned"]);
    assert.ok((await events()).every(e => e.country_code === "SK"));

    await clear();
    await emitTaskLifecycle({ ...task, status: "in_progress" }, task, "agent");
    assert.deepEqual(await types(), ["status_changed", "updated"]);
    const changed = (await events()).find(e => e.event_type === "status_changed");
    assert.equal(changed.country_code, "SK");
    assert.equal(changed.old_values.status, "pending");
    assert.equal(changed.new_values.status, "in_progress");
    assert.equal(dispatched.length, 2);
    const rule = { enabled: true, module: "task", countryCodes: ["SK"],
      trigger: { type: "event", entityType: "task", eventType: "status_changed" },
      conditions: { field: "newValues.status", op: "eq", value: "in_progress" },
      actions: [{ type: "send_email", config: { emailActionVersion: 2, senderMode: "system",
        to: "observer@example.test", subject: "Status changed",
        body: "<p>{{newValues.customerId}}: {{newValues.status}} — {{newValues.createdByUserId}}</p>" } }],
    } as any;
    const event = { module: changed.module, entityType: changed.entity_type, eventType: changed.event_type,
      countryCode: changed.country_code, entityId: changed.entity_id, oldValues: changed.old_values,
      newValues: changed.new_values } as any;
    assert.equal(eventMatchesRule(rule, event), true);
    const preview = await dryRunRule(rule, event);
    assert.equal(preview.conditionMet, true);
    assert.equal(preview.actions[0].rendered.body, "<p>Test Contact: in_progress — Test Creator</p>");
    let sends = 0;
    await sendAutomationGraphEmail("test-only-token", { message: {
      subject: preview.actions[0].rendered.subject,
      body: { contentType: "HTML", content: preview.actions[0].rendered.body },
      toRecipients: [{ emailAddress: { address: "observer@example.test" } }],
    } }, async () => { sends++; return new Response(null, { status: 202 }); });
    assert.equal(sends, 1);

    await clear();
    await emitTaskLifecycle({ ...task, priority: "high" }, task, "agent");
    assert.deepEqual(await types(), ["updated"], "priority edits never fake a status change");
    await clear();
    await emitTaskLifecycle({ ...task, tags: ["group_id:two"] }, task, "agent");
    assert.deepEqual(await types(), ["task.assigned", "updated"], "group handoff must emit even if nominal owner stays the same");
    await clear();
    await emitTaskLifecycle({ ...task, status: "completed", resolvedByUserId: "resolver" }, task, "resolver",
      { creatorNotificationHandled: true, causationRunId: "parent-run" });
    assert.deepEqual(await types(), ["task.completed", "updated"]);
    const completed = (await events()).find(e => e.event_type === "task.completed");
    assert.equal(completed.new_values.creatorNotificationHandled, true);
    assert.deepEqual(completed.new_values.resolvedByGroupIds, ["resolver-group"]);
    assert.ok((await events()).every(e => e.country_code === "SK" && e.causation_run_id === "parent-run"));
    await clear();
    await emitTaskLifecycle({ ...task, status: "completed" }, { ...task, status: "completed" }, "resolver");
    assert.deepEqual(await types(), ["updated"], "already-completed saves never emit another completion");
    await clear();
    await emitTaskLifecycle({ ...task, status: "cancelled" }, task, "agent");
    assert.deepEqual(await types(), ["status_changed", "updated"]);
    // Check every transition, including reopening and unchanged saves.
    for (const { value: oldStatus } of TASK_STATUSES) {
      for (const { value: newStatus } of TASK_STATUSES) {
        await clear();
        await emitTaskLifecycle({ ...task, status: newStatus }, { ...task, status: oldStatus }, "agent");
        const expected = ["updated"];
        if (oldStatus !== newStatus) expected.push(newStatus === "completed" ? "task.completed" : "status_changed");
        assert.deepEqual(await types(), expected.sort(), `${oldStatus} → ${newStatus}`);
      }
    }
    await clear();
    await emitEvent({ source: "cron", module: "task", entityType: "task", entityId: task.id,
      eventType: "task.overdue", newValues: task, countryCode: null });
    assert.equal((await events())[0].country_code, "SK", "cron uses the same trusted country resolver");
    await clear();
    await emitTaskLifecycle({ ...task, customerId: null, relatedEntityType: "clinic", relatedEntityId: "clinic" }, undefined, "agent");
    assert.ok((await events()).every(e => e.country_code === "CZ"));
    await clear();
    await emitTaskLifecycle({ ...task, customerId: null, relatedEntityType: "__proto__", relatedEntityId: "unknown" }, undefined, "agent");
    assert.ok((await events()).every(e => e.country_code === null));
    assert.equal(eventMatchesRule(rule, { ...event, countryCode: null }), false);

    for (const status of ["completed", "cancelled"]) {
      await clear();
      await emitEntityUpdated("contract", "contract", "contract", { status: "draft" }, { status }, "agent", "SK");
      assert.deepEqual(await types(), [`contract.${status}`, "status_changed", "updated"].sort());
    }
    for (const module of ["customer", "hospital", "clinic", "collaborator", "invoice"]) {
      await clear();
      await emitEntityCreated(module, module, "record", { status: "pending" }, "agent", "SK");
      await emitEntityUpdated(module, module, "record", { status: "pending" }, { status: "active" }, "agent", "SK");
      const offered = MODULE_EVENTS[module];
      assert.ok((await types()).includes("created") && (await types()).includes("updated"));
      if (offered.includes("status_changed")) assert.ok((await types()).includes("status_changed"));
    }
  } finally {
    setEventDispatcher(async () => {});
    appPool.query = originalQuery;
    await client.query("ROLLBACK"); client.release(); await pool.end();
  }
});

test("all Task mutation UIs use the shared lifecycle after commit; automation writes keep causal protection", async () => {
  const routes = await readFile("server/routes.ts", "utf8");
  for (const path of [
    "/api/tasks", "/api/tasks/:id", "/api/tasks/:id/resolve",
    "/api/back-office/tasks/:taskId/claim", "/api/back-office/tasks/:taskId/confirm",
    "/api/back-office/tasks/:taskId/ask-agent", "/api/back-office/tasks/:taskId/forward",
    "/api/agent/bo-questions/:taskId/answer",
  ]) {
    const marker = new RegExp(`app\\.(?:post|patch)\\("${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`);
    const start = routes.search(marker);
    assert.ok(start >= 0, path);
    const end = routes.indexOf("\n  app.", start + 1);
    const block = routes.slice(start, end === -1 ? undefined : end);
    assert.ok(block.includes("emitTaskLifecycle"), path);
  }
  const engine = await readFile("server/lib/automation-engine.ts", "utf8");
  assert.ok(engine.includes("causationRunId: runId"));
  assert.ok(engine.includes("emitAutomatedMutation(entityType, entityId, before, updated, ctx, runId)"));
  const statusList = await readFile("server/lib/status-list-task-action.ts", "utf8");
  assert.ok(statusList.includes("emitTaskLifecycle(createdTask, undefined, userId)"));
});
