import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { callLogs, type WorkflowEvent, type WorkflowRule } from "../../shared/schema";
import { inspectAnalysisSource } from "./automation-analysis-source";
import { scopePredicate, updateRecordTables } from "./automation-update-record";

/**
 * Authorizes operational history only, never grants access to the original record.
 * Unknown/removed sources fail closed. Communication and task policies remain authoritative.
 */
export async function canReadRunSource(rule: WorkflowRule, event: WorkflowEvent, viewer: string) {
  const user = await storage.getUser(viewer);
  if (!user?.isActive) return false;
  if (event.module === "communication") return Boolean(await inspectAnalysisSource(rule, event, viewer));
  if (event.entityType === "task") {
    if (!event.entityId) return false;
    return Boolean(await inspectAnalysisSource(rule, {
      ...event, module: "communication", eventType: "task.body_received",
    }, viewer));
  }
  const admin = ["admin", "superadmin", "owner"].includes(user.role.toLowerCase());
  // Ordinary users cannot browse each other's operational execution details.
  if (!admin && rule.createdByUserId !== viewer) return false;
  if (event.countryCode && !admin && !user.assignedCountries?.includes(event.countryCode)) return false;
  if (!event.entityId) return admin && event.source === "schedule";
  if (["call", "call_log"].includes(event.entityType)) {
    const [call] = await db.select({ userId: callLogs.userId }).from(callLogs)
      .where(eq(callLogs.id, event.entityId)).limit(1);
    return Boolean(call && (admin || call.userId === viewer));
  }
  const table = updateRecordTables[event.entityType];
  if (!table) return false;
  // Only existence/scope is consulted; no record values enter the response.
  const [record] = await db.select({ id: table.id }).from(table).where(and(
    eq(table.id, event.entityId), scopePredicate(event.entityType, table, user),
  )).limit(1);
  return Boolean(record);
}
