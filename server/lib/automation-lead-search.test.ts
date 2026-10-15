import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "../db";
import { leadCampaigns, searchJobs, searchResults, workflowEvents, workflowRules, workflowRuns, workflowActionLog, users, notifications } from "../../shared/schema";
import { LEAD_SEARCH_EVENTS, LEAD_SEARCH_LANGUAGES, getLeadSearchCopy, leadCampaignSelectionValid, leadSearchTriggerMatches } from "../../shared/automation-lead-search";
import { emitLeadSearchOutcome, ensureLeadSearchNotificationTemplates, leadSearchNotificationDefaults, leadSearchOutcomeEvents, leadCampaignVisible, validateLeadCampaignSelection } from "./automation-lead-search";
import { fieldsForEvent, validateRuleCapabilities } from "./automation-capabilities";
import { eventMatchesRule, processEvent, dryRunRule } from "./automation-engine";
import express from "express";
import { registerAutomationRoutes } from "./automation-routes";
import { loadAutomationActivityTemplates } from "./automation-activity-templates";

if (process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT) {
  throw new Error("LEAD SEARCH integration fixtures must not run in production");
}

const job = { id: 777, name: "Synthetic search", campaignId: 222, country: "SK", targetModule: "clinics" };
const campaign = { id: 222, name: "Synthetic campaign", country: "SK" };
const now = new Date("2026-10-15T08:00:00Z");
const rule = { module: "lead_search", enabled: true, countryCodes: ["SK"], trigger: {
  type: "event", entityType: "lead_search", eventType: "lead_search.results_found", leadCampaignIds: [222],
}, actions: [{ type: "notify_user", config: { userIds: ["synthetic-user"], title: "{{newValues.campaignName}}", message: "{{newValues.newLeads}}" } }] };

