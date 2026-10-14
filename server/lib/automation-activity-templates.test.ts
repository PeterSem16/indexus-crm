import assert from "node:assert/strict";
import test from "node:test";
import { activityTemplateBriefs, ensureAutomationActivityTemplates, loadAutomationActivityTemplates } from "./automation-activity-templates";
import { ACTIVITY_TEMPLATE_FIELDS, activityTemplateContext } from "../../shared/automation-activity-context";
import { ACTIVITY_TEMPLATE_LANGUAGES } from "../../shared/automation-activity-template-copy";
import { COMMUNICATION_SOURCE_FIELDS } from "../../shared/automation-communication-context";
import { ANALYSIS_FIELDS } from "../../shared/automation-analysis";
import { fieldsForEvent, MODULE_EVENTS } from "./automation-capabilities";
import { communicationSourceContext } from "./automation-communication-context";
import { automationDisplayValues, renderAutomationText } from "./automation-display-values";
import { renderEmailValue, sanitizeAutomationEmail } from "./automation-email-policy";
import { automationEmailInlineAttachments } from "./automation-email-assets";
import { automationPhoneArtwork } from "./automation-phone-artwork";
import { filterActivityCatalogTemplates } from "../../client/src/components/automation-activity-template-utils";

test("source-specific briefs cover every executable module/event and seven locales across four action types", async () => {
  const templates = await loadAutomationActivityTemplates();
  assert.equal(new Set(templates.map(item => item.id)).size, templates.length);
  const briefs = activityTemplateBriefs();
  for (const [module, events] of Object.entries(MODULE_EVENTS)) {
    if (module === "communication") continue;
    for (const event of events) assert.ok(briefs.some(brief => brief.event === event &&
      (module === "call" ? brief.key.startsWith("call-") : brief.key.startsWith(`${module}-`))), `${module}/${event}`);
  }
  for (const language of ACTIVITY_TEMPLATE_LANGUAGES) {
    for (const channel of ["email", "sms", "chat", "task", "inbound", "outbound", "voice"]) {
      for (const criterion of ["summary", "positive", "negative", "urgent"]) {
        const entries = templates.filter(item => item.id.endsWith(`analysis-${channel}-${criterion}-${language}`));
        assert.deepEqual(entries.map(item => item.type), ["email", "task", "notification", "sms"]);
        assert.ok(entries.every(item => item.content.includes("{{analysis.summary}}") &&
          item.content.includes("{{analysis.sentiment}}") && item.content.includes("{{analysis.tone}}")));
        if (["inbound", "outbound", "voice"].includes(channel)) {
          assert.match(entries[0].contentHtml!, /cid:indexus-automation-phone/);
          assert.match(entries[0].contentHtml!, /href="{{communication.playbackUrl}}"/);
        }
      }
    }
  }
  // Every new template must be selectable in the correct event context.
  for (const brief of briefs) {
    const module = brief.criterion ? "communication" : brief.key.startsWith("call-") ? "call" : brief.label;
    const fields = [...ACTIVITY_TEMPLATE_FIELDS, ...fieldsForEvent(module, brief.event || "communication.received"),
      ...(brief.criterion ? [...COMMUNICATION_SOURCE_FIELDS, ...ANALYSIS_FIELDS] : []),
      { value: "entityId", label: "id" }];
    const entries = templates.filter(item => item.id.endsWith(`${brief.key}-sk`));
    assert.equal(filterActivityCatalogTemplates(entries, module, fields).length, 4, brief.key);
    assert.ok(entries.every(item => !item.content.includes("{{analysis.") || brief.criterion));
  }
});

