import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { transformSync } from "esbuild";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../shared/schema";
import { ensureChatAnalysisOutboxSchema } from "./chat-analysis-outbox-schema";
import { admitAutomationRun } from "./automation-run-admission";
import { analysisEffectSourceKey, claimAnalysisEffect } from "./automation-effect-admission";
import { ensureAutomationRetrySchema } from "./automation-retry-schema";
import { matchesRuleCountryScope } from "./automation-capabilities";
import { ANALYSIS_SOURCE_EVENTS, isAnalysisServiceEvent, analysisResultMatches } from "../../shared/automation-analysis-triggers";
import { automationBranch, automationAnalysisUnknown } from "../../shared/automation-branches";
import { enterRuleEvaluation } from "./automation-no-match";
import { taskCommunicationSourceChanged } from "../../shared/automation-task-source";
import { and, eq } from "drizzle-orm";

// Execute the production modules against an isolated PostgreSQL schema.
// Only the engine's side effects are replaced; no message/notification sender
// or external analysis provider is ever loaded by this recovery test.
function loadModule(file: string, overrides: Record<string, unknown>) {
  const require = createRequire(new URL(file, import.meta.url));
  const module = { exports: {} };
  const code = transformSync(readFileSync(new URL(file, import.meta.url), "utf8"), {
    loader: "ts", format: "cjs", supported: { "dynamic-import": false },
  }).code;
  new Function("module", "exports", "require", code)(module, module.exports, (id: string) =>
    Object.hasOwn(overrides, id) ? overrides[id] : require(id));
  return module.exports as any;
}

/** Run the actual production rule/evaluation bodies, substituting only I/O
 * dependencies. This includes the real pre-action failure and dedupe guards. */
function loadChatEngine(dependencies: Record<string, unknown>) {
  dependencies = { taskCommunicationSourceChanged, ...dependencies };
  const source = readFileSync(new URL("./automation-engine.ts", import.meta.url), "utf8");
  const run = source.split("export async function runRule(")[1].split("export async function processEvent(")[0];
  const process = source.split("export async function processEvent(")[1].split("export function initAutomationEngine")[0];
  const code = transformSync(`async function runRule(${run}\nasync function processEvent(${process}`,
    { loader: "ts" }).code;
  return new Function(...Object.keys(dependencies), `${code}; return { runRule, processEvent };`)
    (...Object.values(dependencies));
}

