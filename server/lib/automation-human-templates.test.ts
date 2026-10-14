import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { load } from "cheerio";
import { humanAutomationCatalog, ensureHumanAutomationTemplates } from "./automation-human-templates";
import { upgradeLegacyDefault } from "./automation-legacy-template-upgrade";
import { ACTIVITY_TEMPLATE_LANGUAGES } from "../../shared/automation-activity-template-copy";
import { activityTemplateContext, ACTIVITY_TEMPLATE_FIELDS } from "../../shared/automation-activity-context";
import { ANALYSIS_FIELDS } from "../../shared/automation-analysis";
import { COMMUNICATION_SOURCE_FIELDS } from "../../shared/automation-communication-context";
import { activityTemplateMissingVariables } from "../../client/src/components/automation-activity-template-utils";
import { renderEmailValue, sanitizeAutomationEmail } from "./automation-email-policy";
import { automationEmailInlineAttachments } from "./automation-email-assets";
import { humanFindingLabel } from "./automation-human-copy";
import { activityTemplateBriefs } from "./automation-activity-templates";
import { fieldsForEvent } from "./automation-capabilities";

const context = activityTemplateContext({
  entityId: "0b10ada0-090e-4000-8000-aaaaaaaaaaaa",
  event: { module: "task", entityType: "task", eventType: "created", createdAt: "2026-10-14T11:21:00Z" },
  newValues: { title: "Kontrola <faktúry>", status: "pending", priority: "high", dueDate: "2026-10-15T13:00:00Z" },
  analysis: { summary: "Treba pripraviť odpoveď.", sentiment: "negative", tone: "concerned" },
  communication: {
    id: "0b10ada0-090e-4000-8000-bbbbbbbbbbbb", callId: "private-call",
    senderName: "Eva Testová", recipientName: "Nina Testová",
    senderEmail: "eva@example.test", recipientEmail: "nina@example.test",
    senderPhone: "+421900000001", recipientPhone: "+421900000002",
    subject: "Kontrola po konzultácii", taskTitle: "Kontrola faktúry",
    direction: "inbound", campaignName: "Test Mission", startedAt: "2026-10-14T12:48:00Z",
    answeredAt: "2026-10-14T12:48:05Z", endedAt: "2026-10-14T12:54:00Z", durationSeconds: 355,
    createdAt: "2026-10-14T12:48:00Z", receivedAt: "2026-10-14T12:48:01Z",
    sentAt: "2026-10-14T12:47:00Z", deliveredAt: "2026-10-14T12:48:00Z",
    taskStatus: "pending", taskPriority: "high", dueDate: "2026-10-15",
    detailUrl: "https://example.test/automation-calls/private-call",
    playbackUrl: "https://example.test/automation-calls/private-call?recordingId=private-recording",
  },
});

