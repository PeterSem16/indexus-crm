import type { Express, RequestHandler } from "express";

export type TaskSourceEntityType = "customer" | "clinic" | "hospital" | "collaborator";

export type TaskSourceEntity = {
  type: TaskSourceEntityType;
  id: string;
};

export type TaskSourceEntityCountry = string | readonly string[] | null | undefined;

export type TaskSourceTask = {
  id: string;
  country?: string | null;
  tags?: string[] | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  customerId?: string | null;
  createdByUserId?: string | null;
  createdAt: Date | string | null;
};

export type LegacyTaskSourceConfirmation = {
  statusListItemId: string;
  confirmedByUserId: string;
  confirmedAt: Date | string;
  contactType: string | null;
  customerId?: string | null;
  clinicId?: string | null;
  hospitalId?: string | null;
  collaboratorId?: string | null;
};

export type TaskSourceEntityDependencies = {
  getTask: (id: string) => Promise<TaskSourceTask | null | undefined>;
  canAccessTask?: (user: any, taskId: string) => Promise<boolean>;
  findLegacyConfirmations: (
    statusListItemId: string,
    confirmedByUserId: string,
    taskCreatedAt: Date,
  ) => Promise<LegacyTaskSourceConfirmation[]>;
  entityExists: (type: TaskSourceEntityType, id: string) => Promise<boolean>;
  getEntityCountry?: (type: TaskSourceEntityType, id: string) => Promise<TaskSourceEntityCountry>;
  getEntityDisplayName?: (type: TaskSourceEntityType, id: string) => Promise<string | null | undefined>;
};

const SUPPORTED_ENTITY_TYPES = new Set<TaskSourceEntityType>([
  "customer",
  "clinic",
  "hospital",
  "collaborator",
]);
const LEGACY_CONFIRMATION_WINDOW_MS = 300_000;

function isSupportedEntityType(value: unknown): value is TaskSourceEntityType {
  return typeof value === "string" && SUPPORTED_ENTITY_TYPES.has(value as TaskSourceEntityType);
}

function makeEntity(type: unknown, id: unknown): TaskSourceEntity | null {
  if (!isSupportedEntityType(type) || typeof id !== "string" || id.length === 0) return null;
  return { type, id };
}

function sourceEntitiesFromTags(tags: string[] | null | undefined): {
  found: boolean;
  ambiguous: boolean;
  entity: TaskSourceEntity | null;
} {
  const entities = new Map<string, TaskSourceEntity>();
  for (const tag of tags ?? []) {
    const match = /^source_entity:(customer|clinic|hospital|collaborator):([^:]+)$/.exec(tag);
    if (!match) continue;
    const entity = makeEntity(match[1], match[2]);
    if (entity) entities.set(`${entity.type}:${entity.id}`, entity);
  }
  if (entities.size > 1) return { found: true, ambiguous: true, entity: null };
  return {
    found: entities.size === 1,
    ambiguous: false,
    entity: entities.values().next().value ?? null,
  };
}

function legacyConfirmationEntity(
  confirmation: LegacyTaskSourceConfirmation,
): TaskSourceEntity | null {
  const type = confirmation.contactType;
  const id = type === "customer" ? confirmation.customerId
    : type === "clinic" ? confirmation.clinicId
    : type === "hospital" ? confirmation.hospitalId
    : type === "collaborator" ? confirmation.collaboratorId
    : null;
  return makeEntity(type, id);
}

function validDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const parsed = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function findLegacySource(
  task: TaskSourceTask,
  confirmations: LegacyTaskSourceConfirmation[],
): { ambiguous: boolean; entity: TaskSourceEntity | null } {
  const taskCreatedAt = validDate(task.createdAt)?.getTime();
  if (!task.relatedEntityId || !task.createdByUserId || taskCreatedAt == null) {
    return { ambiguous: false, entity: null };
  }

  const entities = new Map<string, TaskSourceEntity>();
  for (const confirmation of confirmations) {
    if (confirmation.statusListItemId !== task.relatedEntityId
      || confirmation.confirmedByUserId !== task.createdByUserId) continue;
    const confirmedAt = validDate(confirmation.confirmedAt)?.getTime();
    if (confirmedAt == null || Math.abs(confirmedAt - taskCreatedAt) > LEGACY_CONFIRMATION_WINDOW_MS) continue;
    const entity = legacyConfirmationEntity(confirmation);
    if (entity) entities.set(`${entity.type}:${entity.id}`, entity);
  }
  if (entities.size > 1) return { ambiguous: true, entity: null };
  return { ambiguous: false, entity: entities.values().next().value ?? null };
}

/**
 * Resolve only explicit and still-existing source links. Legacy Status List
 * confirmations are accepted only within five minutes of task creation and
 * only when they identify one distinct contact.
 */
