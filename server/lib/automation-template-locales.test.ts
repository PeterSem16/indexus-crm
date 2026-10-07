import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import pg from "pg";
import {
  AUTOMATION_TRANSLATION_LANGUAGES, loadAutomationTemplateLocales,
  localizeAutomationEmail, localizedTaskDefaults, type AutomationEmailDefault,
} from "./automation-template-locales";
import { DEFAULT_TASK_MESSAGE_TEMPLATES, ensureTaskMessageTemplates } from "./task-message-templates";
import { ensureAutomationEmailTemplates } from "./automation-email-templates";
import { automationEmailInlineAttachments } from "./automation-email-assets";
import { sanitizeAutomationEmail } from "./automation-email-policy";
import { ensureAutomationCallTemplates, loadAutomationCallTemplates, CALL_TEMPLATE_KEYS } from "./automation-call-templates";

const sources = async (): Promise<AutomationEmailDefault[]> =>
  JSON.parse(await readFile("server/assets/automation-email/templates.json", "utf8"));
const skeleton = (html: string) => html
  .replace(/>([^<>]*)</g, "><").replace(/lang="[^"]*"/g, 'lang="LANG"')
  .replace(/alt="[^"]*"/g, 'alt="ALT"').replace(/title="[^"]*"/g, 'title="TITLE"');

test("all six locales provide the six approved email designs and seven Task texts without SK fallbacks", async () => {
  const originals = await sources();
  const originalSnapshot = JSON.stringify(originals);
  const locales = await loadAutomationTemplateLocales();
  assert.deepEqual(locales.map(locale => locale.language), AUTOMATION_TRANSLATION_LANGUAGES);
  const ids = new Set<string>();
  for (const locale of locales) {
    assert.deepEqual(Object.keys(locale.email).sort(), originals.map(source => source.id.replace("indexus-automation-email-", "")).sort());
    assert.deepEqual(Object.keys(locale.task).sort(), DEFAULT_TASK_MESSAGE_TEMPLATES.map(([key]) => key).sort());
    for (const source of originals) {
      const template = localizeAutomationEmail(source, locale);
      assert.equal(template.language, locale.language);
      assert.equal(template.id, `${source.id}-${locale.language}`);
      assert.notEqual(template.name, source.name);
      assert.notEqual(template.subject, source.subject);
      assert.notEqual(template.content, source.content);
      assert.ok(template.content.trim() && template.contentHtml.trim());
      assert.equal(skeleton(template.contentHtml), skeleton(source.contentHtml), `${locale.language}/${source.id}: design parity`);
      assert.match(template.contentHtml, new RegExp(`<html lang="${locale.language}">`));
      assert.ok(!ids.has(template.id)); ids.add(template.id);
      assert.doesNotMatch(template.contentHtml, /AUTOMATIZÁCIA|Otvorte príslušný záznam|Ilustrácia|<script|\/__mockup\/|SYSTEM_SIGNATURE_START/);
      for (const raw of source.contentHtml.matchAll(/>([^<>]*)</g)) {
        const text = raw[1].trim();
        // SK and CS can share complete, valid phrases; string inequality is not
        // a translation-quality check for that pair.
        if (locale.language !== "cs" && text.length >= 35 && /\p{L}/u.test(text) && !text.includes("AUTOMATIZÁCIA")) {
          assert.ok(!template.contentHtml.includes(`>${text}<`), `${locale.language}: untranslated ${text}`);
        }
      }
      const attachments = await automationEmailInlineAttachments(template.contentHtml);
      assert.equal(attachments.length, 1);
      assert.equal(attachments[0].contentId, (await automationEmailInlineAttachments(source.contentHtml))[0].contentId);
      const safe = sanitizeAutomationEmail(template.contentHtml);
      assert.match(safe, /cid:indexus-automation-/);
      assert.match(safe, /style=/);
    }
    const tasks = localizedTaskDefaults(DEFAULT_TASK_MESSAGE_TEMPLATES, locale);
    assert.equal(tasks.length, 7);
    for (let i = 0; i < tasks.length; i++) {
      assert.equal(tasks[i][0], DEFAULT_TASK_MESSAGE_TEMPLATES[i][0]);
      assert.notEqual(tasks[i][1], DEFAULT_TASK_MESSAGE_TEMPLATES[i][1]);
      assert.notEqual(tasks[i][2], DEFAULT_TASK_MESSAGE_TEMPLATES[i][2]);
      assert.ok(tasks[i][1].trim() && tasks[i][2].trim());
    }
  }
  assert.equal(ids.size, 36);
  assert.equal(JSON.stringify(originals), originalSnapshot);
});

test("missing copy, SK layout drift and dropped event variables fail visibly", async () => {
  const source = (await sources())[0], locale = (await loadAutomationTemplateLocales())[0];
  assert.throws(() => localizeAutomationEmail(source, { ...locale, email: {} }), /Missing automation email/);
  const key = source.id.replace("indexus-automation-email-", "");
  const texts = [...locale.email[key].texts, "Unexpected copy"];
  assert.throws(() => localizeAutomationEmail(source, { ...locale, email: { ...locale.email, [key]: { ...locale.email[key], texts } } }), /does not match SK layout/);
  assert.throws(() => localizeAutomationEmail({ ...source, subject: "{{newValues.firstName}}" }, locale), /variables changed/);
  assert.throws(() => localizedTaskDefaults([["check-data", "Title", "{{newValues.firstName}}"]], locale), /variables changed/);
  assert.throws(() => localizedTaskDefaults(DEFAULT_TASK_MESSAGE_TEMPLATES, { ...locale, task: {} }), /Missing Task template/);
});

