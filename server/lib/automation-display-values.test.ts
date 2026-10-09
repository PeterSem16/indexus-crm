import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { automationDisplayValues, renderAutomationText, taskDisplayContent, type ReferenceLookup } from "./automation-display-values";
import { createAutomationReferenceLookup } from "./automation-reference-lookup";
import { renderEmailValue, renderEmailAddressConfig, sanitizeAutomationEmail } from "./automation-email-policy";

test("Email subject/body localize task dates without mutating event values or URL variables", async () => {
  const source = {
    event: { module: "task", countryCode: "SK" },
    newValues: { dueDate: "2026-10-08T00:00:00.000Z", createdAt: "2026-10-09T14:47:54Z" },
    oldValues: { dueDate: "2026-10-07T00:00:00.000Z" },
  };
  const subject = "Termín {{newValues.dueDate}}";
  const body = '<p>{{oldValues.dueDate}} → {{newValues.dueDate}}; {{newValues.createdAt}}</p>' +
    '<a href="/tasks?deadline={{newValues.dueDate}}">detail</a>';
  const display = await automationDisplayValues(source, [subject, body], async () => null);
  assert.equal(renderEmailValue(subject, source, false, display), "Termín 8. 10. 2026");
  const html = renderEmailValue(body, source, true, display);
  assert.ok(html.includes("7. 10. 2026 → 8. 10. 2026; 9. 10. 2026 16:47"));
  assert.ok(html.includes('href="/tasks?deadline=2026-10-08T00:00:00.000Z"'));
  assert.equal(source.newValues.dueDate, "2026-10-08T00:00:00.000Z");
});

const ctx = {
  event: { module: "task", countryCode: "SK" },
  newValues: { id: "task-id", title: "Original task", customerId: "customer-id", createdByUserId: "creator-id",
    assignedUserId: "agent-id", assignedDepartmentId: "department-id", taskGroupIds: ["group-a", "group-b"],
    resolvedByUserId: "resolver-id", resolvedByGroupIds: ["group-a"] },
  oldValues: { customerId: "old-customer-id", assignedUserId: "old-agent-id" },
};
const labels: Record<string, string> = {
  "customer:customer-id": "Test Contact", "customer:old-customer-id": "Previous Contact",
  "user:creator-id": "Test Creator", "user:agent-id": "Test Assignee", "user:old-agent-id": "Previous Assignee",
  "user:resolver-id": "Test Resolver", "department:department-id": "Test Department",
  "group:group-a": "Back Office", "group:group-b": "Operations",
};
const lookup: ReferenceLookup = async (kind, id) => labels[`${kind}:${id}`] || null;

test("the screenshot's edited template resolves contact and creator without changing raw event IDs", async () => {
  const before = JSON.stringify(ctx);
  const subject = "New task {{newValues.customerId}}";
  const body = '<h1>New task {{newValues.customerId}}</h1><p>{{newValues.title}} by {{newValues.createdByUserId}}</p>';
  const values = await automationDisplayValues(ctx, [subject, body], lookup);
  assert.equal(renderEmailValue(subject, ctx, false, values), "New task Test Contact");
  assert.equal(renderEmailValue(body, ctx, true, values), "<h1>New task Test Contact</h1><p>Original task by Test Creator</p>");
  assert.equal(JSON.stringify(ctx), before);
});

test("Task title, description, instructions and checklist resolve all supported staff/group/contact references", async () => {
  const config = {
    title: "{{newValues.customerId}}", description: "{{newValues.createdByUserId}} / {{newValues.assignedDepartmentId}}",
    taskText: "{{newValues.assignedUserId}}; {{newValues.taskGroupIds}}; {{oldValues.customerId}}; {{oldValues.assignedUserId}}; {{newValues.resolvedByUserId}}; {{newValues.resolvedByGroupIds}}",
    checklist: ["Contact {{newValues.customerId}}", "Ask {{newValues.createdByUserId}}"],
    assignedUserId: "{{newValues.assignedUserId}}", customerId: "{{newValues.customerId}}",
  };
  const values = await automationDisplayValues(ctx, [config.title, config.description, config.taskText, config.checklist], lookup);
  assert.deepEqual(taskDisplayContent(config, ctx, values), {
    title: "Test Contact", description: "Test Creator / Test Department",
    taskText: "Test Assignee; Back Office, Operations; Previous Contact; Previous Assignee; Test Resolver; Back Office",
    checklist: ["Contact Test Contact", "Ask Test Creator"],
  });
  assert.equal(config.assignedUserId, "{{newValues.assignedUserId}}"); // Structured routing remains raw.
  assert.equal(ctx.newValues.customerId, "customer-id");
});

