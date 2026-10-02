import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool } from "../db";
import { communicationMessages, workflowEvents, workflowRules, workflowRuns } from "../../shared/schema";
import { parseWebhook } from "./bulkgate";
import { parseSmsToolsIncomingMessages } from "./smstools";
import { storeInboundSmsOnce } from "./inbound-sms";
import { storeInboundEmailOnce } from "./inbound-email";
import { emitPersistedInboundEvent } from "./inbound-communication-events";
import { emitInboundEmailEvents } from "./email-monitoring-service";
import { setEventDispatcher } from "./event-bus";
import { processEvent } from "./automation-engine";

test("retried and concurrent provider callbacks and overlapping mailbox paths run each rule once", async () => {
  const suffix = randomUUID();
  const ids: string[] = [];
  const ruleIds: string[] = [];
  const rulesByMessage = new Map<string, string[]>();
  const dispatched: Promise<void>[] = [];
  const analysisAtDispatch: boolean[] = [];
  setEventDispatcher((id) => {
    const work = (async () => {
      const [event] = await db.select().from(workflowEvents).where(eq(workflowEvents.id, id));
      if (event?.eventType === "sentiment.negative") {
        const [stored] = await db.select({
          aiAnalyzed: communicationMessages.aiAnalyzed,
          aiSentiment: communicationMessages.aiSentiment,
          aiAnalyzedAt: communicationMessages.aiAnalyzedAt,
        }).from(communicationMessages).where(eq(communicationMessages.id, event.entityId!));
        analysisAtDispatch.push(Boolean(stored?.aiAnalyzed && stored.aiAnalyzedAt &&
          (stored.aiSentiment === "negative" || stored.aiSentiment === "angry")));
      }
      await processEvent(id, rulesByMessage.get(event?.entityId || "") || []);
    })();
    dispatched.push(work);
    return work;
  });
  const body = "PRIVATE BODY " + suffix;
  const sender = "private-sender-" + suffix + "@test.invalid";
  const eventsFor = async (id: string) => db.select().from(workflowEvents)
    .where(and(eq(workflowEvents.entityId, id), eq(workflowEvents.module, "communication")));
  const addRules = async (type: "sms" | "email", received: string) => {
    const rules = await db.insert(workflowRules).values([
      {
        name: `inbound-test-${suffix}-${type}-received`,
        module: "communication",
        trigger: { type: "event", entityType: "communication", eventType: received },
        conditions: { field: "newValues.type", op: "eq", value: type },
        actions: [],
      },
      {
        name: `inbound-test-${suffix}-${type}-negative`,
        module: "communication",
        trigger: { type: "event", entityType: "communication", eventType: "sentiment.negative" },
        conditions: { field: "newValues.type", op: "eq", value: type },
        actions: [],
      },
    ]).returning({ id: workflowRules.id });
    ruleIds.push(...rules.map(r => r.id));
    return rules.map(r => r.id);
  };
  const assertOnePerRule = async (id: string, expectedTypes: string[], rules: string[]) => {
    await Promise.all(dispatched);
    const events = await eventsFor(id);
    assert.deepEqual(events.map(e => e.eventType).sort(), expectedTypes.sort());
    const runs = await db.select().from(workflowRuns).where(inArray(workflowRuns.ruleId, rules));
    const relevant = runs.filter(r => events.some(e => e.id === r.eventId));
    assert.equal(relevant.length, 2, "one rule run per channel and sentiment event");
    assert.deepEqual(relevant.map(r => r.status), ["success", "success"]);
    for (const event of events) {
      assert.equal(event.entityId, id);
      assert.equal(event.source, "webhook");
      assert.equal(event.oldValues, null);
      assert.ok(!JSON.stringify(event).includes(body), "no message content in event");
      assert.ok(!JSON.stringify(event).includes(sender), "no sender in event");
      assert.deepEqual(Object.keys(event.newValues as object).sort(),
        (event.eventType === "sentiment.negative"
          ? ["campaignId", "contactType", "customerId", "sentiment", "type"]
          : ["campaignId", "contactType", "customerId", "type"]).sort());
    }
  };

  try {
    for (const provider of ["bulkgate", "smstools"] as const) {
      const rules = await addRules("sms", "sms.received");
      const externalId = `inbound-regression-${suffix}-${provider}`;
      const parsed = provider === "bulkgate"
        ? parseWebhook({ status: "10", smsid: externalId, from: sender, message: body })
        : parseSmsToolsIncomingMessages({ sms_receive: [{ response_id: externalId, sender_phonenr: sender, message: body }] })[0];
      assert.ok(parsed);
      const values = {
        type: "sms", content: provider === "bulkgate" ? (parsed as ReturnType<typeof parseWebhook>).text || "" : (parsed as ReturnType<typeof parseSmsToolsIncomingMessages>[number]).text,
        senderPhone: sender, status: "received", externalId,
      };
      // Same callback reaches independent workers before either finishes inserting.
      const attempts = await Promise.all(Array.from({ length: 5 }, () => storeInboundSmsOnce(provider, values)));
      const created = attempts.filter(Boolean);
      assert.equal(created.length, 1, `${provider}: only one persisted message`);
      const id = created[0]!.id;
      ids.push(id);
      rulesByMessage.set(id, rules);
      assert.equal(await storeInboundSmsOnce(provider, values), null);
      assert.equal(await emitPersistedInboundEvent(id, "sentiment.negative"), null, "no sentiment before AI save");
      await Promise.all([emitPersistedInboundEvent(id, "sms.received"), emitPersistedInboundEvent(id, "sms.received")]);
      await db.update(communicationMessages).set({
        aiAnalyzed: true, aiSentiment: "negative", aiAnalyzedAt: new Date(),
      }).where(eq(communicationMessages.id, id));
      await Promise.all([
        emitPersistedInboundEvent(id, "sentiment.negative"),
        emitPersistedInboundEvent(id, "sentiment.negative"),
      ]);
      await assertOnePerRule(id, ["sms.received", "sentiment.negative"], rules);
    }

    const rules = await addRules("email", "email.received");
    // A canonical inbox row inspected by both the personal and system mailbox monitors.
    const emailExternalId = `email-regression-${suffix}`;
    const emailAttempts = await Promise.all(Array.from({ length: 4 }, () =>
      storeInboundEmailOnce(emailExternalId, {
      type: "email", direction: "inbound", content: body,
      metadata: JSON.stringify({ from: sender }), status: "received",
      externalId: emailExternalId,
    })));
    assert.equal(emailAttempts.filter(Boolean).length, 1, "personal and system monitors share one inbox row");
    const email = emailAttempts.find(Boolean)!;
    ids.push(email.id);
    rulesByMessage.set(email.id, rules);
    assert.equal(await storeInboundEmailOnce(emailExternalId, {
      type: "email", content: body, status: "received",
    }), null, "repeat mailbox scan cannot create another row");
    await Promise.all([
      emitInboundEmailEvents(email, "customer"), // personal monitor
      emitInboundEmailEvents(email, "customer"), // system monitor
    ]);
    assert.deepEqual((await eventsFor(email.id)).map(e => e.eventType), ["email.received"]);
    await db.update(communicationMessages).set({
      aiAnalyzed: true, aiSentiment: "angry", aiAnalyzedAt: new Date(),
    }).where(eq(communicationMessages.id, email.id));
    // Detail view and monitor can both observe the saved analysis.
    await Promise.all([
      emitPersistedInboundEvent(email.id, "sentiment.negative", "customer"),
      emitInboundEmailEvents({ ...email, aiAnalyzed: true, aiSentiment: "angry" }, "customer", "angry", false),
    ]);
    await emitInboundEmailEvents(email, "customer");
    await assertOnePerRule(email.id, ["email.received", "sentiment.negative"], rules);
    assert.deepEqual(analysisAtDispatch, [true, true, true], "all negative events follow persisted analysis");
  } finally {
    await Promise.allSettled(dispatched);
    if (ruleIds.length) {
      await db.delete(workflowRuns).where(inArray(workflowRuns.ruleId, ruleIds));
      await db.delete(workflowRules).where(inArray(workflowRules.id, ruleIds));
    }
    if (ids.length) {
      await db.delete(workflowEvents).where(inArray(workflowEvents.entityId, ids));
      await db.delete(communicationMessages).where(inArray(communicationMessages.id, ids));
    }
    setEventDispatcher(async () => {});
    await pool.end();
  }
});