test("call catalog supplies four email and four Task variants in all seven languages using the approved design", async () => {
  const batches = await loadAutomationCallTemplates();
  const source = (await sources()).find(item => item.id.endsWith("data-change"))!;
  assert.equal(batches.length, 7);
  const ids = new Set<string>();
  for (const { language, templates } of batches) {
    assert.equal(templates.length, CALL_TEMPLATE_KEYS.length);
    for (const { email, task } of templates) {
      assert.equal(email.language, language);
      assert.equal(task.language, language);
      assert.equal(skeleton(email.contentHtml), skeleton(source.contentHtml));
      assert.ok(task.content.trim() && task.name.trim());
      assert.doesNotMatch(email.contentHtml + task.content, /{{|<script|\/__mockup/);
      for (const id of [email.id, task.id]) { assert.ok(!ids.has(id)); ids.add(id); }
      assert.equal((await automationEmailInlineAttachments(email.contentHtml)).length, 1);
    }
  }
  assert.equal(ids.size, 56);
});

test("PostgreSQL seeds all languages once and preserves edits, deletions, legacy templates and rule snapshots", async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Session-private shadows; application data is never touched.
    await client.query(`SET LOCAL search_path = pg_temp;
      CREATE TEMP TABLE template_categories (id text PRIMARY KEY, name text, description text, icon text, color text, is_active boolean);
      CREATE TEMP TABLE automation_template_seeds (id text PRIMARY KEY, created_at timestamptz DEFAULT now());
      CREATE TEMP TABLE message_templates (
        id text PRIMARY KEY, name text, type text, format text, subject text, content text, content_html text,
        language text, category_id text, is_active boolean, country_codes text[] NOT NULL DEFAULT ARRAY[]::text[]
      );
      CREATE TEMP TABLE workflow_rules (id text PRIMARY KEY, actions jsonb);
      INSERT INTO message_templates (id,name,type,format,subject,content,language) VALUES
        ('legacy-email','Legacy','email','text','Existing subject','Existing content','sk'),
        ('indexus-task-template-check-data-en','Edited task','task','text','Edited title','Edited body','en');
      INSERT INTO workflow_rules VALUES ('rule', '[{"type":"send_email","config":{"templateId":"indexus-automation-email-new-task","subject":"Local subject","body":"Local body"}},{"type":"create_task","config":{"templateId":"indexus-task-template-check-data","title":"Local task","taskText":"Local instructions"}}]');
    `);
    const seed = async () => {
      await ensureTaskMessageTemplates(client);
      await ensureAutomationEmailTemplates(client);
      await ensureAutomationCallTemplates(client);
    };
    await seed();
    const counts = (await client.query(`SELECT type,language,count(*)::int AS count FROM message_templates
      WHERE id <> 'legacy-email' GROUP BY type,language ORDER BY type,language`)).rows;
    assert.equal(counts.length, 14);
    for (const row of counts) assert.equal(row.count, row.type === "email" ? 10 : 11, `${row.type}/${row.language}`);
    assert.equal((await client.query("SELECT count(*)::int AS count FROM automation_template_seeds")).rows[0].count, 22);
    assert.equal((await client.query("SELECT content FROM message_templates WHERE id='indexus-task-template-check-data-en'")).rows[0].content, "Edited body");
    await client.query(`UPDATE message_templates SET content='Manager edit',subject='Manager subject'
      WHERE id IN ('indexus-automation-email-completed-de','indexus-task-template-check-data');
      DELETE FROM message_templates WHERE id IN ('indexus-automation-email-new-task-en','indexus-task-template-handover-ro');
      DELETE FROM message_templates WHERE id='indexus-automation-email-deadline';
      UPDATE message_templates SET content='Call manager edit' WHERE id='indexus-task-template-call-inbound-de';
      DELETE FROM message_templates WHERE id='indexus-automation-email-call-outbound-en';
      UPDATE template_categories SET name='Manager category',is_active=false;
    `);
    const before = (await client.query("SELECT * FROM message_templates ORDER BY id")).rows;
    const rules = (await client.query("SELECT * FROM workflow_rules ORDER BY id")).rows;
    await seed();
    assert.deepEqual((await client.query("SELECT * FROM message_templates ORDER BY id")).rows, before);
    assert.deepEqual((await client.query("SELECT * FROM workflow_rules ORDER BY id")).rows, rules);
    assert.equal((await client.query("SELECT name FROM template_categories")).rows[0].name, "Manager category");
    assert.equal((await client.query("SELECT count(*)::int AS count FROM automation_template_seeds")).rows[0].count, 22);
  } finally {
    await client.query("ROLLBACK");
    client.release();
    await pool.end();
  }
});
