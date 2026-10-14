import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { load } from "cheerio";
import { humanAutomationCatalog, humanizeAutomationTemplate, ensureHumanAutomationTemplates } from "./automation-human-templates";
import { renderEmailValue, sanitizeAutomationEmail } from "./automation-email-policy";
import { automationEmailInlineAttachments } from "./automation-email-assets";
import { AUTOMATION_STATE_ICONS, isAutomationStateArtwork, priorityBadgePalette, stateIcon } from "../../shared/automation-email-decoration";
import { humanPriorityLabel, humanFindingLabel } from "./automation-human-copy";
import { taskStatusTemplateLabel } from "../../shared/task-status-labels";
import { ACTIVITY_TEMPLATE_LANGUAGES } from "../../shared/automation-activity-template-copy";

const wrap = (body: string, language = "sk") => `<html lang="${language}"><body>${body}</body></html>`;
for (const language of ACTIVITY_TEMPLATE_LANGUAGES) {
  test(`priority badges use real values, distinct colors, localized labels and escaped content (${language})`, () => {
    const colors = new Set<string>();
    for (const priority of ["low", "normal", "medium", "high", "urgent"]) {
      const rendered = sanitizeAutomationEmail(renderEmailValue(wrap(
        '<strong data-indexus-priority="activity.priority">{{activity.priority}}</strong>', language),
      { activity: { priority } }, true));
      const $ = load(rendered);
      assert.equal($("strong").text(), humanPriorityLabel(language, priority));
      assert.ok($("strong").attr("style")?.includes(priorityBadgePalette(priority).background));
      colors.add(priorityBadgePalette(priority).background);
      assert.doesNotMatch(rendered, /data-indexus-(priority|status|result|emotive|optional)|{{/);
    }
    assert.equal(colors.size, 4);
    const malicious = '<img src=x onerror=alert(1)>';
    const rendered = sanitizeAutomationEmail(renderEmailValue(wrap(
      '<strong data-indexus-priority="activity.priority">{{activity.priority}}</strong>', language),
    { activity: { priority: malicious } }, true));
    assert.equal(load(rendered)("strong").text(), malicious);
    assert.equal(load(rendered)("img").length, 0);
  });
  test(`task states and analysis findings have truthful emotive icons (${language})`, () => {
    for (const status of ["pending", "in_progress", "completed", "cancelled"]) {
      const rendered = renderEmailValue(wrap(
        '<strong data-indexus-status="activity.status">{{activity.status}}</strong>', language),
      { event: { module: "task" }, activity: { status } }, true);
      const $ = load(rendered);
      assert.equal($("strong").text(), taskStatusTemplateLabel(status, language));
      assert.equal($("img").attr("src"), `cid:indexus-automation-state-${stateIcon(status)}`);
    }
    for (const value of ["positive", "negative", "neutral", "angry", "calm", "concerned", "rude"]) {
      const field = ["positive", "negative", "neutral"].includes(value) ? "sentiment" : "tone";
      const source = wrap(`<span data-indexus-result="${field}" data-indexus-emotive="true"><small>Label · </small>{{analysis.${field}}}</span>`, language);
      const rendered = renderEmailValue(source, { analysis: { [field]: value } }, true);
      assert.ok(load(rendered)("span").text().includes(humanFindingLabel(language, value)!));
      assert.equal(load(rendered)("img").attr("src"), `cid:indexus-automation-state-${stateIcon(value)}`);
      assert.doesNotMatch(rendered, /data-indexus-|{{/);
    }
  });
}
test("missing and unknown values never invent a status or finding", () => {
  const source = wrap('<div data-indexus-optional="activity.priority"><strong data-indexus-priority="activity.priority">{{activity.priority}}</strong></div><span data-indexus-optional="analysis.sentiment" data-indexus-result="sentiment" data-indexus-emotive="true">{{analysis.sentiment}}</span>');
  assert.equal(load(renderEmailValue(source, { activity: {}, analysis: {} }, true))("body").text(), "");
  const unknown = renderEmailValue(wrap('<strong data-indexus-status="activity.status">{{activity.status}}</strong>'), { event: { module: "clinic" }, activity: { status: "custom-state" } }, true);
  assert.equal(load(unknown)("strong").text(), "custom-state");
  assert.equal(load(unknown)("img").length, 0);
});
test("every email gets the enhanced family; plain text and classic historical bytes remain unchanged", async () => {
  const { sources, templates } = await humanAutomationCatalog();
  const emails = templates.filter(t => t.type === "email");
  assert.equal(emails.length, 784);
  for (const template of templates) {
    const source = sources.find(source => source.old.id === template.id)!;
    const classic = humanizeAutomationTemplate(source.old, source.lines, "classic");
    assert.equal(template.content, classic.content);
    assert.equal(template.subject, classic.subject);
    if (template.type === "email") {
      assert.match(template.contentHtml!, /cid:indexus-automation-state-/);
      assert.notEqual(template.contentHtml, classic.contentHtml);
    } else assert.equal(template.contentHtml, null);
  }
  for (const icon of AUTOMATION_STATE_ICONS) {
    assert.equal(isAutomationStateArtwork(`state-${icon}`), true);
    const attachments = await automationEmailInlineAttachments(`<img src="cid:indexus-automation-state-${icon}"><img src="cid:indexus-automation-state-${icon}">`);
    assert.equal(attachments.length, 1);
    const bytes = Buffer.from(attachments[0].contentBytes, "base64");
    assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137,80,78,71,13,10,26,10]));
    assert.equal(bytes.readUInt32BE(16), 64);
    assert.equal(bytes.readUInt32BE(20), 64);
  }
  for (const cid of ["state-../../secret", "state-happy.svg", "state-constructor", "state-unknown"])
    await assert.rejects(automationEmailInlineAttachments(`<img src="cid:indexus-automation-${cid}">`));
});
test("previous approved B emails migrate exactly once; customized, disabled, scoped, deleted and rule copies survive", async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL search_path=pg_temp;
      CREATE TEMP TABLE message_templates(id text PRIMARY KEY,name text,type text,language text,subject text,content text,content_html text,is_active boolean,country_codes text[],format text,recipients text);
      CREATE TEMP TABLE workflow_rules(actions jsonb);
      INSERT INTO workflow_rules VALUES('[{"config":{"body":"saved rule snapshot","to":"fixture@example.test"}}]');`);
    const { sources, templates } = await humanAutomationCatalog();
    const rows = templates.filter(t => t.type === "email" && t.language === "sk").slice(0, 9);
    for (const [index, template] of rows.entries()) {
      const source = sources.find(source => source.old.id === template.id)!;
      const classic = humanizeAutomationTemplate(source.old, source.lines, "classic");
      await client.query("INSERT INTO message_templates VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [
        classic.id,classic.name,classic.type,classic.language,index===1 ? "custom subject" : classic.subject,
        index===2 ? "custom text" : classic.content,index===3 ? "<p>custom design</p>" : classic.contentHtml,
        index!==4,index===5 ? ["SK"] : [],index===6 ? "text" : "html","unchanged recipients",
      ]);
    }
    await client.query("DELETE FROM message_templates WHERE id=$1", [rows[7].id]);
    const before = (await client.query("SELECT * FROM message_templates ORDER BY id")).rows;
    await ensureHumanAutomationTemplates(client);
    const after = (await client.query("SELECT * FROM message_templates ORDER BY id")).rows;
    for (const [index, template] of rows.entries()) {
      const row = after.find(row => row.id === template.id);
      if (index === 7) { assert.equal(row, undefined); continue; }
      if (index >= 1 && index <= 6) assert.deepEqual(row, before.find(row => row.id === template.id));
      else {
        assert.equal(row.content_html, template.contentHtml);
        assert.equal(row.content, template.content);
        assert.equal(row.recipients, "unchanged recipients");
      }
    }
    await ensureHumanAutomationTemplates(client);
    assert.deepEqual((await client.query("SELECT * FROM message_templates ORDER BY id")).rows, after);
    assert.equal((await client.query("SELECT actions->0->'config'->>'body' AS body FROM workflow_rules")).rows[0].body, "saved rule snapshot");
  } finally { await client.query("ROLLBACK"); client.release(); await pool.end(); }
});