test("committed chat identities survive publication/dispatch interruption without replay", async () => {
  const name = `chat_recovery_${randomUUID().replaceAll("-", "")}`;
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 8 });
  const setup = await pool.connect();
  const scoped = { connect: async () => {
    const client = await pool.connect();
    await client.query(`SET search_path TO "${name}"`);
    return client;
  } };
  // Drizzle's pool adapter also needs query; each call uses the same schema.
  const scopedPool = { ...scoped, query: async (...args: any[]) => {
    const client = await scoped.connect();
    try { return await (client.query as any)(...args); } finally { client.release(); }
  } };
  const db = drizzle(scopedPool as any, { schema });
  let publisherFails = false, dispatchFails = false, interruptAfterRun = false, analysisFails = false;
  let actions = 0, dispatched = 0, directDispatches = 0, analysisAttempts = 0;
  try {
    await setup.query(`CREATE SCHEMA "${name}"; SET search_path TO "${name}";
      CREATE TABLE users (id varchar PRIMARY KEY, assigned_countries text[], full_name text, email text);
      CREATE TABLE chat_messages (id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id varchar NOT NULL, receiver_id varchar NOT NULL, content text NOT NULL,
        attachments jsonb NOT NULL DEFAULT '[]', is_read boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now());
      CREATE TABLE workflow_events (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), source text NOT NULL,
        module text NOT NULL, entity_type text NOT NULL, entity_id varchar, event_type text NOT NULL,
        old_values jsonb, new_values jsonb, changed_fields text[], actor_user_id varchar,
        country_code text, causation_run_id varchar, created_at timestamp NOT NULL DEFAULT now());
      CREATE TABLE workflow_rules (id text PRIMARY KEY, rate_limit_per_hour integer);
      CREATE TABLE workflow_runs (id text PRIMARY KEY DEFAULT gen_random_uuid(), rule_id text,
        event_id text, status text, skipped_reason text, payload jsonb, causation_chain text[],
        started_at timestamp DEFAULT now(), finished_at timestamp, error text, action_results jsonb);
      CREATE TABLE workflow_action_log (id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        run_id varchar, action_index integer, action_type text, status text, output jsonb, error text,
        retry_count integer DEFAULT 0, executed_at timestamp DEFAULT now());
      INSERT INTO users(id, assigned_countries) VALUES ('sender', ARRAY['SK']), ('recipient', ARRAY['SK']);
      INSERT INTO workflow_rules VALUES ('rule', NULL);
    `);
    await ensureChatAnalysisOutboxSchema(setup);
    await ensureAutomationRetrySchema(setup);
    await ensureChatAnalysisOutboxSchema(setup); // Startup migration is repeatable.
    const bus = loadModule("./event-bus.ts", { "../db": { db } });
    bus.setEventDispatcher(async () => { directDispatches++; });
    const engineRule = { id: "rule", module: "communication", createdByUserId: "recipient",
      trigger: { type: "event", eventType: "chat.received", analysis: { channels: ["chat"], analyzeContent: true } },
      conditions: {}, actions: [{ type: "test_action" }] };
    const engine = loadChatEngine({
      db, pool: scopedPool, eq, and, analysisEffectSourceKey, claimAnalysisEffect,
      workflowRuns: schema.workflowRuns, workflowRules: schema.workflowRules,
      workflowActionLog: schema.workflowActionLog, workflowEvents: schema.workflowEvents,
      leadSearchTriggerMatches: () => true, leadSearchExecutionAllowed: async () => true,
      enterRuleEvaluation, analyzeCommunication: async () => {
        analysisAttempts++;
        if (analysisFails) throw new Error("analysis_ai_unavailable");
        return { sentiment: "negative", communication: {} };
      },
      analysisResultMatches, taskAssignmentTriggerMatches: () => true,
      permitsSentimentSource: () => true, evalCondition: () => true,
      automationAnalysisUnknown, automationBranch, MAX_CAUSATION_DEPTH: 5, admitAutomationRun,
      ACTION_HANDLERS: { test_action: async () => { actions++; return { ok: true }; } },
      findMatchingRules: async () => [engineRule],
    });
    const dependencies = {
      "../db": { db, pool: scoped },
      "./event-bus": { emitEventOnceForIdentity: async (...args: any[]) => {
        if (publisherFails) throw new Error("temporary publisher failure");
        return bus.emitEventOnceForIdentity(...args);
      } },
      "./automation-engine": { processEvent: async (eventId: string) => {
        dispatched++;
        if (dispatchFails) throw new Error("interrupted before evaluation");
        await engine.processEvent(eventId);
        if (interruptAfterRun) throw new Error("interrupted after action reservation");
      } },
    };
    let worker = loadModule("./chat-analysis-outbox.ts", dependencies);
    const save = async (id: string) => db.transaction(async tx => {
      const [message] = await tx.insert(schema.chatMessages).values({
        id, senderId: "sender", receiverId: "recipient", content: "Synthetic test",
      }).returning();
      await worker.enqueueChatAnalysis(tx, message);
      return message;
    });
    await db.insert(schema.chatMessages).values({
      id: "historical", senderId: "sender", receiverId: "recipient", content: "No replay",
    });
    await assert.rejects(db.transaction(async tx => {
      const [message] = await tx.insert(schema.chatMessages).values({
        id: "rollback", senderId: "sender", receiverId: "recipient", content: "Not committed",
      }).returning();
      await worker.enqueueChatAnalysis(tx, message);
      throw new Error("transaction rollback");
    }));
    assert.equal((await setup.query("SELECT count(*)::int AS n FROM chat_analysis_outbox")).rows[0].n, 0);

    // Commit, then lose the entire publisher process before it runs.
    const message = await save("committed");
    // Actual source resolver must still reject a nonparticipant, even admin.
    const resolver = loadModule("./automation-analysis-source.ts", {
      "../db": { db },
      "../storage": { storage: { getUser: async (id: string) => ({ id, isActive: id !== "inactive", role: "admin" }) } },
      "./token-crypto": {}, "./ms365": {}, "./task-contract": {},
    });
    const sourceEvent = { module: "communication", eventType: "chat.received", entityId: message.id };
    const rule = { trigger: { analysis: { channels: ["chat"] } } };
    assert.equal(await resolver.loadAnalysisSource({ ...rule, createdByUserId: "outsider" }, sourceEvent), null);
    assert.equal(await resolver.loadAnalysisSource({ ...rule, createdByUserId: "inactive" }, sourceEvent), null);
    assert.equal((await resolver.loadAnalysisSource({ ...rule, createdByUserId: "recipient" }, sourceEvent))?.ownerUserId, "recipient");
    worker = loadModule("./chat-analysis-outbox.ts", dependencies);
    publisherFails = true;
    await worker.recoverChatAnalysis();
    let pending = (await setup.query("SELECT * FROM chat_analysis_outbox")).rows[0];
    assert.equal(pending.attempts, 1);
    assert.equal(pending.completed_at, null);
    assert.equal((await setup.query("SELECT count(*)::int AS n FROM workflow_events")).rows[0].n, 0);
    // Changing assignments during an outage cannot broaden source country.
    await setup.query("UPDATE users SET assigned_countries=ARRAY['CZ'] WHERE id='recipient'");
    publisherFails = false;
    dispatchFails = true;
    await setup.query("UPDATE chat_analysis_outbox SET next_attempt_at=now()");
    await worker.recoverChatAnalysis();
    const event = (await setup.query("SELECT * FROM workflow_events")).rows[0];
    assert.equal(event.country_code, "SK");
    assert.equal(event.actor_user_id, "sender");
    assert.equal(event.created_at.getTime(), message.createdAt.getTime());
    assert.deepEqual(event.new_values, { type: "chat", serviceSourceId: "committed" });
    assert.equal(directDispatches, 0, "event persistence must not race durable dispatch");

    // Actual runRule must propagate a temporary analysis error to the outbox,
    // without creating a terminal run that suppresses the subsequent retry.
    dispatchFails = false;
    analysisFails = true;
    await setup.query("UPDATE chat_analysis_outbox SET next_attempt_at=now()");
    await worker.recoverChatAnalysis();
    assert.equal(analysisAttempts, 1);
    assert.equal(actions, 0);
    assert.equal((await setup.query("SELECT count(*)::int AS n FROM workflow_runs")).rows[0].n, 0);
    pending = (await setup.query("SELECT * FROM chat_analysis_outbox")).rows[0];
    assert.equal(pending.completed_at, null);
    assert.equal(pending.attempts, 3);
    analysisFails = false;

    // Event insert committed but its outbox pointer was not saved before crash.
    await setup.query("UPDATE chat_analysis_outbox SET event_id=NULL, next_attempt_at=now()");
    worker = loadModule("./chat-analysis-outbox.ts", dependencies);
    dispatchFails = false;
    interruptAfterRun = true;
    await worker.recoverChatAnalysis();
    assert.equal(actions, 1);
    assert.equal(analysisAttempts, 2, "analysis must run again after the provider recovers");
    assert.equal((await setup.query("SELECT status FROM workflow_runs")).rows[0].status, "success");
    assert.equal((await setup.query("SELECT status FROM workflow_action_log")).rows[0].status, "success");
    assert.equal((await setup.query("SELECT count(*)::int AS n FROM workflow_events")).rows[0].n, 1);
    interruptAfterRun = false;
    await setup.query("UPDATE chat_analysis_outbox SET next_attempt_at=now()");
    worker = loadModule("./chat-analysis-outbox.ts", dependencies);
    await Promise.all([worker.recoverChatAnalysis(), worker.recoverChatAnalysis()]);
    assert.equal(actions, 1, "an ambiguous started action must not be replayed");
    assert.equal(analysisAttempts, 2, "already reserved actions must bypass re-analysis as well");
    assert.equal((await setup.query("SELECT count(*)::int AS n FROM workflow_runs")).rows[0].n, 1);
    assert.ok((await setup.query("SELECT completed_at FROM chat_analysis_outbox")).rows[0].completed_at);
    const before = dispatched;
    await worker.recoverChatAnalysis();
    assert.equal(dispatched, before);
    assert.equal((await setup.query("SELECT count(*)::int AS n FROM chat_messages")).rows[0].n, 2);
    assert.equal((await setup.query("SELECT count(*)::int AS n FROM workflow_events WHERE entity_id='historical'")).rows[0].n, 0);

    // Separate processes cannot drain the same batch concurrently.
    await save("parallel");
    const peer = loadModule("./chat-analysis-outbox.ts", dependencies);
    await Promise.all([worker.recoverChatAnalysis(), peer.recoverChatAnalysis()]);
    assert.equal(actions, 2);
    assert.equal((await setup.query("SELECT count(*)::int AS n FROM workflow_runs")).rows[0].n, 2);
    assert.equal((await setup.query("SELECT count(*)::int AS n FROM workflow_runs WHERE status='success'")).rows[0].n, 2);
    assert.equal((await setup.query("SELECT count(*)::int AS n FROM chat_analysis_outbox WHERE completed_at IS NULL")).rows[0].n, 0);
  } finally {
    await setup.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
    setup.release();
    await pool.end();
  }
});