test("HTML and text URLs, email recipient IDs and explicitly technical IDs retain raw values", async () => {
  const body = '<a title="A > B" href="/customers/{{newValues.customerId}}">{{newValues.customerId}}</a>';
  const values = await automationDisplayValues(ctx, [body, "{{newValues.createdByUserId}}"], lookup);
  assert.equal(renderEmailValue(body, ctx, true, values),
    '<a title="A > B" href="/customers/customer-id">Test Contact</a>');
  assert.equal(renderAutomationText("{{newValues.customerId}} https://indexus.test/customers/{{newValues.customerId}}", ctx, values),
    "Test Contact https://indexus.test/customers/customer-id");
  assert.equal(renderEmailValue("{{newValues.id}}", ctx, false, values), "task-id");
  assert.equal(renderEmailAddressConfig({ to: "{{newValues.createdByUserId}}" }, ctx).to, "creator-id");
});

test("reference labels are escaped in HTML, looked up once, and never fall back to IDs", async () => {
  let calls = 0;
  const values = await automationDisplayValues(ctx, ["{{newValues.customerId}} {{newValues.customerId}}"], async () => {
    calls++; return '<img src=x onerror="bad()"> & Test';
  });
  const html = sanitizeAutomationEmail(renderEmailValue("<h1>{{newValues.customerId}}</h1>", ctx, true, values));
  assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<img"));
  assert.equal(calls, 1);
  await assert.rejects(automationDisplayValues(ctx, ["{{newValues.customerId}}"], async () => null), /unavailable: newValues.customerId/);
  await assert.rejects(automationDisplayValues(ctx, ["{{newValues.customerId}}"], async (_kind, id) => id), /unavailable/);
  const empty = { ...ctx, newValues: { customerId: null } };
  const blank = await automationDisplayValues(empty, ["{{newValues.customerId}}"], lookup);
  assert.equal(renderEmailValue("{{newValues.customerId}}", empty, false, blank), "");
  assert.equal(renderAutomationText("{{newValues.customerId}}", empty, blank), "");
});

test("linked institutions, Missions and queues use explicit reference types and trusted country", async () => {
  const seen: unknown[] = [];
  const event = { event: { module: "communication", countryCode: "SK" }, oldValues: { customerId: "old-clinic" },
    newValues: { customerId: "clinic-id", contactType: "clinic", campaignId: "mission-id", queueId: "queue-id" } };
  await automationDisplayValues(event, ["{{newValues.customerId}} {{newValues.campaignId}} {{newValues.queueId}} {{oldValues.customerId}}"], async (...args) => {
    seen.push(args); return "Label";
  });
  assert.deepEqual(seen, [["clinic", "clinic-id", "SK"], ["campaign", "mission-id", "SK"], ["queue", "queue-id", "SK"], ["clinic", "old-clinic", "SK"]]);
  const related = { ...ctx, newValues: { relatedEntityType: "hospital", relatedEntityId: "hospital-id" } };
  const values = await automationDisplayValues(related, ["{{newValues.relatedEntityId}}"], async kind => `${kind} name`);
  assert.equal(renderAutomationText("{{newValues.relatedEntityId}}", related, values), "hospital name");
});

