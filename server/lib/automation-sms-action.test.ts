import test, { after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "../db";
import { dryRunRule } from "./automation-engine";
import { validateRuleCapabilities } from "./automation-capabilities";
import { deliverAutomationSms } from "./automation-sms-delivery";
import { ensureAutomationSmsTemplates, automationSmsDefaults } from "./automation-sms-templates";
import { smsRecipientList, normalizeSmsRecipient, automationSmsCountry } from "../../shared/automation-sms-policy";
import { NOTIFICATION_TEMPLATE_LANGUAGES } from "../../shared/automation-notification-templates";
import { taskStatusTemplateLabel } from "@shared/task-status-labels";

after(async () => { await pool.end(); });
const ctx = { event: { module: "task", entityType: "task", entityId: "task-fixture", countryCode: "SK" },
  rule: { id: "rule-fixture", countryCode: "CZ" }, newValues: {} };

test("explicit phones normalize, deduplicate and preflight the whole recipient list", async () => {
  assert.equal(normalizeSmsRecipient("00421 900 123 456"), "+421900123456");
  assert.deepEqual(smsRecipientList(["+421 900 123 456", "+421900123456", "+420 600 123 456"]),
    ["+421900123456", "+420600123456"]);
  for (const value of ["{{newValues.phone}}", "0900123456", "", "+0000000", "+421letters", "+1234567890123456"])
    assert.throws(() => normalizeSmsRecipient(value));
  assert.throws(() => smsRecipientList([]));
  assert.throws(() => smsRecipientList(Array(51).fill("+421900123456")));
  let touched = false;
  await assert.rejects(() => deliverAutomationSms({ smsActionVersion: 2,
    to: ["+421900123456", "bad"], text: "Message" }, ctx, {
    createMessage: async () => { touched = true; return { id: "x" }; },
    updateMessage: async () => { touched = true; },
    send: async () => { touched = true; },
  }));
  assert.equal(touched, false);
});

test("each recipient has independent history, gateway selection and partial failure output", async () => {
  const created: any[] = [], sent: any[] = [], updated: any[] = [];
  const result = await deliverAutomationSms({ smsActionVersion: 2,
    to: ["+421900123456", "+420600123456", "+421 900 123 456"], text: "Rendered text",
    kind: "promotional", provider: "bulkgate", unicode: true, country: "RO" }, ctx, {
    createMessage: async message => { created.push(message); return { id: `comm-${created.length}` }; },
    updateMessage: async (id, changes) => { updated.push({ id, ...changes }); },
    send: async options => {
      assert.equal(created.length, sent.length + 1, "History exists before each vendor send");
      sent.push(options);
      if (sent.length === 2) throw new Error("Synthetic transport failure");
      return { success: true, smsId: "sms-fixture", provider: "bulkgate" };
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.output.recipientCount, 2);
  assert.equal(result.output.sentCount, 1);
  assert.equal(result.output.failedCount, 1);
  assert.deepEqual(updated.map(item => item.status), ["sent", "failed"]);
  assert.ok(sent.every(item => item.country === "SK" && item.provider === "bulkgate" &&
    item.promotional && item.unicode && item.text === "Rendered text"));
  assert.deepEqual(sent.map(item => item.tag), ["comm-1", "comm-2"]);
  assert.equal(created[1].recipientPhone, "+420600123456");
  assert.equal(created[1].entityId, "task-fixture");
});

test("Mission provider is server-owned and country never comes from recipient/action", async () => {
  assert.equal(automationSmsCountry(ctx), "SK");
  assert.equal(automationSmsCountry({ rule: { countryCodes: ["CZ"] } }), "CZ");
  assert.equal(automationSmsCountry({ rule: { countryCodes: ["SK", "CZ"] } }), undefined);
  const sent: any[] = [];
  const result = await deliverAutomationSms({ smsActionVersion: 2, to: ["+420600123456"],
    text: "Message", provider: "smstools", country: "CZ", campaignId: "untrusted-mission" },
  { ...ctx, newValues: { campaignId: "trusted-mission" } }, {
    createMessage: async message => { assert.equal(message.campaignId, "trusted-mission"); return { id: "history" }; },
    updateMessage: async () => { throw new Error("Synthetic history fault"); },
    send: async options => { sent.push(options); return { success: true, provider: "bulkgate" }; },
  });
  assert.equal(result.ok, true, "History failure must not trigger duplicate vendor delivery");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].provider, undefined);
  assert.equal(sent[0].country, "SK");
  assert.equal(sent[0].campaignId, "trusted-mission");
  assert.equal(sent[0].campaignProviderMode, "reject-conflict");
  assert.ok(result.output.deliveries[0].historyError);
});

test("SMS templates render variables/status in all seven languages without changing recipients or event", async () => {
  for (const language of NOTIFICATION_TEMPLATE_LANGUAGES) {
    for (const template of automationSmsDefaults(language)) {
      assert.equal(template.type, "sms");
      assert.equal(template.subject, undefined);
      const config = { smsActionVersion: 2, to: ["+421900123456", "+420600123456"],
        text: template.content, templateLanguage: language };
      const rule = { module: "task", trigger: { type: "event", entityType: "task", eventType: "updated" },
        actions: [{ type: "send_sms", config }], conditions: null } as any;
      assert.deepEqual(validateRuleCapabilities(rule), []);
      const event = { module: "task", entityType: "task", eventType: "updated", countryCode: "SK",
        newValues: { title: "Fixture", status: "in_progress" } } as any;
      const before = JSON.stringify(event);
      const result = await dryRunRule(rule, event);
      assert.doesNotMatch(result.actions[0].rendered.text, /{{/);
      assert.deepEqual(result.actions[0].rendered.to, config.to);
      if (template.id.includes("status-changed"))
        assert.ok(result.actions[0].rendered.text.includes(taskStatusTemplateLabel("in_progress", language)));
      assert.equal(JSON.stringify(event), before);
    }
  }
  const unsupported = { module: "task", trigger: { type: "event", entityType: "task", eventType: "updated" },
    actions: [{ type: "send_sms", config: { smsActionVersion: 2, to: ["+421900123456"], text: "{{newValues.missing}}" } }] } as any;
  assert.match(JSON.stringify(validateRuleCapabilities(unsupported)), /Unavailable SMS variable/);
  await assert.rejects(() => dryRunRule(unsupported, { ...ctx.event, newValues: {} } as any), /unavailable/);
});

test("49 SMS defaults seed once and preserve manager edits and deletions", async () => {
  if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT)
    throw new Error("Development database test only");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE TEMP TABLE automation_template_seeds (id text PRIMARY KEY, created_at timestamptz DEFAULT now());
      CREATE TEMP TABLE message_templates (id text PRIMARY KEY,name text,type text,format text,
        content text,language text,is_active boolean,country_codes text[]);`);
    await ensureAutomationSmsTemplates(client);
    assert.equal(Number((await client.query("SELECT count(*) AS n FROM message_templates")).rows[0].n), 49);
    await client.query(`UPDATE message_templates SET content='Manager edit' WHERE id='indexus-sms-template-created-sk';
      DELETE FROM message_templates WHERE id='indexus-sms-template-overdue-de';`);
    const before = (await client.query("SELECT * FROM message_templates ORDER BY id")).rows;
    await ensureAutomationSmsTemplates(client);
    assert.deepEqual((await client.query("SELECT * FROM message_templates ORDER BY id")).rows, before);
  } finally { await client.query("ROLLBACK"); client.release(); }
});

test("scheduled SMS counts every unique recipient against the external delivery limit", () => {
  const action = { type: "send_sms", config: { smsActionVersion: 2,
    to: ["+421900123456", "+420600123456", "+421 900 123 456"], text: "Scheduled message" } };
  const rule = { module: "customer", countryCodes: ["SK"],
    trigger: { type: "schedule", interval: "daily", mode: "once" }, actions: [action] };
  assert.deepEqual(validateRuleCapabilities(rule), []);
  const many = Array.from({ length: 50 }, (_, index) => `+421900${String(index).padStart(6, "0")}`);
  const largeAction = { ...action, config: { ...action.config, to: many } };
  const issues = validateRuleCapabilities({ ...rule, actions: [largeAction, largeAction, largeAction] });
  assert.ok(issues.some(issue => /delivery safety limit|external deliveries|100/.test(issue.message)));
});
