import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { pgSchema, text, boolean, timestamp } from "drizzle-orm/pg-core";
import type { Client } from "pg";
import { emailMonitoringFields, emailMonitoringMetadata, type EmailMonitoringAnalysis } from "../../server/lib/ai/email-monitoring-contract";

const temporary = pgSchema("pg_temp").table("indexus_email_monitoring_b1", {
  id: text("id").primaryKey(), metadata: text("metadata"),
  aiAnalyzed: boolean("ai_analyzed"), aiSentiment: text("ai_sentiment"),
  aiAlertLevel: text("ai_alert_level"), aiHasAngryTone: boolean("ai_has_angry_tone"),
  aiHasRudeExpressions: boolean("ai_has_rude_expressions"), aiWantsToCancel: boolean("ai_wants_to_cancel"),
  aiWantsConsent: boolean("ai_wants_consent"), aiDoesNotAcceptContract: boolean("ai_does_not_accept_contract"),
  aiAnalysisNote: text("ai_analysis_note"), aiAnalyzedAt: timestamp("ai_analyzed_at"),
});
/** Session-local test table only; never touches communication_messages or contacts. */
export async function createTestTable(client: Client) {
  await client.query(`CREATE TEMP TABLE indexus_email_monitoring_b1 (
    id text PRIMARY KEY, metadata text, ai_analyzed boolean, ai_sentiment text, ai_alert_level text,
    ai_has_angry_tone boolean, ai_has_rude_expressions boolean, ai_wants_to_cancel boolean,
    ai_wants_consent boolean, ai_does_not_accept_contract boolean, ai_analysis_note text,
    ai_analyzed_at timestamp) ON COMMIT DROP`);
}
export async function verifyPersistence(client: Client, id: string, analysis: EmailMonitoringAnalysis) {
  const db = drizzle(client);
  const original = { contactType: "customer", mailboxSource: { kind: "system", countryCode: "SK" },
    concurrentUnrelatedValue: "SYNTHETIC_PRESERVED" };
  const now = new Date("2026-11-16T12:00:00Z");
  await db.insert(temporary).values({ id, metadata: JSON.stringify(original), aiAnalyzed: false });
  const [saved] = await db.update(temporary).set({
    ...emailMonitoringFields(analysis, now), metadata: emailMonitoringMetadata(temporary.metadata, analysis),
  }).where(eq(temporary.id, id)).returning();
  assert.equal(saved.aiAnalyzed, true);
  for (const [key, value] of Object.entries(emailMonitoringFields(analysis, now)))
    assert.deepEqual(saved[key as keyof typeof saved], value);
  assert.deepEqual(JSON.parse(saved.metadata!), { ...original, emailMonitoringAnalysis: analysis });
  // Also verify the personal-mailbox insert representation, using the same production field mapper.
  const [inserted] = await db.insert(temporary).values({
    id: id + "-personal", ...emailMonitoringFields(analysis, now),
    metadata: JSON.stringify({ ...original, mailboxSource: { kind: "personal" }, emailMonitoringAnalysis: analysis }),
  }).returning();
  assert.equal(inserted.aiWantsConsent, analysis.wantsConsent);
  assert.deepEqual(JSON.parse(inserted.metadata!).emailMonitoringAnalysis, analysis);
  return { state: "VERIFIED_TEMP_TABLE_ONLY", personalInsert: true, systemUpdate: true,
    nineFieldSnapshot: true, mailboxMetadataPreserved: true };
}