test("real PostgreSQL lookup selects only labels, respects countries and preserves aliases/multi-country Missions", async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`BEGIN; SET LOCAL search_path=pg_temp;
      CREATE TEMP TABLE users (id text, full_name text, username text);
      CREATE TEMP TABLE customers (id text, first_name text, last_name text, country text);
      CREATE TEMP TABLE task_groups (id text, display_alias text, name text);
      CREATE TEMP TABLE campaigns (id text, name text, country_codes text[]);
      CREATE TEMP TABLE collaborators (id text, first_name text, last_name text, country_code text, country_codes text[]);
      CREATE TEMP TABLE tasks (id text, title text, country text);
      CREATE TEMP TABLE contract_instances (id text, contract_number text, customer_id text);
      CREATE TEMP TABLE invoices (id text, invoice_number text, customer_id text);
      INSERT INTO users VALUES ('creator-id','Test Creator','creator');
      INSERT INTO customers VALUES ('customer-id','Test','Contact','SK');
      INSERT INTO task_groups VALUES ('group-a','BO alias','Back Office');
      INSERT INTO campaigns VALUES ('mission','Test Mission',ARRAY['SK','CZ']);
      INSERT INTO tasks VALUES ('related-task','Source Task','SK');
      INSERT INTO contract_instances VALUES ('contract','Contract 123','customer-id');
      INSERT INTO invoices VALUES ('invoice','Invoice 123','customer-id');
      INSERT INTO collaborators VALUES ('staff','Test','Collaborator','SK',ARRAY['SK','CZ']);`);
    const resolve = createAutomationReferenceLookup(client);
    assert.equal(await resolve("user", "creator-id", null), "Test Creator");
    assert.equal(await resolve("customer", "customer-id", "SK"), "Test Contact");
    assert.equal(await resolve("customer", "customer-id", "RO"), null);
    assert.equal(await resolve("customer", "customer-id", null), null);
    assert.equal(await resolve("group", "group-a", "SK"), "BO alias");
    assert.equal(await resolve("campaign", "mission", "CZ"), "Test Mission");
    assert.equal(await resolve("campaign", "mission", "RO"), null);
    assert.equal(await resolve("collaborator", "staff", "CZ"), "Test Collaborator");
    assert.equal(await resolve("task", "related-task", "SK"), "Source Task");
    assert.equal(await resolve("contract", "contract", "SK"), "Contract 123");
    assert.equal(await resolve("invoice", "invoice", "SK"), "Invoice 123");
    assert.equal(await resolve("contract", "contract", "RO"), null);
    assert.equal(await resolve("invoice", "invoice", "RO"), null);
    const values = await automationDisplayValues(ctx, ["{{newValues.customerId}} {{newValues.createdByUserId}}"], resolve);
    assert.equal(renderAutomationText("{{newValues.customerId}} / {{newValues.createdByUserId}}", ctx, values), "Test Contact / Test Creator");
    // Exercise the actual engine preview, not just the isolated render helpers.
    // Redirect this test process's read-only lookup into session-private tables.
    const { pool: enginePool } = await import("../db");
    const originalQuery = enginePool.query;
    enginePool.query = client.query.bind(client) as typeof enginePool.query;
    try {
      const { dryRunRule } = await import("./automation-engine");
      const preview = await dryRunRule({
        module: "task", trigger: { type: "event", event: "created" }, conditions: null,
        actions: [
          { type: "create_task", config: { title: "{{newValues.customerId}}", taskText: "{{newValues.createdByUserId}}",
            assignedUserId: "{{newValues.createdByUserId}}", customerId: "{{newValues.customerId}}" } },
          { type: "send_email", config: { subject: "{{newValues.customerId}}",
            body: '<a href="/customers/{{newValues.customerId}}">{{newValues.customerId}}</a> {{newValues.createdByUserId}}',
            to: "recipient@example.test" } },
        ],
      } as any, { ...ctx.event, eventType: "created", newValues: ctx.newValues } as any);
      assert.equal(preview.actions[0].rendered.title, "Test Contact");
      assert.equal(preview.actions[0].rendered.taskText, "Test Creator");
      assert.equal(preview.actions[0].rendered.assignedUserId, "creator-id");
      assert.equal(preview.actions[0].rendered.customerId, "customer-id");
      assert.equal(preview.actions[1].rendered.subject, "Test Contact");
      assert.equal(preview.actions[1].rendered.body,
        '<a href="/customers/customer-id">Test Contact</a> Test Creator');
      assert.equal(preview.actions[1].rendered.to, "recipient@example.test");
      assert.equal(preview.ctx.newValues.customerId, "customer-id");
    } finally { enginePool.query = originalQuery; }
  } finally { await client.query("ROLLBACK"); client.release(); await pool.end(); }
});
