import { MANUAL_PULSE_TASK_TAG } from "@shared/task-provenance";

export const TASK_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export interface TaskContractRow {
  tags?: string[] | null;
  relatedEntityType?: string | null;
  createdByUserId?: string | null;
}

export interface PulseCompletionTaskRow extends TaskContractRow {
  id: string;
  title: string;
  resolution?: string | null;
}

export interface TaskAccessUser {
  id: string;
  role?: string;
  assignedCountries?: readonly string[] | null;
}

export interface TaskAccessRow extends TaskContractRow {
  country?: string | null;
  assignedUserId?: string | null;
  createdByUserId?: string | null;
}

export function userMayAccessTaskCountry(
  role: string | undefined,
  assignedCountries: readonly string[] | null | undefined,
  taskCountry: string | null | undefined,
): boolean {
  if (role === "admin" || !taskCountry) return true;
  const normalizedCountry = taskCountry.trim().toUpperCase();
  return Array.isArray(assignedCountries)
    && assignedCountries.some(country => country.trim().toUpperCase() === normalizedCountry);
}

export function canAccessTaskByPolicy(
  user: TaskAccessUser,
  task: TaskAccessRow,
  groupIds: ReadonlySet<string> = new Set<string>(),
): boolean {
  if (user.role === "admin") return true;
  if (!userMayAccessTaskCountry(user.role, user.assignedCountries, task.country)) return false;
  if (user.role === "manager") return true;
  if (task.assignedUserId === user.id || task.createdByUserId === user.id) return true;
  const groupId = (task.tags || []).find(tag => tag.startsWith("group_id:"))?.slice("group_id:".length);
  return !!groupId && groupIds.has(groupId);
}

export function taskPeopleCandidateAllowed(
  role: string | undefined,
  viewerCountries: readonly string[] | null | undefined,
  candidateCountries: readonly string[] | null | undefined,
): boolean {
  if (role === "admin") return true;
  const allowed = Array.isArray(viewerCountries) ? viewerCountries : [];
  const candidate = Array.isArray(candidateCountries) ? candidateCountries : [];
  return candidate.some(country => allowed.some(
    code => code.trim().toUpperCase() === country.trim().toUpperCase(),
  ));
}

export function taskPeoplePersonVisible(isActive: boolean, isParticipant: boolean): boolean {
  return isActive || isParticipant;
}

export function collectTaskParticipantIds(
  tasks: readonly { createdByUserId?: string | null; assignedUserId?: string | null; resolvedByUserId?: string | null }[],
  groupMemberIds: readonly string[] = [],
): string[] {
  const participantIds = new Set<string>();
  const add = (id: string | null | undefined) => {
    if (id) participantIds.add(id);
  };
  for (const task of tasks) {
    add(task.createdByUserId);
    add(task.assignedUserId);
    add(task.resolvedByUserId);
  }
  groupMemberIds.forEach(add);
  return Array.from(participantIds);
}

export function isPulseOriginTask(task: TaskContractRow): boolean {
  // Status-list automation provenance alone activates the mandatory checklist
  // gate. Its relationship is server-owned and its tag is reserved.
  return task.relatedEntityType === "status_list_item" || (task.tags || []).includes("status_list");
}

export function isPulseNotificationTask(task: TaskContractRow): boolean {
  return isPulseOriginTask(task) || (task.tags || []).includes(MANUAL_PULSE_TASK_TAG);
}

export function shouldNotifyTaskCreator(
  task: TaskContractRow,
  completedNow: boolean,
  notifyAgent?: boolean,
): boolean {
  if (!completedNow || !task.createdByUserId || notifyAgent === false) return false;
  if (notifyAgent === true) return true;
  return isPulseNotificationTask(task);
}

export function pulseCompletionMissingResolution(
  task: TaskContractRow & { resolution?: string | null },
  completionTransition: boolean,
  requestedResolution?: string | null,
): boolean {
  if (!completionTransition || !isPulseNotificationTask(task)) return false;
  const effectiveResolution = requestedResolution === undefined ? task.resolution : requestedResolution;
  return !(effectiveResolution || "").trim();
}

