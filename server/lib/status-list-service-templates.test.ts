import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { ACTIVITY_TEMPLATE_LANGUAGES } from "../../shared/automation-activity-template-copy";
import { humanAutomationCatalog } from "./automation-human-templates";
import { retiredStatusListServiceTemplates, ensureStatusListServiceTemplates } from "./status-list-service-templates";
import { templateEligibility } from "../../client/src/components/automation-template-eligibility";
import { STATUS_LIST_ACTIVITY_FIELDS } from "../../shared/status-list-template-context";
import { taskTemplateContext } from "./task-template-variables";
import { renderEmailValue } from "./automation-email-policy";

const catalog = humanAutomationCatalog();
test("Status List uses the original general templates, unchanged, in every language and channel", async () => {
  const { templates } = await catalog;
  for (const language of ACTIVITY_TEMPLATE_LANGUAGES) {
    for (const type of ["email", "sms", "notification", "task"]) {
      const usable = templates.filter(template => template.language === language && template.type === type &&
        !template.id.startsWith("indexus-activity-") && templateEligibility(template, STATUS_LIST_ACTIVITY_FIELDS, "status_list").usable);
      assert.ok(usable.length > 0, `${language}/${type}: original catalog must be usable`);
      for (const template of usable) {
        assert.ok(!template.id.includes("status_list"), "No replacement IDs or rewritten bodies");
        assert.equal(templateEligibility({ ...template, isActive: false }, STATUS_LIST_ACTIVITY_FIELDS, "status_list").usable, false);
      }
    }
  }
  const findings = templates.find(template => template.id.includes("-analysis-"))!;
  assert.equal(templateEligibility(findings, STATUS_LIST_ACTIVITY_FIELDS, "status_list").usable, false);
  const call = templates.find(template => template.id.includes("-call-") && !template.id.includes("-analysis-"))!;
  assert.equal(templateEligibility(call, STATUS_LIST_ACTIVITY_FIELDS, "status_list").usable, false);
});

test("original email variables render real Status List activity identity and metadata, not a simplified body", async () => {
  const { templates } = await catalog;
  const template = templates.find(template => template.id === "indexus-automation-email-action-needed-en")!;
  const ctx = taskTemplateContext({
    entityId: "clinic", actorUserId: "agent",
    event: { module: "clinic", source: "status_list", eventType: "status_list.service_action", createdAt: new Date("2026-10-21T07:00:00Z") },
    newValues: { name: "Clinic <North>", status: "callback_scheduled", assignedUserId: "agent", campaignId: "mission",
      createdAt: new Date("2026-10-20T07:00:00Z"), updatedAt: new Date("2026-10-21T07:00:00Z"), dueDate: new Date("2026-10-22T07:00:00Z") },
  });
  assert.equal(ctx.activity.title, "Clinic <North>");
  assert.equal(ctx.activity.status, "callback_scheduled");
  assert.equal(ctx.activity.dueDate, "2026-10-22T07:00:00.000Z");
  const html = renderEmailValue(template.contentHtml, ctx, true);
  assert.match(html, /Clinic &lt;North&gt;/);
  assert.doesNotMatch(html, /{{/);
  assert.match(html, /#fffefb/);
});

test("only unchanged rejected substitutes are retired; manager edits, shared originals and saved actions survive", async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL search_path=pg_temp;
      CREATE TEMP TABLE message_templates(id text PRIMARY KEY,name text,subject text,type text,format text,content text,content_html text,language text,is_active boolean,country_codes text[]);
      CREATE TEMP TABLE workflow_rules(actions jsonb);
      INSERT INTO workflow_rules VALUES('[{"config":{"templateId":"saved","body":"unchanged"}}]');`);
    const rejected = retiredStatusListServiceTemplates().filter(template => template.language === "sk").slice(0, 4);
    const original = (await catalog).templates.find(template => template.id === "indexus-automation-email-action-needed")!;
    for (const [index, template] of [...rejected, { ...original, format: "html" }].entries()) {
      await client.query("INSERT INTO message_templates VALUES($1,$2,$3,$4,$5,$6,$7,$8,true,$9)", [
        template.id, template.name, template.subject, template.type, template.format,
        index === 1 ? "Manager edited this" : template.content, template.contentHtml, template.language,
        index === 2 ? ["SK"] : [],
      ]);
    }
    await client.query("DELETE FROM message_templates WHERE id=$1", [rejected[3].id]);
    await ensureStatusListServiceTemplates(client);
    await ensureStatusListServiceTemplates(client);
    const rows = new Map((await client.query("SELECT id,is_active,content FROM message_templates")).rows.map(row => [row.id, row]));
    assert.equal(rows.get(rejected[0].id).is_active, false);
    assert.equal(rows.get(rejected[1].id).is_active, true);
    assert.equal(rows.get(rejected[1].id).content, "Manager edited this");
    assert.equal(rows.get(rejected[2].id).is_active, true);
    assert.equal(rows.has(rejected[3].id), false);
    assert.equal(rows.get(original.id).is_active, true);
    assert.equal(rows.get(original.id).content, original.content);
    assert.equal((await client.query("SELECT actions FROM workflow_rules")).rows[0].actions[0].config.body, "unchanged");
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