test("actual chat rule matcher preserves original event time and fail-closed country scope", () => {
  const source = readFileSync(new URL("./automation-engine.ts", import.meta.url), "utf8");
  const fn = source.split("export function eventMatchesRule")[1].split("type ScheduledCandidate")[0];
  // The matcher delegates to the shared diagnostic gate; evaluate both real
  // function bodies, removing only the nested export for this function harness.
  const code = transformSync(`function eventMatchesRule${fn.replace(
    "export function eventRuleExclusion", "function eventRuleExclusion",
  )}`, { loader: "ts" }).code;
  const matches = new Function("leadSearchTriggerMatches", "taskStatusTriggerMatches",
    "isAnalysisServiceEvent", "ANALYSIS_SOURCE_EVENTS", "matchesRuleCountryScope",
    `${code}; return eventMatchesRule`)(() => true, () => true, isAnalysisServiceEvent,
    ANALYSIS_SOURCE_EVENTS, matchesRuleCountryScope);
  const occurredAt = new Date("2026-10-16T08:00:00Z");
  const rule = { enabled: true, module: "communication", countryCodes: ["SK"],
    createdAt: new Date("2026-10-15T00:00:00Z"),
    trigger: { type: "event", eventType: "chat.received", listenAfter: "2026-10-16T07:00:00Z" } };
  const event = { module: "communication", eventType: "chat.received", createdAt: occurredAt, countryCode: "SK" };
  assert.equal(matches(rule, event), true);
  assert.equal(matches(rule, { ...event, countryCode: null }), false);
  assert.equal(matches(rule, { ...event, countryCode: "CZ" }), false);
  assert.equal(matches({ ...rule, createdAt: new Date("2026-10-16T09:00:00Z") }, event), false);
  assert.equal(matches({ ...rule, trigger: { ...rule.trigger, listenAfter: "2026-10-16T09:00:00Z" } }, event), false);
  assert.equal(matches({ ...rule, trigger: { ...rule.trigger, reviewActivatedAt: "2026-10-16T09:00:00Z" } }, event), false);
});

test("both production chat writers enroll before commit, and engine gates retries before actions", () => {
  const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  const storage = source("../storage.ts").split("async createChatMessage(")[1].split("async markMessagesAsRead")[0];
  assert.ok(storage.indexOf("await enqueueChatAnalysis(tx, message)") < storage.indexOf("return message;"));
  const engine = source("./automation-engine.ts");
  const run = engine.split("export async function runRule(")[1];
  assert.ok(run.indexOf("if (prior) return") < run.indexOf("await analyzeCommunication"));
  assert.match(run, /deduplicateEvent: \(event\.eventType === "chat.received" \|\| Boolean\(\(rule\.trigger as any\)\?\.analysis\)\) && !manual/);
  assert.match(engine, /new Date\(rule.createdAt\) > new Date\(event.createdAt\)/);
  assert.match(engine, /t.listenAfter.*event.createdAt/);
  assert.match(engine, /matchesRuleCountryScope\(rule.countryCodes, rule.countryCode, event.countryCode\)/);
  const analysis = source("./automation-analysis-source.ts");
  assert.match(analysis, /!\[message.senderId, message.receiverId\]\.includes\(creator.id\)/);
});