test("call links bind saved call+recording identities and never expose public audio; email substitutions escape content", async () => {
  const communication = communicationSourceContext("voice", {
    id: "recording /one", callLogId: "call /one", userId: "agent", agentName: "Agent",
    customerName: "<script>bad()</script>", phoneNumber: "+421900000000",
  }, "agent", { call: { direction: "inbound", startedAt: "2026-10-14T07:00:00Z",
    answeredAt: "2026-10-14T07:01:00Z", endedAt: "2026-10-14T07:02:00Z", durationSeconds: 60, status: "completed" } });
  assert.match(communication.detailUrl as string, /\/automation-calls\/call%20%2Fone$/);
  assert.match(communication.playbackUrl as string, /recordingId=recording%20%2Fone$/);
  assert.doesNotMatch(communication.playbackUrl as string, /\/api\/|token=|\.wav|\.mp3/);
  const template = (await loadAutomationActivityTemplates()).find(item => item.id === "indexus-activity-email-analysis-inbound-negative-sk")!;
  const ctx = { event: { module: "communication", countryCode: "SK" }, communication,
    analysis: { summary: "Needs reply <img onerror=bad()>", sentiment: "negative", tone: "angry" } };
  const display = await automationDisplayValues(ctx, [template.contentHtml], async () => null, "sk");
  const rendered = sanitizeAutomationEmail(renderEmailValue(template.contentHtml, ctx, true, display));
  assert.doesNotMatch(rendered, /<script|<img onerror/);
  assert.match(rendered, /9:00/);
  assert.match(rendered, /href="https?:\/\/[^"]+\/automation-calls\//);
  assert.deepEqual(automationPhoneArtwork.subarray(0, 8), Buffer.from([137,80,78,71,13,10,26,10]));
  const assets = await automationEmailInlineAttachments(rendered);
  assert.equal(assets.length, 1);
  assert.equal(assets[0].contentType, "image/png");
  assert.equal(assets[0].contentId, "indexus-automation-phone");
  assert.equal(communication.senderPhone, "+421900000000");
  assert.equal(communication.recipientName, "Agent");
});

test("activity fields are allowlisted snapshots; names, deadlines and localized time render without rewriting events", async () => {
  const source = { event: { module: "task", eventType: "task.assigned", createdAt: "2026-10-14T07:00:00Z", countryCode: "SK" },
    entityId: "task-1", actorUserId: "creator", newValues: { title: "Review source",
      assignedUserId: "assignee", taskGroupIds: ["group"], dueDate: "2026-10-16", status: "pending", password: "never" } };
  const before = JSON.stringify(source);
  const ctx = activityTemplateContext(source);
  assert.equal(JSON.stringify(source), before);
  assert.ok(!JSON.stringify(ctx.activity).includes("never"));
  assert.equal(ctx.activity.createdAt, ""); // Never substitute event time for creation time.
  assert.equal(ctx.activity.occurredAt, "2026-10-14T07:00:00Z");
  const template = (await loadAutomationActivityTemplates()).find(item => item.id === "indexus-activity-task-task-task-assigned-sk")!;
  const display = await automationDisplayValues(ctx, [template.content], async (kind, id) =>
    kind === "user" ? `${id} name` : `${kind} label`, "sk");
  const rendered = renderAutomationText(template.content, ctx, display);
  assert.match(rendered, /creator name/);
  assert.match(rendered, /assignee name/);
  assert.match(rendered, /9:00/);
  assert.doesNotMatch(rendered, /{{|analysis\./);
  assert.equal(ctx.activity.dueDate, "2026-10-16");
});

test("additive seeding is language-gated and does not overwrite or restore saved templates", async () => {
  const sql: string[] = [];
  await ensureAutomationActivityTemplates({ query: async value => { sql.push(value); } });
  assert.equal(sql.length, 7);
  for (const query of sql) {
    assert.match(query, /ON CONFLICT\(id\) DO NOTHING RETURNING id/);
    assert.match(query, /FROM defaults CROSS JOIN seed ON CONFLICT\(id\) DO NOTHING/);
    assert.doesNotMatch(query, /DO UPDATE|DELETE|UPDATE workflow_rules/);
  }
});
