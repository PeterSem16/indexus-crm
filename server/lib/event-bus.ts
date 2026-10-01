import { db } from "../db";
import { isPulseOriginTask } from "./task-contract";
import { customers, tasks, workflowEvents } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { taskTextContentIdentity } from "./task-text-identity";

type EventInput = {
  source?: "storage" | "webhook" | "cron" | "manual" | "inbound-call" | "task-analysis";
  module: string;
  entityType: string;
  entityId?: string | null;
  eventType: string;
  oldValues?: any;
  newValues?: any;
  actorUserId?: string | null;
  countryCode?: string | null;
  causationRunId?: string | null;
};

let dispatcher: ((eventId: string) => Promise<void>) | null = null;

export function setEventDispatcher(fn: (eventId: string) => Promise<void>) {
  dispatcher = fn;
}

function diffChangedFields(oldV: any, newV: any): string[] {
  if (!oldV || !newV || typeof oldV !== "object" || typeof newV !== "object") return [];
  const fields = new Set<string>();
  for (const k of Object.keys(newV)) {
    const a = (oldV as any)[k];
    const b = (newV as any)[k];
    const same = a === b || (a instanceof Date && b instanceof Date && a.getTime() === b.getTime()) || JSON.stringify(a) === JSON.stringify(b);
    if (!same) fields.add(k);
  }
  return Array.from(fields);
}

export async function emitEvent(input: EventInput): Promise<string | null> {
  try {
    const changedFields = diffChangedFields(input.oldValues, input.newValues);
    const [row] = await db
      .insert(workflowEvents)
      .values({
        source: input.source || "storage",
        module: input.module,
        entityType: input.entityType,
        entityId: input.entityId || null,
        eventType: input.eventType,
        oldValues: input.oldValues ?? null,
        newValues: input.newValues ?? null,
        changedFields: changedFields.length ? changedFields : null,
        actorUserId: input.actorUserId || null,
        countryCode: input.countryCode || null,
        causationRunId: input.causationRunId || null,
      })
      .returning({ id: workflowEvents.id });
    if (!row) return null;
    if (dispatcher) {
      // Fire-and-forget — engine handles its own errors
      dispatcher(row.id).catch((err) => {
        console.error("[EventBus] dispatcher error:", err);
      });
    }
    return row.id;
  } catch (err) {
    console.error("[EventBus] emit failed:", err);
    return null;
  }
}

/**
 * Insert once for an event identity stored in newValues. Unlike emitEventOnce,
 * this permits multiple distinct identities for the same entity/event pair.
 */
