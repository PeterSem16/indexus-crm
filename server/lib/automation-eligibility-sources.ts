import { and, desc, eq, gte, lt, or } from "drizzle-orm";
import { db } from "../db";
import { callRecordings, chatMessages, communicationMessages, taskComments, tasks,
  type WorkflowEvent, type WorkflowRule } from "../../shared/schema";
import { ELIGIBILITY_SOURCE_SCAN_LIMIT, type EligibilitySourceList,
  type EligibilitySourceListInput } from "../../shared/automation-eligibility";
import { inspectAnalysisSource } from "./automation-analysis-source";

/** Local read-only listing: the authoritative resolver checks every candidate as the viewer.
 * Do not filter by the rule author or its channel/mailbox filters: excluded sources are
 * precisely what the diagnostic explains. No events, AI, Graph or actions are invoked.
 */
export async function listEligibilitySources(rule: WorkflowRule, viewerId: string,
  input: EligibilitySourceListInput): Promise<EligibilitySourceList> {
  const { sourceEvent, from, to } = input;
  const table = sourceEvent === "chat.received" ? chatMessages
    : sourceEvent === "task.body_received" ? tasks
    : sourceEvent === "task.message_received" ? taskComments
    : sourceEvent === "voice.transcribed" ? callRecordings : communicationMessages;
  const predicates = [gte(table.createdAt, from), lt(table.createdAt, to)];
  if (table === communicationMessages) predicates.push(
    eq(communicationMessages.direction, "inbound"),
    eq(communicationMessages.type, sourceEvent === "email.received" ? "email" : "sms"));
  // Prefilter private conversations before applying the bounded scan, even for admins.
  if (table === chatMessages) predicates.push(or(eq(chatMessages.senderId, viewerId),
    eq(chatMessages.receiverId, viewerId))!);
  if (table === callRecordings) predicates.push(eq(callRecordings.analysisStatus, "completed"));
  const candidates = await db.select({ id: table.id, createdAt: table.createdAt }).from(table)
    .where(and(...predicates)).orderBy(desc(table.createdAt), desc(table.id)).limit(ELIGIBILITY_SOURCE_SCAN_LIMIT);
  const records: EligibilitySourceList["records"] = [];
  // Sequential, bounded inspection avoids flooding the DB/SMS audience policy.
  for (const candidate of candidates) {
    const probe = { module: "communication", eventType: sourceEvent, entityId: candidate.id } as WorkflowEvent;
    if (await inspectAnalysisSource(rule, probe, viewerId))
      records.push({ id: candidate.id, createdAt: candidate.createdAt.toISOString() });
  }
  return { records };
}
