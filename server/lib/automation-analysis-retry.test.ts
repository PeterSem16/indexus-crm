import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "../db";
import { users, chatMessages, workflowRules, workflowEvents, workflowRuns, tasks,
  communicationMessages, userMs365Connections, taskComments } from "../../shared/schema";
import { registerAnalysisRetryRoutes, retryContext } from "./automation-analysis-retry";
import { ensureAutomationRetrySchema } from "./automation-retry-schema";
import { runRule } from "./automation-engine";

test("single-source HTTP retry: confirmations, concurrent clicks, revocation, partial task recovery, immutable audit", async () => {
  await ensureAutomationRetrySchema(pool);
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const ruleId = randomUUID(), sourceId = randomUUID(), eventId = randomUUID();
  const prefix = `analysis-retry-${randomUUID()}`;
  const emailId = randomUUID(), taskId = randomUUID(), commentId = randomUUID();
  const extraEventIds = [randomUUID(), randomUUID()];
  const app = express();
  app.use(express.json());
  registerAnalysisRetryRoutes(app, (_req, _res, next) => next(), req => req.headers["x-test-viewer"] || ids[0]);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/automation/rules/${ruleId}/analysis-retry`;
  const selection = { sourceId, sourceEvent: "chat.received" as const };
  const call = async (path: string, body?: any, viewerId = ids[0]) => {
    const response = await fetch(base + path, { method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", "x-test-viewer": viewerId },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() as any };
  };
  try {
    await db.insert(users).values(ids.map((id, i) => ({ id, username: `${prefix}-${i}`, passwordHash: "not-a-login",
      fullName: "Synthetic retry tester", email: `${prefix}-${i}@example.invalid`,
      role: i === 1 ? "manager" : "admin", assignedCountries: ["SK"], isActive: true })));
    await db.insert(chatMessages).values({ id: sourceId, senderId: ids[1], receiverId: ids[0], content: "" });
    const trigger = { type: "event", eventType: "communication.received",
      listenAfter: new Date(Date.now() + 60000).toISOString(),
      analysis: { channels: ["chat"], analyzeContent: false, analyzeAttachments: true } };
    const actions = [0, 1].map(index => ({ type: "create_task", config: {
      title: `${prefix}-${index}`, description: "Synthetic retry task", assignedUserId: ids[0], country: "SK",
    } }));
    await db.insert(workflowRules).values({ id: ruleId, name: prefix, module: "communication",
      enabled: true, trigger, actions, createdByUserId: ids[0], countryCodes: ["SK"] });
    await db.insert(workflowEvents).values({ id: eventId, module: "communication", entityType: "communication",
      entityId: sourceId, eventType: "chat.received", source: "manual", countryCode: "SK" });
    const [original] = await db.insert(workflowRuns).values({ ruleId, eventId, status: "skipped",
      skippedReason: "analysis_condition_unknown", finishedAt: new Date(),
      payload: { analysis: { summary: "Synthetic original analysis", attachmentCount: 1, failedAttachmentCount: 1 } } }).returning();
    const preview = await call("/preview", selection);
    assert.equal(preview.status, 200, "explicit retry may override only the historical cutoff");
    assert.equal(preview.body.runs[0].id, original.id);
    assert.equal(preview.body.existingAnalyses[0].summary, "Synthetic original analysis");
    assert.deepEqual(preview.body.rule.actions, actions);
    assert.equal((await call("/preview", selection, ids[2])).status, 409, "even admin cannot inspect another private chat");
    const request = { ...selection, token: preview.body.token, requestId: randomUUID(), confirmed: true };
    assert.equal((await call("/analyze", { ...request, confirmed: false })).status, 400);
    const responses = await Promise.all(Array.from({ length: 6 }, () => call("/analyze", request)));
    assert.ok(responses.every(r => r.status === 200));
    const attemptIds = [...new Set(responses.map(r => r.body.attemptId))];
    assert.equal(attemptIds.length, 1, "double-click/concurrent retry returns one persisted attempt");
    const attemptId = attemptIds[0];
    const recovered = await call(`/${attemptId}?${new URLSearchParams(selection)}`);
    assert.equal(recovered.body.status, "ready");
    assert.equal((await db.select().from(workflowRuns).where(eq(workflowRuns.ruleId, ruleId))).length, 1,
      "analysis must not execute actions or insert action runs");
    assert.equal((await call("/analyze", { ...request, sourceId: randomUUID() })).status, 409);

    const execute = { ...selection, attemptId, confirmed: true };
    await db.update(users).set({ isActive: false }).where(eq(users.id, ids[0]));
    assert.equal((await call("/execute", execute)).status, 409, "current active status, not cached session role");
    await db.update(users).set({ isActive: true, role: "manager" }).where(eq(users.id, ids[0]));
    assert.equal((await call("/execute", execute)).status, 409, "revoked administrator permission");
    await db.update(users).set({ role: "admin" }).where(eq(users.id, ids[0]));
    await db.update(workflowRules).set({ trigger: { ...trigger, analysis: { ...trigger.analysis, channels: ["task"] } } })
      .where(eq(workflowRules.id, ruleId));
    assert.equal((await call("/execute", execute)).status, 409, "channel removed after review");
    await db.update(workflowRules).set({ trigger, countryCodes: ["CZ"] }).where(eq(workflowRules.id, ruleId));
    assert.equal((await call("/execute", execute)).status, 409, "country still checked on historical events");
    await db.update(workflowRules).set({ countryCodes: ["SK"], createdByUserId: ids[1] }).where(eq(workflowRules.id, ruleId));
    await db.update(users).set({ assignedCountries: ["CZ"] }).where(eq(users.id, ids[1]));
    assert.equal((await call("/preview", selection)).status, 409, "current author country scope is enforced");
    await db.update(users).set({ assignedCountries: ["SK"] }).where(eq(users.id, ids[1]));
    await db.update(workflowRules).set({ createdByUserId: ids[0], enabled: false }).where(eq(workflowRules.id, ruleId));
    assert.equal((await call("/execute", execute)).status, 409, "paused rules are never bypassed");
    await db.update(workflowRules).set({ enabled: true, name: `${prefix}-edited` }).where(eq(workflowRules.id, ruleId));
    assert.equal((await call("/execute", execute)).status, 409, "definition changes invalidate prior analysis");

    // Use the real action handler and simulate interruption between two actions.
    const context = await retryContext(ruleId, ids[0], selection);
    const analysis = recovered.body.analysis;
    let checks = 0;
    await assert.rejects(runRule(context.rule, context.event, [], undefined, {
      attemptId: randomUUID(), analysis, authorize: async () => {
        if (++checks === 2) throw new Error("access_revoked_between_actions");
      },
    }), /access_revoked/);
    const countTasks = async () => (await pool.query("SELECT count(*)::int n FROM tasks WHERE title LIKE $1", [`${prefix}%`])).rows[0].n;
    assert.equal(await countTasks(), 1, "first real task completed before interruption");
    const nextPreview = await call("/preview", selection);
    const secondAnalysis = await call("/analyze", { ...selection, token: nextPreview.body.token, requestId: randomUUID(), confirmed: true });
    assert.equal(secondAnalysis.body.status, "ready");
    const secondExecution = { ...selection, attemptId: secondAnalysis.body.attemptId, confirmed: true };
    assert.equal((await call("/execute", { ...secondExecution, confirmed: false })).status, 400);
    const executions = await Promise.all(Array.from({ length: 6 }, () => call("/execute", secondExecution)));
    assert.ok(executions.every(r => r.status === 200));
    assert.equal(await countTasks(), 2, "completed task is not duplicated; unstarted second task runs once");
    assert.equal((await call("/execute", secondExecution)).body.status, "done");
    assert.equal(await countTasks(), 2);
    const history = await call("/preview", selection);
    assert.equal(history.body.effects.filter((e: any) => e.status === "success").length, 2);
    assert.ok(history.body.actionResults.some((a: any) => a.status === "skipped"));
    assert.ok(history.body.existingAnalyses.length >= 2);
    const [unchanged] = await db.select().from(workflowRuns).where(eq(workflowRuns.id, original.id));
    assert.deepEqual(unchanged, original, "original skipped attempt audit is immutable");
    assert.equal((await db.select().from(workflowEvents).where(eq(workflowEvents.entityId, sourceId))).length, 1,
      "no synthetic events or bulk historical replay");

    // Preview/authorization must stay local, including mailbox identity checks.
    const mailbox = `${prefix}@example.invalid`;
    await db.insert(userMs365Connections).values({ userId: ids[0], accessToken: "synthetic-not-a-token",
      email: mailbox, isConnected: true });
    await db.insert(communicationMessages).values({ id: emailId, type: "email", direction: "inbound",
      userId: ids[0], externalId: "synthetic-mail", countryCode: "SK", content: "Synthetic email",
      metadata: JSON.stringify({ from: "sender@example.invalid", mailboxSource: { kind: "personal", ownerUserId: ids[0], mailboxEmail: mailbox } }) });
    await db.insert(tasks).values({ id: taskId, title: `${prefix}-source`, description: "Synthetic source",
      createdByUserId: ids[2], assignedUserId: ids[1], country: "SK" });
    await db.insert(taskComments).values({ id: commentId, taskId, userId: ids[1], content: "Synthetic comment" });
    await db.insert(workflowEvents).values([
      { id: extraEventIds[0], module: "communication", entityType: "communication", entityId: emailId,
        eventType: "email.received", source: "manual", countryCode: "SK" },
      { id: extraEventIds[1], module: "communication", entityType: "task", entityId: commentId,
        eventType: "task.message_received", source: "manual", countryCode: "SK" },
    ]);
    const emailTrigger = { ...trigger, analysis: { ...trigger.analysis, channels: ["email"],
      mailboxMode: "selected", mailboxUserIds: [ids[0]], senderEmails: ["sender@example.invalid"] } };
    await db.update(workflowRules).set({ trigger: emailTrigger }).where(eq(workflowRules.id, ruleId));
    const emailSelection = { sourceId: emailId, sourceEvent: "email.received" as const };
    assert.ok(await retryContext(ruleId, ids[0], emailSelection));
    await db.update(userMs365Connections).set({ isConnected: false }).where(eq(userMs365Connections.userId, ids[0]));
    await assert.rejects(retryContext(ruleId, ids[0], emailSelection), /retry_source_unavailable/);
    await db.update(userMs365Connections).set({ isConnected: true }).where(eq(userMs365Connections.userId, ids[0]));
    await db.update(workflowRules).set({ trigger: { ...emailTrigger,
      analysis: { ...emailTrigger.analysis, mailboxUserIds: [ids[1]] } } }).where(eq(workflowRules.id, ruleId));
    await assert.rejects(retryContext(ruleId, ids[0], emailSelection), /retry_source_unavailable/);
    await db.update(workflowRules).set({ trigger: { ...emailTrigger,
      analysis: { ...emailTrigger.analysis, senderEmails: ["other@example.invalid"] } } }).where(eq(workflowRules.id, ruleId));
    await assert.rejects(retryContext(ruleId, ids[0], emailSelection), /retry_source_unavailable/);
    await db.update(workflowRules).set({ createdByUserId: ids[1],
      trigger: { ...trigger, analysis: { ...trigger.analysis, channels: ["task"] } } }).where(eq(workflowRules.id, ruleId));
    await db.update(users).set({ role: "user" }).where(eq(users.id, ids[1]));
    const commentSelection = { sourceId: commentId, sourceEvent: "task.message_received" as const };
    assert.ok(await retryContext(ruleId, ids[0], commentSelection));
    await db.update(tasks).set({ assignedUserId: ids[2] }).where(eq(tasks.id, taskId));
    await assert.rejects(retryContext(ruleId, ids[0], commentSelection), /retry_source_unavailable/,
      "comment authorship is not permission after task access was removed");
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await pool.query("DELETE FROM workflow_analysis_effects WHERE rule_id=$1", [ruleId]);
    await pool.query("DELETE FROM workflow_analysis_retries WHERE rule_id=$1", [ruleId]);
    await pool.query("DELETE FROM workflow_analysis_cache WHERE owner_user_id=ANY($1::varchar[])", [ids]);
    await pool.query(`DELETE FROM workflow_action_log WHERE run_id IN(SELECT id FROM workflow_runs WHERE rule_id=$1)`, [ruleId]);
    const createdTasks = await pool.query("SELECT id FROM tasks WHERE title LIKE $1", [`${prefix}%`]);
    const taskIds = createdTasks.rows.map(row => row.id);
    if (taskIds.length) {
      for (const table of ["task_subscriptions", "task_checklist_items", "task_comments"])
        await pool.query(`DELETE FROM ${table} WHERE task_id=ANY($1::varchar[])`, [taskIds]);
      await db.delete(tasks).where(inArray(tasks.id, taskIds));
    }
    await db.delete(workflowRuns).where(eq(workflowRuns.ruleId, ruleId));
    await db.delete(workflowEvents).where(inArray(workflowEvents.id, [eventId, ...extraEventIds]));
    await db.delete(workflowRules).where(eq(workflowRules.id, ruleId));
    await db.delete(chatMessages).where(eq(chatMessages.id, sourceId));
    await db.delete(communicationMessages).where(eq(communicationMessages.id, emailId));
    await db.delete(users).where(inArray(users.id, ids));
    await pool.end();
  }
});