export async function emitEventOnceForIdentity(
  input: EventInput,
  identityField: string,
  identityValue: string,
  dedupeKey: string,
  taskTextGuard?: { taskId: string; textIdentity: string },
): Promise<string | null> {
  try {
    const changedFields = diffChangedFields(input.oldValues, input.newValues);
    const [row] = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${dedupeKey}, 0))`);
      if (taskTextGuard) {
        // Hold a row share lock through event insertion so task edits/deletes
        // cannot race between the current-text check and the event commit.
        const [currentTask] = await tx.select({ title: tasks.title, description: tasks.description })
          .from(tasks)
          .where(eq(tasks.id, taskTextGuard.taskId))
          .for("share");
        if (!currentTask || taskTextContentIdentity(currentTask.title, currentTask.description) !== taskTextGuard.textIdentity) {
          return [];
        }
      }
      const priorEvents = await tx.select({ newValues: workflowEvents.newValues })
        .from(workflowEvents)
        .where(and(
          eq(workflowEvents.source, input.source || "storage"),
          eq(workflowEvents.module, input.module),
          eq(workflowEvents.entityType, input.entityType),
          eq(workflowEvents.entityId, input.entityId || ""),
          eq(workflowEvents.eventType, input.eventType),
        ));
      if (priorEvents.some((event) => (event.newValues as any)?.[identityField] === identityValue)) return [];
      return tx.insert(workflowEvents).values({
        source: input.source || "storage",
        module: input.module,
        entityType: input.entityType,
        entityId: input.entityId || null,
        eventType: input.eventType,
        oldValues: input.oldValues ?? null,
        newValues: input.newValues ?? null,
        changedFields: changedFields.length ? changedFields : null,
        actorUserId: input.actorUserId || null,
        countryCode: input.countryCode || null,
        causationRunId: input.causationRunId || null,
      }).returning({ id: workflowEvents.id });
    });
    if (!row) return null;
    if (dispatcher) {
      dispatcher(row.id).catch(() => {
        console.error("[EventBus] dispatcher error for identity event");
      });
    }
    return row.id;
  } catch {
    console.error("[EventBus] identity event emit failed");
    return null;
  }
}

/** Convenience helpers used by routes. Safe-guarded so they never throw. */
export async function emitEntityCreated(
  module: string,
  entityType: string,
  entityId: string,
  newValues: any,
  actorUserId?: string | null,
  countryCode?: string | null
) {
  return emitEvent({ module, entityType, entityId, eventType: "created", newValues, actorUserId, countryCode });
}

export async function emitEntityUpdated(
  module: string,
  entityType: string,
  entityId: string,
  oldValues: any,
  newValues: any,
  actorUserId?: string | null,
  countryCode?: string | null
) {
  await emitEvent({ module, entityType, entityId, eventType: "updated", oldValues, newValues, actorUserId, countryCode });
  // Status change is its own event for easier matching
  if (oldValues && newValues && oldValues.status !== newValues.status) {
    await emitEvent({
      module,
      entityType,
      entityId,
      eventType: "status_changed",
      oldValues: { status: oldValues.status },
      newValues: { status: newValues.status, ...newValues },
      actorUserId,
      countryCode,
    });
  }
}


export function safeTaskEventValues(task: any) {
  const title = typeof task.title === "string"
    ? task.title
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
      .replace(/\+?\d[\d\s().-]{4,}\d/g, "[redacted]")
    : task.title;
  return {
    id: task.id, title, dueDate: task.dueDate, priority: task.priority, status: task.status,
    assignedUserId: task.assignedUserId, assignedDepartmentId: task.assignedDepartmentId,
    createdByUserId: task.createdByUserId, customerId: task.customerId,
    relatedEntityType: task.relatedEntityType, relatedEntityId: task.relatedEntityId,
    resolvedByUserId: task.resolvedByUserId, resolvedAt: task.resolvedAt,
  };
}

export function taskCompletionEventValues(
  task: any,
  options: { creatorNotificationHandled?: boolean } = {},
) {
  return {
    ...task,
    pulseOrigin: isPulseOriginTask(task),
    creatorNotificationHandled: options.creatorNotificationHandled === true,
  };
}

export async function emitTaskCompleted(
  taskId: string,
  task: any,
  actorUserId?: string | null,
  options: { creatorNotificationHandled?: boolean } = {},
) {
  return emitEvent({
    module: "task",
    entityType: "task",
    entityId: taskId,
    eventType: "task.completed",
    newValues: taskCompletionEventValues(task, options),
    actorUserId,
    countryCode: task?.country || null,
  });
}

/** Emit assignment only when a task is newly assigned or its owner changes. */
export async function emitTaskAssigned(task: any, oldTask?: any, actorUserId?: string | null) {
  if (!task?.id || !task.assignedUserId) return null;
  if (oldTask && oldTask.assignedUserId === task.assignedUserId) return null;
  let verifiedCountry: string | null = null;
  if (task.customerId) {
    const [customer] = await db.select({ country: customers.country })
      .from(customers)
      .where(eq(customers.id, task.customerId))
      .limit(1);
    verifiedCountry = customer?.country || null;
  }
  return emitEvent({
    module: "task", entityType: "task", entityId: task.id, eventType: "task.assigned",
    oldValues: oldTask ? safeTaskEventValues(oldTask) : null,
    newValues: safeTaskEventValues(task), actorUserId, countryCode: verifiedCountry,
  });
}