export function buildPulseCompletionNotification(
  task: PulseCompletionTaskRow,
  resolution?: string | null,
  recipientTitle?: string,
) {
  const savedResolution = (resolution ?? task.resolution ?? "").trim();
  return {
    type: "back_office_resolved",
    title: recipientTitle ?? task.title,
    message: savedResolution || "Úloha bola vyriešená",
    priority: "normal",
    entityType: "task",
    entityId: task.id,
    metadata: {
      taskId: task.id,
      taskTitle: task.title,
      source: "nexus_pulse",
      resolution: savedResolution || null,
    },
  } as const;
}

export const UNMANAGED_TASK_CREATOR_NOTICE_CONDITION = {
  not: { field: "newValues.creatorNotificationHandled", op: "eq", value: true },
};

export function withUnmanagedTaskCreatorNoticeCondition(existing: unknown): unknown {
  const isManagedNoticeGuard = (condition: any): boolean =>
    !!condition?.not
    && condition.not.field === "newValues.creatorNotificationHandled"
    && condition.not.op === "eq"
    && condition.not.value === true;
  const withoutLegacyPulseGuard = (condition: any): any => {
    if (
      condition?.not
      && condition.not.field === "newValues.pulseOrigin"
      && condition.not.op === "eq"
      && condition.not.value === true
    ) return undefined;
    if (!Array.isArray(condition?.all)) return condition;
    const children = condition.all
      .map((child: unknown) => withoutLegacyPulseGuard(child))
      .filter((child: unknown) => child !== undefined);
    if (children.length === 0) return undefined;
    return children.length === 1 ? children[0] : { ...condition, all: children };
  };
  const withoutLegacyGuard = withoutLegacyPulseGuard(existing);
  const hasManagedGuard = (condition: any): boolean =>
    isManagedNoticeGuard(condition)
    || (Array.isArray(condition?.all) && condition.all.some((child: unknown) => hasManagedGuard(child)));
  if (hasManagedGuard(withoutLegacyGuard)) return withoutLegacyGuard;
  return withoutLegacyGuard
    ? { all: [withoutLegacyGuard, UNMANAGED_TASK_CREATOR_NOTICE_CONDITION] }
    : UNMANAGED_TASK_CREATOR_NOTICE_CONDITION;
}

export function normalizeTaskGroupMemberIds(
  requested: unknown,
  existing: readonly { userId: string }[],
  users: readonly { id: string; isActive: boolean }[],
): string[] {
  if (!Array.isArray(requested) || requested.some(id => typeof id !== "string" || !id.trim())) {
    throw new Error("memberUserIds must be an array of user IDs");
  }
  const requestedIds = requested as string[];
  if (new Set(requestedIds).size !== requestedIds.length) {
    throw new Error("memberUserIds must contain distinct user IDs");
  }

  const existingIds = new Set(existing.map(member => member.userId));
  const usersById = new Map(users.map(user => [user.id, user]));
  for (const id of requestedIds) {
    const user = usersById.get(id);
    if (!user) throw new Error(`Unknown task group member: ${id}`);
    if (!user.isActive && !existingIds.has(id)) {
      throw new Error(`Inactive users cannot be added to a task group: ${id}`);
    }
  }

  // Existing inactive members remain assigned even when an edit omits them. This
  // lets admins edit the group without silently deleting historical memberships.
  const normalizedIds: string[] = [];
  const seenIds = new Set<string>();
  [...requestedIds, ...existing.filter(member => !usersById.get(member.userId)?.isActive).map(member => member.userId)]
    .forEach(id => {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        normalizedIds.push(id);
      }
    });
  return normalizedIds;
}