test("every default and channel has localized human copy and no visible technical identity", async () => {
  const { templates } = await humanAutomationCatalog();
  const allowed = [...ACTIVITY_TEMPLATE_FIELDS, ...ANALYSIS_FIELDS, ...COMMUNICATION_SOURCE_FIELDS];
  assert.equal(templates.length, 2919);
  for (const language of ACTIVITY_TEMPLATE_LANGUAGES)
    for (const type of ["email", "task", "sms", "notification"])
      assert.ok(templates.some(t => t.language === language && t.type === type));
  for (const t of templates) {
    assert.doesNotMatch(`${t.subject}\n${t.content}`, /{{(?:entityId|activity\.id|communication\.(?:id|callId|recordingId))}}/, t.id);
    if (t.id.startsWith("indexus-activity-")) {
      const brief = activityTemplateBriefs().find(b=>t.id===`indexus-activity-${t.type}-${b.key}-${t.language}`)!;
      const available = brief.event && brief.key.startsWith("call-") ? [...allowed,...fieldsForEvent("call",brief.event)] : allowed;
      assert.deepEqual(activityTemplateMissingVariables(t, available), [], t.id);
    }
    if (t.contentHtml) {
      assert.match(t.contentHtml, /#fffefb/, t.id);
      assert.match(t.contentHtml, /#176b5d/, t.id);
      const html = renderEmailValue(t.contentHtml, context, true);
      assert.doesNotMatch(load(html)("body").text(), /0b10ada0|private-call|private-recording|{{/, t.id);
      if (!t.id.includes("analysis-")) assert.doesNotMatch(html, /data-indexus-result|Zistenie po dokončenej/);
    } else assert.doesNotMatch(t.content, /<\/?(?:table|div|span|p|h1)\b/);
  }
});

test("real substituted HTML escapes content, uses distinct localized findings, and attaches approved PNGs", async () => {
  const { templates } = await humanAutomationCatalog();
  for (const language of ACTIVITY_TEMPLATE_LANGUAGES) {
    const t = templates.find(t => t.id === `indexus-activity-email-analysis-inbound-negative-${language}`)!;
    const html = sanitizeAutomationEmail(renderEmailValue(t.contentHtml, context, true));
    const $ = load(html);
    assert.ok($("body").text().includes(humanFindingLabel(language, "negative")!));
    assert.ok($("body").text().includes(humanFindingLabel(language, "concerned")!));
    assert.match(html, /#fff0e5/);
    assert.match(html, /#f2edfb/);
    assert.match(html, /border-radius:22px/);
    assert.equal($("a").first().attr("href"), context.communication.detailUrl);
    const assets = await automationEmailInlineAttachments(html);
    assert.equal(assets.length, 1);
    assert.equal(assets[0].contentType, "image/png");
    assert.deepEqual(Buffer.from(assets[0].contentBytes, "base64").subarray(0, 8), Buffer.from([137,80,78,71,13,10,26,10]));
  }
  const t = templates.find(t => t.id === "indexus-automation-email-new-task")!;
  const html = sanitizeAutomationEmail(renderEmailValue(t.contentHtml, context, true));
  assert.ok(html.includes("Kontrola &lt;faktúry&gt;"));
  assert.doesNotMatch(html, /data-indexus-|analysis\.|<script/);
  await assert.rejects(automationEmailInlineAttachments('<img src="cid:indexus-automation-human-../../secret">'));
});

test("PostgreSQL updates stored pristine predecessors only; reruns are stable and snapshots untouched", async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL search_path=pg_temp;
      CREATE TEMP TABLE message_templates(id text PRIMARY KEY,name text,type text,language text,subject text,content text,content_html text,is_active boolean,country_codes text[],format text,recipients text);
      CREATE TEMP TABLE workflow_rules(actions jsonb);
      INSERT INTO workflow_rules VALUES('[{"config":{"body":"unchanged snapshot","to":"test@example.test"}}]');`);
    const { sources, templates } = await humanAutomationCatalog();
    const originals = [...new Map(sources.map(({ old }) => [old.id, old])).values()];
    const fixtures = originals.filter(t => t.language === "sk").slice(0, 9);
    fixtures.push(originals.find(t => t.id === "indexus-activity-email-analysis-inbound-negative-sk")!);
    const historicalInvoice = originals.find(t => t.id === "indexus-notification-template-analysis-invoice-found-sk")!;
    fixtures.push({ ...historicalInvoice, content: historicalInvoice.content.replace("{{analysis.invoiceCount}}", "{{analysis.summary}}") });
    for (const [index, original] of fixtures.entries()) {
      const old = index === 0 ? upgradeLegacyDefault(original) : original;
      await client.query("INSERT INTO message_templates VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [
        old.id,old.name,old.type,old.language,index===2 ? "edited subject" : old.subject || null,
        index===1 ? "edited content" : old.content,index===3 ? "<p>edited HTML</p>" : old.contentHtml || null,
        index!==4,index===5 ? ["SK"] : [],index===6 ? "custom-format" : old.type==="email" ? "html" : "text","preserve recipients",
      ]);
    }
    // A deletion stays a deletion.
    await client.query("DELETE FROM message_templates WHERE id=$1",[fixtures[7].id]);
    const before = (await client.query("SELECT * FROM message_templates ORDER BY id")).rows;
    await ensureHumanAutomationTemplates(client);
    const after = (await client.query("SELECT * FROM message_templates ORDER BY id")).rows;
    for (const [index, fixture] of fixtures.entries()) {
      const row = after.find(row => row.id===fixture.id);
      if(index===7) { assert.equal(row,undefined); continue; }
      if(index>=1 && index<=6) assert.deepEqual(row,before.find(row=>row.id===fixture.id));
      else {
        const expected = templates.find(t=>t.id===fixture.id)!;
        assert.equal(row.subject,expected.subject);
        assert.equal(row.content,expected.content);
        assert.equal(row.content_html,expected.contentHtml ?? null);
        assert.equal(row.recipients,"preserve recipients");
      }
    }
    await ensureHumanAutomationTemplates(client);
    assert.deepEqual((await client.query("SELECT * FROM message_templates ORDER BY id")).rows,after);
    assert.equal((await client.query("SELECT actions->0->'config'->>'body' AS body FROM workflow_rules")).rows[0].body,"unchanged snapshot");
  } finally { await client.query("ROLLBACK");client.release();await pool.end(); }
});
