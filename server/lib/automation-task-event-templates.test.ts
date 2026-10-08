import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { readFile } from "node:fs/promises";
import { loadAutomationTaskEventTemplates, ensureAutomationTaskEventTemplates, TASK_EVENT_TEMPLATE_DEFINITIONS } from "./automation-task-event-templates";
import { automationDisplayValues, renderAutomationText } from "./automation-display-values";
import { taskStatusTemplateLabel } from "@shared/task-status-labels";
import { TASK_STATUSES } from "@shared/schema";
import { sanitizeAutomationEmail } from "./automation-email-policy";
import { automationEmailInlineAttachments } from "./automation-email-assets";
import { dryRunRule } from "./automation-engine";

test("nine Task event email/Task pairs use the approved rounded design in all seven languages", async () => {
  const batches = await loadAutomationTaskEventTemplates();
  assert.deepEqual(batches.map(batch => batch.language), ["sk", "en", "cs", "hu", "ro", "it", "de"]);
  assert.deepEqual([...new Set(TASK_EVENT_TEMPLATE_DEFINITIONS.map(item => item.eventType))].sort(),
    ["created", "updated", "status_changed", "task.assigned", "task.completed", "task.overdue"].sort());
  const ids = new Set<string>();
  for (const { language, templates } of batches) {
    assert.equal(templates.length, 9);
    for (const definition of templates) {
      const { email, task } = definition;
      for (const template of [email, task]) {
        assert.equal(template.language, language);
        assert.ok(!ids.has(template.id)); ids.add(template.id);
        assert.ok(template.content.trim() && template.subject.trim());
      }
      assert.match(email.contentHtml, /border-radius:12px;overflow:hidden/);
      assert.match(sanitizeAutomationEmail(email.contentHtml), /border-radius:\s*12px/);
      assert.equal((await automationEmailInlineAttachments(email.contentHtml)).length, 1);
      assert.doesNotMatch(task.content, /<\/?[a-z][^>]*>/i);
      assert.doesNotMatch(email.contentHtml, /{{newValues\.(?:title|customerId|description|phone|email)}}/);
      if (definition.eventType === "status_changed") {
        assert.match(email.subject, /{{newValues.status}}/);
        assert.match(task.subject, /{{newValues.status}}/);
      }
      if ("status" in definition) assert.notEqual(definition.status, "completed");
    }
  }
  assert.equal(ids.size, 126);
});

test("Task status placeholders localize only presentation, not saved statuses, IF, IDs or other modules", async () => {
  const forbiddenLookup = async () => { throw new Error("Status labels do not query contacts"); };
  for (const { language } of await loadAutomationTaskEventTemplates()) {
    for (const { value: status } of TASK_STATUSES) {
      const ctx = { event: { module: "task" }, newValues: { status, id: "technical-id" }, oldValues: { status: "pending" } };
      const before = JSON.stringify(ctx);
      const content = "{{oldValues.status}} → {{newValues.status}} / {{newValues.id}}";
      const display = await automationDisplayValues(ctx, [content], forbiddenLookup, language);
      assert.equal(renderAutomationText(content, ctx, display),
        `${taskStatusTemplateLabel("pending", language)} → ${taskStatusTemplateLabel(status, language)} / technical-id`);
      assert.equal(JSON.stringify(ctx), before);
    }
  }
  assert.equal(taskStatusTemplateLabel("completed", "sk"), "Dokončená");
  assert.equal(taskStatusTemplateLabel("in_progress", "cs"), "V řešení");
  const raw = { event: { module: "customer" }, newValues: { status: "in_progress" } };
  assert.equal((await automationDisplayValues(raw, ["{{newValues.status}}"], forbiddenLookup, "sk")).size, 0);
  assert.equal((await automationDisplayValues({ ...raw, event: { module: "task" } }, ["{{newValues.status}}"], forbiddenLookup)).size, 0);
  assert.throws(() => taskStatusTemplateLabel("unknown", "sk"), /Unavailable/);
  assert.throws(() => taskStatusTemplateLabel("pending", "__proto__"), /Unsupported/);
});

test("actual email and Task preview render the selected template language and current status", async () => {
  for (const { language, templates } of await loadAutomationTaskEventTemplates()) {
    const { email, task } = templates.find(item => item.key === "status-changed")!;
    const event = { module: "task", entityType: "task", eventType: "status_changed", countryCode: "SK",
      newValues: { status: "in_progress", title: "Internal task context" }, oldValues: { status: "pending" } } as any;
    const rule = { module: "task", enabled: true, trigger: { type: "event", eventType: "status_changed" },
      conditions: null, actions: [
        { type: "send_email", config: { templateLanguage: language, subject: email.subject, body: email.contentHtml } },
        { type: "create_task", config: { templateLanguage: language, title: task.subject, taskText: task.content } },
      ] } as any;
    const preview = await dryRunRule(rule, event);
    assert.equal(preview.conditionMet, true);
    for (const action of preview.actions) {
      const rendered = action.rendered;
      assert.ok(JSON.stringify(rendered).includes(taskStatusTemplateLabel("in_progress", language)));
      assert.doesNotMatch(JSON.stringify(rendered), /{{|in_progress/);
    }
    assert.equal(event.newValues.status, "in_progress");
  }
});

test("Task-event defaults seed once without resurrecting deletions, overwriting edits or changing rule snapshots", async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`BEGIN; SET LOCAL search_path=pg_temp;
      CREATE TEMP TABLE automation_template_seeds (id text PRIMARY KEY);
      CREATE TEMP TABLE template_categories (id text PRIMARY KEY,name text,description text,icon text,color text,is_active boolean);
      CREATE TEMP TABLE message_templates (
        id text PRIMARY KEY,name text,type text,format text,subject text,content text,content_html text,
        language text,category_id text,is_active boolean,country_codes text[]);
      CREATE TEMP TABLE workflow_rules (id text PRIMARY KEY,actions jsonb);
      INSERT INTO workflow_rules VALUES ('rule','[{"type":"send_email","config":{"body":"My edited snapshot"}}]');
    `);
    await ensureAutomationTaskEventTemplates(client);
    assert.equal((await client.query("SELECT count(*)::int count FROM message_templates")).rows[0].count, 126);
    assert.equal((await client.query("SELECT count(*)::int count FROM automation_template_seeds")).rows[0].count, 7);
    await client.query(`UPDATE message_templates SET content='Manager edit',subject='Custom subject'
      WHERE id='indexus-automation-email-task-event-status-changed';
      DELETE FROM message_templates WHERE id='indexus-task-template-event-cancelled-de';
      UPDATE template_categories SET name='My category',is_active=false;`);
    const before = (await client.query("SELECT * FROM message_templates ORDER BY id")).rows;
    await ensureAutomationTaskEventTemplates(client);
    assert.deepEqual((await client.query("SELECT * FROM message_templates ORDER BY id")).rows, before);
    assert.equal((await client.query("SELECT name FROM template_categories")).rows[0].name, "My category");
    assert.equal((await client.query("SELECT actions FROM workflow_rules")).rows[0].actions[0].config.body, "My edited snapshot");
    const startup = await readFile("server/lib/standalone-automation-schema.ts", "utf8");
    assert.match(startup, /await ensureAutomationTaskEventTemplates\(pool\)/);
  } finally {
    await client.query("ROLLBACK"); client.release(); await pool.end();
  }
});
