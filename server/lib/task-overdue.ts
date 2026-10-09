import { and, desc, eq, inArray, lte, or, sql } from "drizzle-orm";
import { tasks, workflowEvents, workflowRules } from "@shared/schema";
import { getTaskDeadlineTimestamp, isTaskOverdue } from "@shared/task-deadline";
import { db } from "../db";
import { dispatchCommittedEvent, taskEventCountry, taskEventValuesWithRouting } from "./event-bus";
import { matchesRuleCountryScope } from "./automation-capabilities";

const OPEN_STATUSES = ["pending", "in_progress"];

/** A deadline edit or a terminal→open transition starts a new overdue occurrence. */
function rearmsOverdue(event: any): boolean {
  if (event.eventType === "status_changed") {
    return ["completed", "cancelled"].includes(event.oldValues?.status) &&
      OPEN_STATUSES.includes(event.newValues?.status);
  }
  return getTaskDeadlineTimestamp(event.oldValues?.dueDate) !== getTaskDeadlineTimestamp(event.newValues?.dueDate);
}

export async function emitOverdueTask(taskId: string, now = new Date(), database: any = db): Promise<string | null> {
  const eventId = await database.transaction(async (tx: any) => {
    // Serialize replicas/ticks and lock the current task against edits until insertion commits.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`task-overdue:${taskId}`}, 0))`);
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, taskId)).for("share");
    if (!task || !OPEN_STATUSES.includes(task.status) || !isTaskOverdue(task.status, task.dueDate, now.getTime())) return null;
    const deadline = getTaskDeadlineTimestamp(task.dueDate)!;
    const history = await tx.select().from(workflowEvents).where(and(
      eq(workflowEvents.module, "task"), eq(workflowEvents.entityType, "task"),
      eq(workflowEvents.entityId, taskId),
      or(eq(workflowEvents.eventType, "task.overdue"),
        eq(workflowEvents.eventType, "status_changed"),
        and(eq(workflowEvents.eventType, "updated"), sql`${workflowEvents.changedFields} @> ARRAY['dueDate']::text[]`)),
    )).orderBy(desc(workflowEvents.createdAt), desc(workflowEvents.id));
    const rearm = history.find((event: any) => event.eventType !== "task.overdue" && rearmsOverdue(event));
    const overdueIdentity = `${new Date(deadline).toISOString()}:${rearm?.id || "initial"}`;
    const country = await taskEventCountry(task, undefined, tx);
    const alreadyEmitted = history.some((event: any) => {
      if (event.eventType !== "task.overdue") return false;
      if (event.newValues?.overdueIdentity === overdueIdentity && event.countryCode === country) return true;
      // Preserve valid legacy deliveries. Premature or unscoped legacy events cannot suppress recovery.
      return !event.newValues?.overdueIdentity &&
        getTaskDeadlineTimestamp(event.newValues?.dueDate) === deadline &&
        event.createdAt.getTime() >= deadline &&
        (!rearm || event.createdAt.getTime() >= rearm.createdAt.getTime()) &&
        event.countryCode === country;
    });
    if (alreadyEmitted) return null;
    // Repair a bad historical event only for rules that existed when the deadline
    // actually passed. A newly created WHEN rule must not retroactively email every
    // previously overdue task.
    const prematureLegacy = history.some((event: any) => event.eventType === "task.overdue" &&
      !event.newValues?.overdueIdentity &&
      getTaskDeadlineTimestamp(event.newValues?.dueDate) === deadline &&
      (event.createdAt.getTime() < deadline || event.countryCode !== country));
    if (prematureLegacy) {
      const eligible = await tx.select({
        trigger: workflowRules.trigger, countryCode: workflowRules.countryCode,
        countryCodes: workflowRules.countryCodes,
      }).from(workflowRules).where(and(eq(workflowRules.enabled, true),
        eq(workflowRules.module, "task"), lte(workflowRules.createdAt, new Date(deadline))));
      if (!eligible.some((rule: any) => {
        const trigger = rule.trigger || {};
        return trigger.type === "event" && trigger.eventType === "task.overdue" &&
          (!trigger.entityType || trigger.entityType === "task") &&
          matchesRuleCountryScope(rule.countryCodes, rule.countryCode, country);
      })) return null;
    }
    const [event] = await tx.insert(workflowEvents).values({
      source: "cron", module: "task", entityType: "task", entityId: taskId,
      eventType: "task.overdue", countryCode: country, actorUserId: null,
      newValues: await taskEventValuesWithRouting({ ...task, overdueIdentity,
        overdueDeadlineAt: new Date(deadline).toISOString() }, tx),
      createdAt: now,
    }).returning({ id: workflowEvents.id });
    return event.id;
  });
  if (eventId) dispatchCommittedEvent(eventId);
  return eventId;
}

let activeScan: Promise<void> | null = null;
export function emitTaskOverdueEvents(): Promise<void> {
  if (activeScan) return activeScan;
  activeScan = (async () => {
    const now = new Date();
    // Coarse indexed candidate filter only; the shared calendar policy decides actual expiry.
    const candidates = await db.select({ id: tasks.id, dueDate: tasks.dueDate }).from(tasks)
      .where(and(inArray(tasks.status, OPEN_STATUSES), lte(tasks.dueDate, now)));
    for (const task of candidates) {
      if (!isTaskOverdue("pending", task.dueDate, now.getTime())) continue;
      try { await emitOverdueTask(task.id, now); }
      catch { console.error("[AutomationCron] task overdue emission failed; next tick will retry"); }
    }
  })().catch(() => {
    console.error("[AutomationCron] task overdue scan failed; next tick will retry");
  }).finally(() => { activeScan = null; });
  return activeScan;
}
