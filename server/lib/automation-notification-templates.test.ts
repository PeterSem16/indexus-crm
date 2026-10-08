import assert from "node:assert/strict";
import test, { after } from "node:test";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "../db";
import { notifications, users, workflowRules, workflowEvents, workflowRuns, workflowActionLog } from "@shared/schema";
import { dryRunRule, runRule } from "./automation-engine";
import { validateRuleCapabilities } from "./automation-capabilities";
import { ensureAutomationNotificationTemplates, validNotificationMessageTemplate } from "./automation-notification-templates";
import { NOTIFICATION_TEMPLATE_LANGUAGES, notificationTemplateDefaults } from "../../shared/automation-notification-templates";
import { taskStatusTemplateLabel } from "@shared/task-status-labels";

after(async () => { await pool.end(); });

test("49 defaults are plain-text copies with language-specific Task status rendering", async () => {
  const ids = new Set<string>();
  for (const language of NOTIFICATION_TEMPLATE_LANGUAGES) {
    const defaults = notificationTemplateDefaults(language);
    assert.equal(defaults.length, 7);
    for (const template of defaults) {
      assert.ok(!ids.has(template.id)); ids.add(template.id);
      assert.ok(validNotificationMessageTemplate(template));
      assert.doesNotMatch(template.content, /<[^>]+>/);
      const config = { notificationActionVersion: 2, templateLanguage: language,
        title: template.subject, message: template.content, userId: "fixture-agent" };
      const rule = { module: "task", enabled: true, trigger: { type: "event", eventType: "updated" },
        conditions: null, actions: [{ type: "notify_user", config }] } as any;
      const event = { module: "task", entityType: "task", eventType: "updated",
        countryCode: "SK", newValues: { title: "Fixture task", status: "in_progress" } } as any;
      const before = JSON.stringify(event);
      const result = await dryRunRule(rule, event);
      assert.equal(result.conditionMet, true);
      assert.doesNotMatch(JSON.stringify(result.actions[0].rendered), /{{/);
      if (template.id.includes("status-changed")) {
        assert.match(result.actions[0].rendered.title, new RegExp(taskStatusTemplateLabel("in_progress", language)));
        assert.match(result.actions[0].rendered.message, new RegExp(taskStatusTemplateLabel("in_progress", language)));
      }
      assert.equal(JSON.stringify(event), before);
    }
  }
  assert.equal(ids.size, 49);
});

test("new notification variables fail clearly; legacy rendering is unchanged", async () => {
  const base = { module: "task", enabled: true, trigger: { type: "event", eventType: "updated" },
    actions: [{ type: "notify_user", config: { notificationActionVersion: 2, userId: "user", title: "Review", message: "{{newValues.missing}}" } }] } as any;
  const validation = validateRuleCapabilities(base);
  assert.ok(validation.length > 0);
  assert.match(JSON.stringify(validation), /Unavailable notification variable/);
  const sample = { module: "task", entityType: "task", eventType: "updated", newValues: {} } as any;
  await assert.rejects(() => dryRunRule(base, sample), /unavailable/);
  const legacy = { ...base, actions: [{ type: "notify_user", config: { userId: "user",
    title: "{{newValues.status}}", message: "{{newValues.missing}}", templateLanguage: "sk" } }] };
  const rendered = await dryRunRule(legacy, { ...sample, newValues: { status: "in_progress" } });
  assert.equal(rendered.actions[0].rendered.title, "in_progress");
  assert.equal(rendered.actions[0].rendered.message, "");
  assert.ok(!validNotificationMessageTemplate({ name: "X", subject: "", content: "Text", format: "text" }));
  assert.ok(!validNotificationMessageTemplate({ name: "X", subject: "X", content: "Text", format: "html" }));
});

test("notification startup seed preserves edits, deletions and unrelated saved snapshots", async () => {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT)
    throw new Error("Development database test only");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE TEMP TABLE automation_template_seeds (id text PRIMARY KEY, created_at timestamptz DEFAULT now());
      CREATE TEMP TABLE message_templates (id text PRIMARY KEY,name text,type text,format text,subject text,content text,
        language text,is_active boolean,country_codes text[]);
      CREATE TEMP TABLE workflow_rules (id text,actions jsonb);
      INSERT INTO workflow_rules VALUES ('fixture','[{"type":"notify_user","config":{"title":"Saved edit","message":"Private snapshot"}}]');`);
    await ensureAutomationNotificationTemplates(client);
    assert.equal(Number((await client.query("SELECT count(*) AS n FROM message_templates")).rows[0].n), 49);
    await client.query(`UPDATE message_templates SET subject='Manager edit',content='Manager body' WHERE id='indexus-notification-template-created-sk';
      DELETE FROM message_templates WHERE id='indexus-notification-template-overdue-de';`);
    const before = (await client.query("SELECT * FROM message_templates ORDER BY id")).rows;
    await ensureAutomationNotificationTemplates(client);
    assert.deepEqual((await client.query("SELECT * FROM message_templates ORDER BY id")).rows, before);
    assert.equal((await client.query("SELECT actions FROM workflow_rules")).rows[0].actions[0].config.title, "Saved edit");
  } finally {
    await client.query("ROLLBACK"); client.release();
  }
});

test("actual THEN execution persists the rendered Title and Message only for the selected user", async () => {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT)
    throw new Error("Development database test only");
  const userId = randomUUID(), ruleId = randomUUID(), eventId = randomUUID();
  try {
    await db.insert(users).values({ id: userId, username: `notify-fixture-${userId}`,
      email: `${userId}@example.invalid`, fullName: "Synthetic notification recipient",
      passwordHash: "!disabled-test-account", assignedCountries: ["SK"], isActive: true });
    const [rule] = await db.insert(workflowRules).values({
      id: ruleId, name: "Synthetic notification rule", module: "task", countryCode: "SK",
      enabled: false, trigger: { type: "event", entityType: "task", eventType: "updated" },
      actions: [{ type: "notify_user", config: { notificationActionVersion: 2,
        userId, templateLanguage: "sk", title: "Task {{newValues.title}}",
        message: "Stav: {{newValues.status}}", priority: "high" } }],
    }).returning();
    const [event] = await db.insert(workflowEvents).values({
      id: eventId, source: "notification-test", module: "task", entityType: "task", entityId: randomUUID(),
      eventType: "updated", countryCode: "SK", newValues: { title: "Fixture", status: "in_progress" },
    }).returning();
    // Execute only this disabled fixture rule; no background scanner can pick it up.
    await runRule(rule, event, []);
    const saved = await db.select().from(notifications).where(eq(notifications.userId, userId));
    assert.equal(saved.length, 1);
    assert.equal(saved[0].title, "Task Fixture");
    assert.equal(saved[0].message, "Stav: V riešení");
    assert.equal(saved[0].priority, "high");
    assert.equal(saved[0].type, "automation");
    assert.equal(saved[0].entityId, event.entityId);
    const runs = await db.select().from(workflowRuns).where(eq(workflowRuns.ruleId, ruleId));
    assert.equal(runs[0]?.status, "success");
  } finally {
    await db.delete(notifications).where(eq(notifications.userId, userId));
    const runs = await db.select({ id: workflowRuns.id }).from(workflowRuns).where(eq(workflowRuns.ruleId, ruleId));
    if (runs.length) await db.delete(workflowActionLog).where(inArray(workflowActionLog.runId, runs.map(run => run.id)));
    await db.delete(workflowRuns).where(eq(workflowRuns.ruleId, ruleId));
    await db.delete(workflowEvents).where(eq(workflowEvents.id, eventId));
    await db.delete(workflowRules).where(eq(workflowRules.id, ruleId));
    await db.delete(users).where(eq(users.id, userId));
  }
});
