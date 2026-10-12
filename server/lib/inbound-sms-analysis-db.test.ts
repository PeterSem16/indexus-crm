import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { communicationMessages } from "../../shared/schema";
import { storeInboundSmsOnce } from "./inbound-sms";
import { analyzePersistedInboundSms } from "./inbound-sms-analysis";

// Development-only synthetic data; no AI, provider requests or real notifications.
const prefix = `sms-analysis-test-${randomUUID()}`;
const ids: string[] = [];
try {
  for (const provider of ["bulkgate", "smstools"] as const) {
    const message = await storeInboundSmsOnce(provider, {
      type: "sms", content: "synthetic fixture", externalId: `${prefix}:${provider}`,
      senderPhone: "+421000000001", countryCode: "SK", status: "received",
    });
    assert(message);
    ids.push(message.id);
    assert.equal(await analyzePersistedInboundSms(message.id, {
      load: async id => {
        const [row] = await db.select().from(communicationMessages).where(eq(communicationMessages.id, id)).limit(1);
        return row;
      },
      analyze: async () => ({
        sentiment: "angry", alertLevel: "warning", note: "synthetic analysis",
        hasInappropriateContent: false, hasAngryTone: true, hasRudeExpressions: true,
        wantsToCancel: true, wantsConsent: false, doesNotAcceptContract: true,
      }),
      persist: async (id, patch) => {
        const [row] = await db.update(communicationMessages).set(patch).where(eq(communicationMessages.id, id)).returning();
        return row;
      },
      received: async () => {},
      negative: async id => {
        const [row] = await db.select().from(communicationMessages).where(eq(communicationMessages.id, id)).limit(1);
        assert.equal(row.aiAnalyzed, true, "notification sees committed analysis");
        assert.equal(row.aiHasAngryTone, true);
      },
    }), "analyzed");
    const [row] = await db.select().from(communicationMessages).where(eq(communicationMessages.id, message.id)).limit(1);
    assert.equal(row.provider, provider);
    assert.equal(row.direction, "inbound");
    assert.equal(row.status, "received");
    assert.equal(row.aiWantsToCancel, true);
    assert.equal(row.aiHasRudeExpressions, true);
    assert.equal(row.aiDoesNotAcceptContract, true);
    assert.equal(row.campaignId, null);
    assert.equal(await storeInboundSmsOnce(provider, {
      type: "sms", content: "duplicate fixture", externalId: `${prefix}:${provider}`, status: "received",
    }), null);
  }
  console.log("Both gateways: real PostgreSQL persistence, analysis flags, unchanged attribution and callback dedup PASSED");
} finally {
  for (const id of ids) await db.delete(communicationMessages).where(eq(communicationMessages.id, id));
  await pool.end();
}
