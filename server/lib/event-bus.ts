import { db } from "../db";
import { workflowEvents } from "@shared/schema";

type EventInput = {
  source?: "storage" | "webhook" | "cron" | "manual";
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

export async function emitTaskCompleted(taskId: string, task: any, actorUserId?: string | null) {
  return emitEvent({
    module: "task",
    entityType: "task",
    entityId: taskId,
    eventType: "task.completed",
    newValues: task,
    actorUserId,
    countryCode: task?.country || null,
  });
}
