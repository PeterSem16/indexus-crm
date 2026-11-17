import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { emailMetadata, emailMonitoringOwnerResults } from "../../shared/schema";
import { createEmailMonitoringRecorder, monitoringScope, monitoringSnapshot, monitoringOwnerKey, readMonitoringSnapshot,
  type EmailMonitoringScope } from "./email-monitoring-record";
import type { EmailMonitoringAnalysis } from "./ai/email-monitoring-contract";

function whereScope(scope: EmailMonitoringScope) {
  return and(eq(emailMetadata.messageId, scope.externalId),
    sql`lower(${emailMetadata.mailboxEmail}) = ${scope.mailbox}`);
}
function whereOwner(scope: EmailMonitoringScope) {
  return and(eq(emailMonitoringOwnerResults.messageId, scope.externalId),
    eq(emailMonitoringOwnerResults.mailboxEmail, scope.mailbox),
    eq(emailMonitoringOwnerResults.ownerKey, monitoringOwnerKey(scope)));
}
function ownedDetail(rows: { result: unknown }[], scope: EmailMonitoringScope) {
  if (rows.length > 1) throw Error("email_monitoring_metadata_ambiguous");
  if (!rows.length) return null;
  const detail = readMonitoringSnapshot(rows[0].result, scope);
  if (!detail) throw Error("email_monitoring_save_scope_mismatch");
  return detail;
}
export async function loadStoredEmailMonitoring(rawScope: EmailMonitoringScope) {
  const scope = monitoringScope(rawScope);
  const owned = await db.select({ result: emailMonitoringOwnerResults.result }).from(emailMonitoringOwnerResults)
    .where(whereOwner(scope)).limit(2);
  const detail = ownedDetail(owned, scope);
  if (detail) return detail;
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
    const owned = await tx.select({ result: emailMonitoringOwnerResults.result }).from(emailMonitoringOwnerResults)
      .where(whereOwner(scope)).limit(2).for("update");
    const ownedResult = ownedDetail(owned, scope);
    if (ownedResult) return { detail: ownedResult, created: false };
    const rows = await tx.select({ id: emailMetadata.id, result: emailMetadata.emailMonitoringResult })
      .from(emailMetadata).where(whereScope(scope)).limit(2).for("update");
    if (rows.length > 1) throw Error("email_monitoring_metadata_ambiguous");
    const existing = readMonitoringSnapshot(rows[0]?.result, scope);
    if (existing) return { detail: existing, created: false };
    // A foreign legacy result is NOT reused, copied or overwritten. This owner
    // gets the answer from their own analysis in a separate unique namespace.
    // Keeping the legacy representation untouched also permits code rollback.
    const written = await tx.insert(emailMonitoringOwnerResults).values({
      messageId: scope.externalId, mailboxEmail: scope.mailbox, ownerKey: monitoringOwnerKey(scope),
      ownerUserId: scope.ownerUserId, result: snapshot,
    }).returning({ result: emailMonitoringOwnerResults.result });
    if (written.length !== 1) throw Error("email_monitoring_save_failed");
    const detail = readMonitoringSnapshot(written[0].result, scope);
    if (!detail) throw Error("email_monitoring_save_scope_mismatch");
    return { detail, created: true };
  });
}
export const emailMonitoringRecorder = createEmailMonitoringRecorder({
  read: loadStoredEmailMonitoring, save: saveStoredEmailMonitoring,
});
