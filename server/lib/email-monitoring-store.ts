import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { emailMetadata } from "../../shared/schema";
import { createEmailMonitoringRecorder, monitoringScope, monitoringSnapshot, readMonitoringSnapshot,
  type EmailMonitoringScope } from "./email-monitoring-record";
import type { EmailMonitoringAnalysis } from "./ai/email-monitoring-contract";

function whereScope(scope: EmailMonitoringScope) {
  return and(eq(emailMetadata.messageId, scope.externalId),
    sql`lower(${emailMetadata.mailboxEmail}) = ${scope.mailbox}`);
}
export async function loadStoredEmailMonitoring(rawScope: EmailMonitoringScope) {
  const scope = monitoringScope(rawScope);
  const rows = await db.select({ result: emailMetadata.emailMonitoringResult }).from(emailMetadata)
    .where(whereScope(scope)).limit(2);
  if (rows.length > 1) throw Error("email_monitoring_metadata_ambiguous");
  return readMonitoringSnapshot(rows[0]?.result, scope);
}
export async function saveStoredEmailMonitoring(rawScope: EmailMonitoringScope, analysis: EmailMonitoringAnalysis) {
  const scope = monitoringScope(rawScope), snapshot = monitoringSnapshot(scope, analysis);
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(
      ${JSON.stringify(["email-monitoring", scope.mailbox, scope.externalId])}, 0))`);
    const rows = await tx.select({ id: emailMetadata.id, result: emailMetadata.emailMonitoringResult })
      .from(emailMetadata).where(whereScope(scope)).limit(2).for("update");
    if (rows.length > 1) throw Error("email_monitoring_metadata_ambiguous");
    const existing = readMonitoringSnapshot(rows[0]?.result, scope);
    if (existing) return { detail: existing, created: false };
    if (rows[0]?.result != null) throw Error("email_monitoring_metadata_owner_conflict");
    // Only the new namespaced result is updated. Legacy sentiment, tags, contact
    // identity and pipeline fields remain untouched, even on an unlinked row.
    const written = rows.length
      ? await tx.update(emailMetadata).set({ emailMonitoringResult: snapshot })
        .where(eq(emailMetadata.id, rows[0].id)).returning({ result: emailMetadata.emailMonitoringResult })
      : await tx.insert(emailMetadata).values({ messageId: scope.externalId, mailboxEmail: scope.mailbox,
        emailMonitoringResult: snapshot }).returning({ result: emailMetadata.emailMonitoringResult });
    if (written.length !== 1) throw Error("email_monitoring_save_failed");
    const detail = readMonitoringSnapshot(written[0].result, scope);
    if (!detail) throw Error("email_monitoring_save_scope_mismatch");
    return { detail, created: true };
  });
}
export const emailMonitoringRecorder = createEmailMonitoringRecorder({
  read: loadStoredEmailMonitoring, save: saveStoredEmailMonitoring,
});