export async function resolveTaskSourceEntity(
  task: TaskSourceTask,
  dependencies: Pick<TaskSourceEntityDependencies, "findLegacyConfirmations" | "entityExists">,
): Promise<TaskSourceEntity | null> {
  const tagged = sourceEntitiesFromTags(task.tags);
  if (tagged.ambiguous) return null;
  if (tagged.found && tagged.entity) {
    return await dependencies.entityExists(tagged.entity.type, tagged.entity.id) ? tagged.entity : null;
  }

  const relatedEntity = makeEntity(task.relatedEntityType, task.relatedEntityId);
  if (relatedEntity) {
    return await dependencies.entityExists(relatedEntity.type, relatedEntity.id) ? relatedEntity : null;
  }

  if (task.relatedEntityType === "status_list_item" && task.relatedEntityId) {
    const taskCreatedAt = validDate(task.createdAt);
    if (!taskCreatedAt || !task.createdByUserId) {
      const customer = makeEntity("customer", task.customerId);
      if (!customer) return null;
      return await dependencies.entityExists(customer.type, customer.id) ? customer : null;
    }
    const confirmations = await dependencies.findLegacyConfirmations(
      task.relatedEntityId,
      task.createdByUserId,
      taskCreatedAt,
    );
    const legacy = findLegacySource(task, confirmations);
    if (legacy.ambiguous) return null;
    if (legacy.entity) {
      return await dependencies.entityExists(legacy.entity.type, legacy.entity.id) ? legacy.entity : null;
    }
  }

  const customer = makeEntity("customer", task.customerId);
  if (!customer) return null;
  return await dependencies.entityExists(customer.type, customer.id) ? customer : null;
}

/**
 * Resolve a display name only after the shared source resolver has verified the
 * entity and its persisted country matches the task. Invalid, ambiguous,
 * deleted, cross-country, or unnamed sources intentionally return null so
 * callers can retain the task's own title.
 */
export async function resolveTaskSourceEntityDisplayName(
  task: TaskSourceTask,
  dependencies: Pick<TaskSourceEntityDependencies, "findLegacyConfirmations" | "entityExists" | "getEntityCountry" | "getEntityDisplayName">,
): Promise<string | null> {
  if (!dependencies.getEntityDisplayName || !dependencies.getEntityCountry || !task.country?.trim()) return null;
  const entity = await resolveTaskSourceEntity(task, dependencies);
  if (!entity) return null;
  const taskCountry = task.country.trim().toUpperCase();
  const entityCountry = await dependencies.getEntityCountry(entity.type, entity.id);
  const entityCountries = Array.isArray(entityCountry) ? entityCountry : [entityCountry];
  if (!entityCountries.some(country => typeof country === "string" && country.trim().toUpperCase() === taskCountry)) {
    return null;
  }
  const name = await dependencies.getEntityDisplayName(entity.type, entity.id);
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

/** Resolve a source label for a caller only after the task access check passes. */
export async function resolveAccessibleTaskSourceEntityDisplayName(
  user: unknown,
  taskId: string,
  dependencies: TaskSourceEntityDependencies,
): Promise<string | null> {
  if (!dependencies.canAccessTask) return null;
  const task = await dependencies.getTask(taskId);
  if (!task || !await dependencies.canAccessTask(user, taskId)) return null;
  return resolveTaskSourceEntityDisplayName(task, dependencies);
}

/**
 * Return the task ID only for completion notices still using their task title.
 * Do not depend on metadata.source: Pulse also displays ordinary Back Office
 * task completions. The source resolver and access check remain authoritative.
 */
export function getTaskCompletionNoticeSourceLookupId(notification: {
  type?: unknown;
  entityType?: unknown;
  entityId?: unknown;
  title?: unknown;
  metadata?: unknown;
}): string | null {
  if (notification.type !== "back_office_resolved") return null;
  if (typeof notification.entityType !== "string" || notification.entityType.toLowerCase() !== "task") return null;
  if (!notification.metadata || typeof notification.metadata !== "object") return null;

  const metadata = notification.metadata as Record<string, unknown>;
  if (typeof metadata.taskTitle !== "string" || notification.title !== metadata.taskTitle) return null;
  const taskId = typeof metadata.taskId === "string" ? metadata.taskId : notification.entityId;
  return typeof taskId === "string" && taskId.trim() ? taskId : null;
}

export function registerTaskSourceEntityRoute(
  app: Express,
  requireAuth: RequestHandler,
  dependencies: TaskSourceEntityDependencies,
): void {
  app.get("/api/tasks/:id/source-entity", requireAuth, async (req, res) => {
    try {
      const task = await dependencies.getTask(req.params.id);
      if (!task) return res.status(404).json({ error: "Task not found" });
      if (dependencies.canAccessTask && !await dependencies.canAccessTask((req as any).session?.user, req.params.id)) {
        return res.status(404).json({ error: "Task not found" });
      }
      const entity = await resolveTaskSourceEntity(task, dependencies);
      return res.json(entity);
    } catch (error) {
      console.error("Failed to resolve task source card:", error);
      return res.status(500).json({ error: "Failed to resolve task source card" });
    }
  });
}