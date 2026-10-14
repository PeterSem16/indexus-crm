import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { legacyAutomationDefaults, upgradeLegacyDefault, ensureLegacyAutomationTemplateVariables } from "./automation-legacy-template-upgrade";
import { loadAutomationActivityTemplates, VOICE_FINDING_CRITERIA } from "./automation-activity-templates";
import { ACTIVITY_TEMPLATE_LANGUAGES } from "../../shared/automation-activity-template-copy";
import { activityTemplateMissingVariables } from "../../client/src/components/automation-activity-template-utils";
import { ACTIVITY_TEMPLATE_FIELDS } from "../../shared/automation-activity-context";
import { ANALYSIS_FIELDS } from "../../shared/automation-analysis";
import { COMMUNICATION_SOURCE_FIELDS } from "../../shared/automation-communication-context";
import { activityTemplateContext } from "../../shared/automation-activity-context";
import { renderEmailValue } from "./automation-email-policy";

test("each voice direction has separate real sentiment and tone templates in all locales and delivery types", async () => {
  const all = await loadAutomationActivityTemplates();
  for (const language of ACTIVITY_TEMPLATE_LANGUAGES)
    for (const channel of ["inbound", "outbound", "voice"])
      for (const criterion of VOICE_FINDING_CRITERIA) {
        const entries = all.filter(item => item.id.endsWith(`analysis-${channel}-${criterion}-${language}`));
        assert.deepEqual(entries.map(item => item.type), ["email", "task", "notification", "sms"]);
        for (const item of entries) {
          assert.ok(item.content.includes("{{analysis.sentiment}}"));
          assert.ok(item.content.includes("{{analysis.tone}}"));
          assert.ok(item.content.includes("{{communication.playbackUrl}}"));
          assert.deepEqual(activityTemplateMissingVariables(item, [...ACTIVITY_TEMPLATE_FIELDS, ...ANALYSIS_FIELDS, ...COMMUNICATION_SOURCE_FIELDS]), []);
        }
      }
});

test("all approved legacy originals upgrade to usable variables without invented or unauthorized keys", async () => {
  const originals = await legacyAutomationDefaults();
  const available = [...ACTIVITY_TEMPLATE_FIELDS, ...ANALYSIS_FIELDS, ...COMMUNICATION_SOURCE_FIELDS, { value: "entityId", label: "ID" }];
  for (const original of originals) {
    const next = upgradeLegacyDefault(original);
    assert.equal(next.id, original.id);
    assert.equal(next.name, original.name);
    assert.ok(next.content.includes("{{"), original.id);
    if (original.id.includes("-analysis-")) {
      assert.ok(next.content.includes("{{analysis.sentiment}}"));
      assert.ok(next.content.includes("{{analysis.tone}}"));
    }
    // Existing defaults can contain their already-authorized native variables;
    // test all newly introduced tokens rather than widening that authority.
    const previousTokens = new Set(original.content.match(/{{[^}]+}}/g));
    const added = next.content.replace(/{{[^}]+}}/g, token => previousTokens.has(token) ? "" : token);
    assert.deepEqual(activityTemplateMissingVariables({ id: next.id, content: added }, available), []);
    if (next.contentHtml) assert.ok(next.contentHtml.includes("{{"));
  }
});

test("PostgreSQL upgrades pristine legacy defaults but preserves edits, deletion, inactive and scoped copies", async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL search_path=pg_temp;
      CREATE TEMP TABLE message_templates(id text PRIMARY KEY,name text,type text,language text,subject text,content text,content_html text,is_active boolean,country_codes text[]);
      CREATE TEMP TABLE workflow_rules(id text PRIMARY KEY,actions jsonb);
      INSERT INTO workflow_rules VALUES('snapshot','[{"config":{"body":"saved legacy copy"}}]');`);
    const originals = await legacyAutomationDefaults();
    const ids = ["indexus-task-template-check-data", "indexus-automation-email-analysis-negative-sentiment-sk",
      "indexus-automation-email-call-outbound", "indexus-task-template-contact-verify", "indexus-task-template-overdue",
      "indexus-automation-email-deadline-en", "indexus-automation-email-task-event-overdue-en"];
    // Use the real historically seeded raw/localized frame, not a normalized reconstruction.
    const selected = ids.map(id => originals.filter(item => item.id === id).at(-1)!);
    assert.ok(selected.every(Boolean));
    for (const [index, item] of selected.entries()) {
      await client.query("INSERT INTO message_templates VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)", [
        item.id,item.name,item.type,item.language,item.subject ?? null,index === 1 ? "manager-edited" : item.content,
        item.contentHtml ?? null,index !== 3,index === 4 ? ["SK"] : [],
      ]);
    }
    await ensureLegacyAutomationTemplateVariables(client);
    const { rows } = await client.query("SELECT id,subject,content,content_html FROM message_templates ORDER BY id");
    const byId = new Map(rows.map(row => [row.id, row.content]));
    assert.ok(byId.get(ids[0]).includes("{{activity.title}}"));
    assert.ok(byId.get(ids[2]).includes("{{entityId}}"));
    assert.equal(byId.get(ids[1]), "manager-edited");
    assert.equal(byId.get(ids[3]), selected[3].content);
    assert.equal(byId.get(ids[4]), selected[4].content);
    for (const id of [ids[5], ids[6]]) {
      const deadline = rows.find(row => row.id === id)!;
      assert.ok(deadline.subject.includes("{{activity.title}}"));
      assert.ok(deadline.subject.includes("{{activity.id}}"));
      assert.ok(deadline.content.includes("{{activity.dueDate}}"));
      assert.ok(deadline.content_html.includes("{{activity.title}}"));
      assert.ok(deadline.content_html.includes("{{activity.id}}"));
      assert.ok(deadline.content_html.includes("{{activity.dueDate}}"));
      assert.ok(deadline.content_html.indexOf("{{activity.title}}") < deadline.content_html.indexOf("cid:"));
      const context = activityTemplateContext({
        entityId: "task-identity-test", newValues: { title: "Verify <documents>", dueDate: "2026-10-20", status: "pending" },
        event: { eventType: "task.overdue", createdAt: "2026-10-21T08:00:00Z" },
      });
      const sentHtml = renderEmailValue(deadline.content_html, context, true);
      const sentSubject = renderEmailValue(deadline.subject, context);
      assert.ok(sentSubject.includes("Verify <documents>"));
      assert.ok(sentSubject.includes("task-identity-test"));
      assert.ok(sentHtml.includes("Verify &lt;documents&gt;"));
      assert.ok(sentHtml.includes("2026-10-20"));
      assert.ok(sentHtml.includes("task-identity-test"));
      assert.ok(!sentHtml.includes("{{"));
    }
    await ensureLegacyAutomationTemplateVariables(client);
    assert.deepEqual((await client.query("SELECT id,subject,content,content_html FROM message_templates ORDER BY id")).rows, rows);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM message_templates")).rows[0].n, selected.length);
    assert.equal((await client.query("SELECT actions->0->'config'->>'body' AS body FROM workflow_rules")).rows[0].body, "saved legacy copy");
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