test("LEAD SEARCH has no direct notification delivery and covers empty and all terminal paths", async () => {
  const routes = await readFile("server/routes.ts", "utf8");
  const pipeline = routes.slice(routes.indexOf("function runLeadSearchPipelineForJob("), routes.indexOf("// Match search result against existing module records"));
  assert.ok(!pipeline.includes("sendNotificationToUsers"));
  assert.ok(!pipeline.includes('type: "lead_campaign_results"'));
  assert.equal((pipeline.match(/emitLeadSearchOutcome\(job.id, "completed"/g) || []).length, 2);
  assert.ok(pipeline.includes('emitLeadSearchOutcome(job.id, "failed")'));
  assert.ok(pipeline.includes('emitLeadSearchOutcome(job.id, "cancelled")'));
});

test("campaign selection is explicit, numeric, bounded and independent of Mission IDs", () => {
  for (const ids of [undefined, [], ["222"], [0], [-1], [1.1], [222, 222], [NaN], Array.from({ length: 201 }, (_, i) => i + 1)]) {
    assert.equal(leadCampaignSelectionValid(ids), false);
    assert.ok(validateRuleCapabilities({ ...rule, trigger: { ...rule.trigger, leadCampaignIds: ids } })
      .some(issue => issue.path === "trigger.leadCampaignIds"));
  }
  assert.deepEqual(validateRuleCapabilities(rule), []);
  assert.ok(validateRuleCapabilities({ ...rule, trigger: { type: "schedule", interval: "hourly", mode: "once" } }).length);
  assert.ok(!leadSearchTriggerMatches({ campaignIds: [222] }, { module: "lead_search", newValues: { campaignId: 222 } }));
  assert.ok(leadSearchTriggerMatches(rule.trigger, { module: "lead_search", newValues: { campaignId: 222 } }));
  assert.ok(!leadSearchTriggerMatches(rule.trigger, { module: "lead_search", newValues: { campaignId: 333 } }));
  assert.ok(!leadSearchTriggerMatches(rule.trigger, { module: "lead_search", newValues: { campaignId: "222" } }));
});

test("outcomes use persisted campaign identity, actual counts, safe metadata and meaningful event types", () => {
  const events = leadSearchOutcomeEvents(job, campaign, "completed", { newLeads: 3, totalResults: 9 }, now);
  assert.deepEqual(events.map(event => event.eventType), ["lead_search.results_found", "lead_search.completed"]);
  assert.equal(events[0].newValues.newLeads, 3);
  assert.equal(events[0].newValues.totalResults, 9);
  assert.equal(events[0].newValues.completedAt, now.toISOString());
  assert.deepEqual(leadSearchOutcomeEvents(job, undefined, "completed", { newLeads: 3, totalResults: 9 }, now), []);
  assert.deepEqual(leadSearchOutcomeEvents({ ...job, campaignId: null }, campaign, "completed", { newLeads: 3, totalResults: 9 }, now), []);
  assert.equal(leadSearchOutcomeEvents(job, campaign, "completed", { newLeads: 0, totalResults: 0 }, now)[0].eventType, "lead_search.completed");
  for (const status of ["failed", "cancelled"] as const) {
    const [event] = leadSearchOutcomeEvents(job, campaign, status, { newLeads: 0, totalResults: 2 }, now);
    assert.equal(event.eventType, `lead_search.${status}`);
    assert.ok(!("errorMessage" in event.newValues) && !("email" in event.newValues));
  }
});

test("enabled rules match selected search campaign and country; NOT/ELSE cannot turn a different campaign into a match", async () => {
  const [event] = leadSearchOutcomeEvents(job, campaign, "completed", { newLeads: 3, totalResults: 9 }, now);
  assert.equal(eventMatchesRule(rule as any, event as any), true);
  for (const changed of [
    { enabled: false }, { countryCodes: ["CZ"] },
    { trigger: { ...rule.trigger, leadCampaignIds: [333] } },
    { trigger: { ...rule.trigger, leadCampaignIds: [] } },
  ]) assert.equal(eventMatchesRule({ ...rule, ...changed } as any, event as any), false);
  const preview = await dryRunRule({ ...rule, trigger: { ...rule.trigger, leadCampaignIds: [333] } } as any, event as any);
  assert.equal(preview.conditionMet, false);
  assert.equal(leadCampaignVisible(campaign, { role: "manager", assignedCountries: ["CZ"] }), false);
  assert.equal(leadCampaignVisible({ country: null }, { role: "manager", assignedCountries: ["SK"] }), false);
  assert.equal(leadCampaignVisible(campaign, { role: "manager", assignedCountries: ["SK"] }), true);
});

test("28 editable notification templates contain only available variables and fully localized source information", () => {
  const defaults = leadSearchNotificationDefaults();
  assert.equal(defaults.length, 28);
  assert.equal(new Set(defaults.map(item => item.id)).size, 28);
  for (const language of LEAD_SEARCH_LANGUAGES) {
    const localized = defaults.filter(item => item.language === language);
    assert.equal(localized.length, 4);
    assert.ok(localized.every(item => item.content.includes("{{newValues.campaignName}}") && item.content.includes("{{newValues.jobName}}")));
    for (const event of LEAD_SEARCH_EVENTS) {
      const item = localized.find(item => item.id === `indexus-lead-search-notification-${event.slice(12)}-${language}`)!;
      assert.ok(item, `${language}/${event} template`);
      const allowed = new Set(fieldsForEvent("lead_search", event).map(field => field.value));
      for (const match of `${item.subject} ${item.content}`.matchAll(/\{\{([^}]+)\}\}/g)) assert.ok(allowed.has(match[1]), match[1]);
    }
    for (const value of Object.values(getLeadSearchCopy(language))) assert.ok(value?.trim());
  }
});

test("existing activity templates remain renderable and do not acquire unrequested Lead Search email/SMS/Task defaults", async () => {
  const existing = await loadAutomationActivityTemplates();
  assert.ok(existing.length > 0);
  assert.ok(existing.every(item => !item.id.includes("lead_search")));
});