export function buildValidatedTaskPatch(
  body: Record<string, unknown>,
  existingTags: string[] = [],
): Record<string, unknown> {
  const protectedFields = ["createdByUserId", "resolvedByUserId", "resolvedAt", "workStartedAt", "workStoppedAt"];
  const attemptedProtected = protectedFields.find(field => Object.prototype.hasOwnProperty.call(body, field));
  if (attemptedProtected) throw new Error(`${attemptedProtected} is server-managed`);

  const allowedFields = ["title", "description", "status", "priority", "dueDate", "assignedUserId", "tags", "resolution", "attachments"];
  const unsupported = Object.keys(body).find(field => !allowedFields.includes(field));
  if (unsupported) throw new Error(`Unsupported task field: ${unsupported}`);

  const patch: Record<string, unknown> = {};
  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    if (typeof body.title !== "string" || !body.title.trim()) throw new Error("title must be a non-empty string");
    patch.title = body.title.trim();
  }
  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    if (body.description !== null && typeof body.description !== "string") throw new Error("description must be a string or null");
    patch.description = body.description;
  }
  if (Object.prototype.hasOwnProperty.call(body, "resolution")) {
    if (body.resolution !== null && typeof body.resolution !== "string") throw new Error("resolution must be a string or null");
    if (typeof body.resolution === "string" && body.resolution.length > 10_000) throw new Error("resolution must be at most 10000 characters");
    patch.resolution = typeof body.resolution === "string" ? body.resolution.trim() : null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "attachments")) {
    if (!Array.isArray(body.attachments)) throw new Error("attachments must be an array");
    patch.attachments = body.attachments;
  }
  if (Object.prototype.hasOwnProperty.call(body, "status")) {
    if (typeof body.status !== "string" || !TASK_STATUSES.includes(body.status as any)) throw new Error("Invalid task status");
    patch.status = body.status;
  }
  if (Object.prototype.hasOwnProperty.call(body, "priority")) {
    if (typeof body.priority !== "string" || !TASK_PRIORITIES.includes(body.priority as any)) throw new Error("Invalid task priority");
    patch.priority = body.priority;
  }
  if (Object.prototype.hasOwnProperty.call(body, "dueDate")) {
    if (body.dueDate === null || body.dueDate === "") {
      patch.dueDate = null;
    } else if (typeof body.dueDate === "string" || body.dueDate instanceof Date) {
      const dueDate = new Date(body.dueDate);
      if (Number.isNaN(dueDate.getTime())) throw new Error("Invalid dueDate");
      patch.dueDate = dueDate;
    } else {
      throw new Error("dueDate must be a date or null");
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "assignedUserId")) {
    if (typeof body.assignedUserId !== "string" || !body.assignedUserId.trim()) throw new Error("assignedUserId must be a user ID");
    patch.assignedUserId = body.assignedUserId;
  }
  if (Object.prototype.hasOwnProperty.call(body, "tags")) {
    if (!Array.isArray(body.tags) || body.tags.some(tag => typeof tag !== "string")) throw new Error("tags must be an array of strings");
    const requestedTags = body.tags as string[];
    const requestedGroupTags = requestedTags.filter(tag => tag.startsWith("group_id:"));
    if (requestedGroupTags.length > 1 || requestedTags.some(tag => tag.startsWith("group_id:") && !tag.slice("group_id:".length).trim())) {
      throw new Error("tags may contain at most one valid group_id tag");
    }
    if (requestedTags.some(tag => !tag.startsWith("group_id:") && !existingTags.includes(tag))) {
      throw new Error("Only the task group assignment can be changed through tags");
    }
    const stableTags = existingTags.filter(tag => !tag.startsWith("group_id:"));
    patch.tags = [...stableTags, ...requestedGroupTags];
  }
  if (Object.keys(patch).length === 0) throw new Error("No supported task fields provided");
  return patch;
}

export function managerMayAccessTaskCountry(
  role: string | undefined,
  assignedCountries: readonly string[] | null | undefined,
  taskCountry: string | null | undefined,
): boolean {
  if (role === "admin") return true;
  if (role !== "manager") return false;
  return userMayAccessTaskCountry(role, assignedCountries, taskCountry);
}