import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { eq, inArray, sql } from "drizzle-orm";
import { db, pool } from "../db";
import { workflowEvents, workflowRules } from "../../shared/schema";
import { ensureAutomationInputHistorySchema } from "./automation-input-history-schema";
import { readAutomationInputHistory } from "./automation-input-history";

test("input history is atomic, private, event-bound and never backfills missing evidence", async () => {
  const ruleId = randomUUID();
  const eventIds: string[] = [];
  try {
    await ensureAutomationInputHistorySchema(pool);
    const trigger = { type: "event", eventType: "communication.received",
      analysis: { channels: ["email", "chat"], mailboxMode: "selected",
        mailboxUserIds: ["private-mailbox-owner"], senderEmails: ["private@example.invalid"],
        analyzeContent: true, analyzeAttachments: true,
        textSearch: { scope: "content", terms: ["PRIVATE-LITERAL-SEARCH"] } } };
    await db.insert(workflowRules).values({ id: ruleId, name: "Synthetic history test", module: "communication",
      enabled: false, countryCodes: ["SK"], trigger, conditions: { all: [{ value: "PRIVATE-IF-TEXT" }] }, actions: [] });
    const emit = async (createdAt?: Date) => {
      const id = randomUUID(); eventIds.push(id);
      const [event] = await db.insert(workflowEvents).values({ id, source: "manual", module: "communication",
        entityType: "communication", eventType: "email.received", entityId: randomUUID(),
        countryCode: "SK", ...(createdAt ? { createdAt } : {}) }).returning();
      return event;
    };
    const count = async () => {
      const result = await db.execute(sql`SELECT count(*)::int n FROM workflow_rule_input_versions WHERE rule_id = ${ruleId}`);
      return result.rows[0].n;
    };
    const oldEvent = await emit(new Date("2000-01-01T00:00:00Z"));
    assert.equal((await readAutomationInputHistory(ruleId, oldEvent)).status, "missing");
    const event = await emit();
    const first = await readAutomationInputHistory(ruleId, event);
    assert.equal(first.status, "verified");
    assert.equal(first.permissions, "unknown");
    assert.equal(first.changed, false);
    assert.deepEqual(first.settings?.channels, ["email", "chat"]);
    assert.deepEqual(first.settings?.countries, ["SK"]);
    assert.equal(first.settings?.enabled, false);
    assert.equal(first.settings?.mailboxCount, 1);
    assert.equal(first.settings?.senderCount, 1);
    assert.equal(first.settings?.textSearch, true);
    assert.equal(first.settings?.hasConditions, true);
    const raw = await db.execute(sql`SELECT settings FROM workflow_rule_input_versions WHERE rule_id = ${ruleId}`);
    for (const result of [raw.rows, first]) {
      assert.doesNotMatch(JSON.stringify(result), /private@example|private-mailbox-owner|PRIVATE-LITERAL|PRIVATE-IF|senderEmails|mailboxUserIds/);
    }
    const before = await count();
    await db.update(workflowRules).set({ name: "Renamed", lastErrorMessage: "PRIVATE-ERROR", consecutiveErrorCount: 2,
      updatedAt: new Date(), scheduleNextDueAt: new Date() }).where(eq(workflowRules.id, ruleId));
    assert.equal(await count(), before, "runtime counters and unrelated edits do not manufacture input versions");
    await db.update(workflowRules).set({ enabled: true, countryCodes: ["CZ"], trigger: {
      ...trigger, listenAfter: "2026-01-01T12:00:00.000Z", reviewActivatedAt: "2026-01-02T12:00:00.000Z",
      analysis: { ...trigger.analysis, channels: ["sms"], senderEmails: ["changed@example.invalid"] },
    } }).where(eq(workflowRules.id, ruleId));
    const changed = await readAutomationInputHistory(ruleId, event);
    assert.equal(changed.version, first.version);
    assert.deepEqual(changed.settings, first.settings);
    assert.equal(changed.changed, true);
    assert.deepEqual(changed.currentSettings?.channels, ["sms"]);
    assert.equal(changed.currentSettings?.listenAfter, "2026-01-01T12:00:00.000Z");
    assert.equal(changed.currentSettings?.reviewActivatedAt, "2026-01-02T12:00:00.000Z");
    assert.equal(changed.currentSettings?.enabled, true);
    assert.equal(changed.currentSettings?.senderCount, 1, "same-count filter edits must still change the fingerprint");
    assert.equal((await readAutomationInputHistory(ruleId, await emit())).changed, false);
    // A filter-only edit with unchanged counts must not disappear in the sanitized summary.
    const [saved] = await db.select().from(workflowRules).where(eq(workflowRules.id, ruleId));
    let nextTrigger = saved.trigger as typeof trigger;
    for (const analysisPatch of [
      { senderEmails: ["another@example.invalid"] },
      { mailboxUserIds: ["another-private-owner"] },
      { textSearch: { scope: "content", terms: ["ANOTHER-PRIVATE-LITERAL"] } },
      { analyzeAttachments: false },
    ]) {
      const prior = await readAutomationInputHistory(ruleId, await emit());
      const versionCount = await count() as number;
      nextTrigger = { ...nextTrigger, analysis: { ...nextTrigger.analysis, ...analysisPatch } };
      await db.update(workflowRules).set({ trigger: nextTrigger }).where(eq(workflowRules.id, ruleId));
      const historicalEventId = eventIds[eventIds.length - 1];
      const [historicalEvent] = await db.select().from(workflowEvents).where(eq(workflowEvents.id, historicalEventId));
      const result = await readAutomationInputHistory(ruleId, historicalEvent);
      assert.equal(result.changed, true);
      assert.equal(result.version, prior.version);
      assert.equal(await count(), versionCount + 1);
    }
    const versions = await db.execute(sql`SELECT settings FROM workflow_rule_input_versions WHERE rule_id = ${ruleId}`);
    assert.doesNotMatch(JSON.stringify(versions.rows), /@|PRIVATE|private-owner|mailboxUserIds|senderEmails/);
    const afterChange = await count();
    await assert.rejects(db.transaction(async tx => {
      await tx.update(workflowRules).set({ enabled: false }).where(eq(workflowRules.id, ruleId));
      throw new Error("rollback fixture");
    }), /rollback fixture/);
    assert.equal(await count(), afterChange);

    // Recovery can persist an event long after reception. Bind to its original
    // stored timestamp using the pre-change version, not the latest version.
    const delayedId = randomUUID(); eventIds.push(delayedId);
    await db.execute(sql`INSERT INTO workflow_events(id, source, module, entity_type, entity_id, event_type, created_at)
      SELECT ${delayedId}, 'manual', 'communication', 'communication', ${randomUUID()}, 'email.received', created_at
      FROM workflow_events WHERE id = ${event.id}`);
    const [delayed] = await db.select().from(workflowEvents).where(eq(workflowEvents.id, delayedId));
    assert.equal((await readAutomationInputHistory(ruleId, delayed)).version, first.version);
    // Even if history starts later, an old event must never acquire a fabricated binding.
    await ensureAutomationInputHistorySchema(pool);
    assert.equal(await count(), afterChange);
    assert.equal((await readAutomationInputHistory(ruleId, oldEvent)).status, "missing");
    assert.equal((await readAutomationInputHistory(ruleId)).status, "event_missing");
    const readsBefore = await count();
    await readAutomationInputHistory(ruleId, event);
    await readAutomationInputHistory(ruleId, event);
    assert.equal(await count(), readsBefore);
    assert.equal((await db.select().from(workflowEvents).where(inArray(workflowEvents.id, eventIds))).length, eventIds.length);
  } finally {
    await db.delete(workflowEvents).where(inArray(workflowEvents.id, eventIds));
    await db.delete(workflowRules).where(eq(workflowRules.id, ruleId));
    await pool.end();
  }
});