test("PostgreSQL seed is idempotent and preserves edited, disabled, deleted and scoped templates", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE TEMP TABLE automation_template_seeds(id text PRIMARY KEY, created_at timestamptz DEFAULT now());
      CREATE TEMP TABLE message_templates(id text PRIMARY KEY,name text,type text,format text,subject text,content text,language text,is_active boolean,country_codes text[]);`);
    await ensureLeadSearchNotificationTemplates(client);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM message_templates")).rows[0].n, 28);
    const ids = leadSearchNotificationDefaults().slice(0, 4).map(item => item.id);
    await client.query("UPDATE message_templates SET content='Custom',country_codes=ARRAY['SK'],is_active=false WHERE id=$1", [ids[0]]);
    await client.query("DELETE FROM message_templates WHERE id=$1", [ids[1]]);
    await ensureLeadSearchNotificationTemplates(client);
    assert.equal((await client.query("SELECT count(*)::int AS n FROM message_templates")).rows[0].n, 27);
    const edited = (await client.query("SELECT * FROM message_templates WHERE id=$1", [ids[0]])).rows[0];
    assert.equal(edited.content, "Custom");
    assert.equal(edited.is_active, false);
    assert.deepEqual(edited.country_codes, ["SK"]);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("persisted completion emits once per job/event; no rule or paused/wrong-campaign rules deliver nothing", async () => {
  const ids: number[] = [], jobs: number[] = [], rules: string[] = [];
  const prefix = `lead-automation-test-${randomUUID()}`;
  try {
    const [first] = await db.insert(leadCampaigns).values({ name: prefix, targetModule: "clinics", country: "SK" }).returning();
    const [second] = await db.insert(leadCampaigns).values({ name: `${prefix}-other`, targetModule: "clinics", country: "CZ" }).returning();
    ids.push(first.id, second.id);
    const [savedJob] = await db.insert(searchJobs).values({ name: prefix, targetModule: "clinics", campaignId: first.id, country: "SK", status: "completed", completedAt: now }).returning();
    jobs.push(savedJob.id);
    await db.insert(searchResults).values({ jobId: savedJob.id, companyName: "Synthetic result" });
    await Promise.all([emitLeadSearchOutcome(savedJob.id, "completed", 1), emitLeadSearchOutcome(savedJob.id, "completed", 1)]);
    const events = await db.select().from(workflowEvents).where(and(eq(workflowEvents.module, "lead_search"), eq(workflowEvents.entityId, String(savedJob.id))));
    assert.equal(events.length, 2, "concurrent retries must not duplicate a notification event");
    assert.ok(events.every(event => (event.newValues as any).totalResults === 1));
    for (const event of events) await processEvent(event.id, []);
    const noRuns = await db.select().from(workflowRuns).where(inArray(workflowRuns.eventId, events.map(event => event.id)));
    assert.equal(noRuns.length, 0, "an event without an opted-in rule does not notify");
    for (const candidate of [
      { enabled: false, selected: first.id }, { enabled: true, selected: second.id },
    ]) {
      const [savedRule] = await db.insert(workflowRules).values({
        ...rule, name: prefix, enabled: candidate.enabled,
        trigger: { ...rule.trigger, leadCampaignIds: [candidate.selected] },
      }).returning();
      rules.push(savedRule.id);
      await processEvent(events.find(event => event.eventType === rule.trigger.eventType)!.id, [savedRule.id]);
    }
    assert.equal((await db.select().from(workflowRuns).where(inArray(workflowRuns.ruleId, rules))).length, 0);
    assert.equal(await validateLeadCampaignSelection({ ...rule, trigger: { ...rule.trigger, leadCampaignIds: [first.id] } }, { role: "admin" }), true);
    assert.equal(await validateLeadCampaignSelection({ ...rule, trigger: { ...rule.trigger, leadCampaignIds: [second.id] } }, { role: "admin" }), false, "rule country and campaign country must agree");
  } finally {
    if (rules.length) {
      const runs = await db.select({ id: workflowRuns.id }).from(workflowRuns).where(inArray(workflowRuns.ruleId, rules));
      if (runs.length) await db.delete(workflowActionLog).where(inArray(workflowActionLog.runId, runs.map(row => row.id)));
      await db.delete(workflowRuns).where(inArray(workflowRuns.ruleId, rules));
      await db.delete(workflowRules).where(inArray(workflowRules.id, rules));
    }
    if (jobs.length) {
      await db.delete(workflowEvents).where(and(eq(workflowEvents.module, "lead_search"), inArray(workflowEvents.entityId, jobs.map(String))));
      await db.delete(searchResults).where(inArray(searchResults.jobId, jobs));
      await db.delete(searchJobs).where(inArray(searchJobs.id, jobs));
    }
    if (ids.length) await db.delete(leadCampaigns).where(inArray(leadCampaigns.id, ids));
  }
});

test("enabled campaign rule sends the localized template only to selected users; disabled/deleted campaigns stay silent", async () => {
  const ownerId = randomUUID(), recipientId = randomUUID(), prefix = `lead-notify-${randomUUID()}`;
  let campaignId: number | undefined, jobId: number | undefined, ruleId: string | undefined;
  try {
    await db.insert(users).values([
      { id: ownerId, username: `${prefix}-owner`, email: `${prefix}-owner@example.invalid`, fullName: "Synthetic owner", passwordHash: randomUUID(), role: "admin", isActive: true, assignedCountries: ["SK"] },
      { id: recipientId, username: `${prefix}-recipient`, email: `${prefix}-recipient@example.invalid`, fullName: "Synthetic recipient", passwordHash: randomUUID(), role: "user", isActive: true, assignedCountries: ["SK"] },
    ]);
    const [campaign] = await db.insert(leadCampaigns).values({ name: prefix, targetModule: "clinics", country: "SK" }).returning();
    campaignId = campaign.id;
    const [job] = await db.insert(searchJobs).values({ name: `${prefix}-run`, campaignId, targetModule: "clinics", country: "SK", status: "completed", completedAt: now }).returning();
    jobId = job.id;
    const template = leadSearchNotificationDefaults().find(item => item.id === "indexus-lead-search-notification-results_found-sk")!;
    const [savedRule] = await db.insert(workflowRules).values({ ...rule, name: prefix, createdByUserId: ownerId,
      trigger: { ...rule.trigger, leadCampaignIds: [campaignId] },
      actions: [{ type: "notify_user", config: { userIds: [recipientId], title: template.subject, message: template.content } }],
    }).returning();
    ruleId = savedRule.id;
    const [event] = await db.insert(workflowEvents).values(
      leadSearchOutcomeEvents(job, campaign, "completed", { newLeads: 4, totalResults: 4 }, now)[0],
    ).returning();
    await processEvent(event.id, [ruleId]);
    const delivered = await db.select().from(notifications).where(eq(notifications.userId, recipientId));
    assert.equal(delivered.length, 1);
    assert.ok(delivered[0].title.includes(prefix));
    assert.ok(delivered[0].message?.includes("4 nových leadov"));
    assert.ok(!delivered[0].message?.includes("{{"));
    assert.equal(delivered[0].countryCode, "SK");
    assert.equal((await db.select().from(notifications).where(eq(notifications.userId, ownerId))).length, 0, "admins are not automatically notified");
    await db.update(workflowRules).set({ enabled: false }).where(eq(workflowRules.id, ruleId));
    await processEvent(event.id, [ruleId]);
    assert.equal((await db.select().from(notifications).where(eq(notifications.userId, recipientId))).length, 1);
    await db.delete(leadCampaigns).where(eq(leadCampaigns.id, campaignId));
    await db.update(workflowRules).set({ enabled: true }).where(eq(workflowRules.id, ruleId));
    await processEvent(event.id, [ruleId]);
    assert.equal((await db.select().from(notifications).where(eq(notifications.userId, recipientId))).length, 1, "deleted selected campaign is never broadened");
  } finally {
    await db.delete(notifications).where(inArray(notifications.userId, [ownerId, recipientId]));
    if (ruleId) {
      const runs = await db.select({ id: workflowRuns.id }).from(workflowRuns).where(eq(workflowRuns.ruleId, ruleId));
      if (runs.length) await db.delete(workflowActionLog).where(inArray(workflowActionLog.runId, runs.map(row => row.id)));
      await db.delete(workflowRuns).where(eq(workflowRuns.ruleId, ruleId));
      await db.delete(workflowRules).where(eq(workflowRules.id, ruleId));
    }
    if (jobId) {
      await db.delete(workflowEvents).where(and(eq(workflowEvents.module, "lead_search"), eq(workflowEvents.entityId, String(jobId))));
      await db.delete(searchJobs).where(eq(searchJobs.id, jobId));
    }
    if (campaignId) await db.delete(leadCampaigns).where(eq(leadCampaigns.id, campaignId));
    await db.delete(users).where(inArray(users.id, [ownerId, recipientId]));
  }
});

test("real Automation API saves and reopens campaign selection, rejects missing/deleted IDs and allows disabling", async () => {
  const ownerId = randomUUID(), prefix = `lead-api-${randomUUID()}`;
  let campaignId: number | undefined, ruleId: string | undefined;
  // Isolated HTTP harness only. The application's authentication is unchanged.
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).session = { user: { id: ownerId, role: "admin", assignedCountries: ["SK"] } };
    next();
  });
  registerAutomationRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const request = (path: string, method = "GET", body?: unknown) =>
    fetch(`http://127.0.0.1:${address.port}/api/automation${path}`, {
      method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  try {
    await db.insert(users).values({ id: ownerId, username: prefix, email: `${prefix}@example.invalid`,
      fullName: "Synthetic API owner", passwordHash: randomUUID(), role: "admin", assignedCountries: ["SK"], isActive: true });
    const [campaign] = await db.insert(leadCampaigns).values({ name: prefix, targetModule: "clinics", country: "SK" }).returning();
    campaignId = campaign.id;
    const available = await request("/lead-campaigns");
    assert.equal(available.status, 200);
    assert.ok((await available.json()).some((row: any) => row.id === campaignId && row.name === prefix));
    const create = await request("/rules", "POST", { ...rule, name: prefix, enabled: undefined,
      trigger: { ...rule.trigger, leadCampaignIds: [campaignId] } });
    assert.equal(create.status, 200, await create.clone().text());
    const saved = await create.json();
    ruleId = saved.id;
    assert.deepEqual(saved.trigger.leadCampaignIds, [campaignId]);
    assert.equal(saved.enabled, false);
    assert.equal((await request(`/rules/${ruleId}`, "PATCH", { trigger: { ...rule.trigger, leadCampaignIds: [] } })).status, 400);
    assert.equal((await request(`/rules/${ruleId}`, "PATCH", { enabled: true })).status, 200);
    const reopened = await db.select().from(workflowRules).where(eq(workflowRules.id, ruleId!));
    assert.deepEqual((reopened[0].trigger as any).leadCampaignIds, [campaignId]);
    assert.equal(reopened[0].enabled, true);
    await db.delete(leadCampaigns).where(eq(leadCampaigns.id, campaignId));
    assert.equal((await request(`/rules/${ruleId}`, "PATCH", { enabled: true })).status, 400);
    assert.equal((await request(`/rules/${ruleId}`, "PATCH", { enabled: false })).status, 200);
    assert.equal((await request("/rules", "POST", { ...rule, name: prefix, trigger: { ...rule.trigger, leadCampaignIds: [campaignId] } })).status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (ruleId) await db.delete(workflowRules).where(eq(workflowRules.id, ruleId));
    if (campaignId) await db.delete(leadCampaigns).where(eq(leadCampaigns.id, campaignId));
    await db.delete(users).where(eq(users.id, ownerId));
  }
});

test.after(async () => { await pool.end(); });
