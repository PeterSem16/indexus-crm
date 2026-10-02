import {
  canAccessTaskByPolicy,
  taskPeopleCandidateAllowed,
  userMayAccessTaskCountry,
  type TaskAccessUser,
} from "./task-contract";
import type { Task, TaskGroup } from "@shared/schema";

export type TaskReassignmentTarget = { newAssignedUserId: string; newTaskGroupId?: never }
  | { newTaskGroupId: string; newAssignedUserId?: never };
export type TaskReassignmentPerson = TaskAccessUser & {
  isActive: boolean;
  fullName: string | null;
  username: string;
  email: string;
  avatarUrl: string | null;
};
export type TaskReassignmentCatalog = {
  users: TaskReassignmentPerson[];
  groups: TaskGroup[];
  members: { groupId: string; userId: string }[];
};
export type TaskReassignmentResult = {
  task: Task;
  oldTask: Task;
  changed: boolean;
  recipientIds: string[];
  group?: TaskGroup;
};

export class TaskReassignmentError extends Error {
  constructor(public status: number, message: string, public code: string) {
    super(message);
  }
}

export function parseTaskReassignmentTarget(body: unknown): TaskReassignmentTarget {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new TaskReassignmentError(400, "Exactly one reassignment target is required", "invalid_target");
  }
  const row = body as Record<string, unknown>;
  const keys = Object.keys(row);
  if (keys.length !== 1 || !["newAssignedUserId", "newTaskGroupId"].includes(keys[0])
    || typeof row[keys[0]] !== "string" || !(row[keys[0]] as string).trim()) {
    throw new TaskReassignmentError(400, "Provide exactly one non-empty newAssignedUserId or newTaskGroupId", "invalid_target");
  }
  const id = (row[keys[0]] as string).trim();
  return keys[0] === "newAssignedUserId" ? { newAssignedUserId: id } : { newTaskGroupId: id };
}

export function taskReassignmentGroupId(task: Pick<Task, "tags">): string | undefined {
  return task.tags.find(tag => tag.startsWith("group_id:"))?.slice("group_id:".length);
}

export function assertTaskReassignmentActive(task: Pick<Task, "status" | "boState">): void {
  if (!["pending", "in_progress"].includes(task.status) || task.boState === "done") {
    throw new TaskReassignmentError(409, "Completed or cancelled tasks cannot be reassigned", "task_inactive");
  }
}

export function taskReassignmentActorGroups(user: TaskAccessUser, catalog: TaskReassignmentCatalog): Set<string> {
  return new Set(catalog.members.filter(member => member.userId === user.id).map(member => member.groupId));
}

function eligiblePerson(user: TaskAccessUser, task: Task, candidate: TaskReassignmentPerson): boolean {
  return candidate.isActive
    && taskPeopleCandidateAllowed(user.role, user.assignedCountries, candidate.assignedCountries)
    && userMayAccessTaskCountry(candidate.role, candidate.assignedCountries, task.country);
}

export function eligibleTaskGroupRecipients(user: TaskAccessUser, task: Task, groupId: string, catalog: TaskReassignmentCatalog): string[] {
  const members = new Set(catalog.members.filter(member => member.groupId === groupId).map(member => member.userId));
  return catalog.users.filter(person => members.has(person.id) && eligiblePerson(user, task, person)).map(person => person.id);
}

/** The same eligibility policy is used by the picker and by the locked write. */
export function buildTaskReassignmentTargets(user: TaskAccessUser, task: Task, catalog: TaskReassignmentCatalog) {
  const actorGroups = taskReassignmentActorGroups(user, catalog);
  if (!canAccessTaskByPolicy(user, task, actorGroups)) {
    throw new TaskReassignmentError(404, "Task not found", "task_not_found");
  }
  assertTaskReassignmentActive(task);
  const currentGroupId = taskReassignmentGroupId(task);
  const users = catalog.users
    .filter(candidate => eligiblePerson(user, task, candidate))
    .map(({ id, fullName, username, email, avatarUrl }) => ({ id, fullName, username, email, avatarUrl }));
  const groups = catalog.groups
    .filter(group => user.role === "admin" || user.role === "manager" || actorGroups.has(group.id) || group.id === currentGroupId)
    .map(group => ({
      id: group.id, name: group.name, description: group.description, color: group.color,
      memberCount: new Set(eligibleTaskGroupRecipients(user, task, group.id, catalog)).size,
    }))
    .filter(group => group.memberCount > 0 || group.id === currentGroupId);
  users.sort((a, b) => (a.fullName || a.username).localeCompare(b.fullName || b.username));
  groups.sort((a, b) => a.name.localeCompare(b.name));
  return { users, groups };
}

export function buildTaskReassignmentChange(user: TaskAccessUser, task: Task, target: TaskReassignmentTarget, catalog: TaskReassignmentCatalog) {
  const targets = buildTaskReassignmentTargets(user, task, catalog);
  if (target.newAssignedUserId !== undefined) {
    if (!targets.users.some(candidate => candidate.id === target.newAssignedUserId)) {
      throw new TaskReassignmentError(400, "Assigned user must be active, approved and country-accessible", "invalid_user_target");
    }
    const currentGroupId = taskReassignmentGroupId(task);
    const currentMembers = new Set(catalog.members.filter(member => member.groupId === currentGroupId).map(member => member.userId));
    const outsideGroup = !!currentGroupId && !currentMembers.has(target.newAssignedUserId);
    const tags = outsideGroup
      ? task.tags.filter(tag => !tag.startsWith("group_id:") && !tag.startsWith("group:") && tag !== "back_office")
      : task.tags;
    return {
      data: { assignedUserId: target.newAssignedUserId, ...(outsideGroup ? { tags, boState: "received" } : {}) },
      changed: task.assignedUserId !== target.newAssignedUserId || outsideGroup,
      recipientIds: [] as string[],
      group: undefined,
    };
  }
  const group = catalog.groups.find(candidate => candidate.id === target.newTaskGroupId);
  if (!group || !targets.groups.some(candidate => candidate.id === group.id)) {
    throw new TaskReassignmentError(400, "Task group must be accessible and have active country-accessible members", "invalid_group_target");
  }
  // assignedUserId remains the nominal owner: group tags are the actual shared
  // routing mechanism. Never select an arbitrary member, clone, or drop a task.
  const tags = task.tags.filter(tag => !tag.startsWith("group_id:") && !tag.startsWith("group:") && tag !== "back_office");
  tags.push(`group_id:${group.id}`, `group:${group.name}`);
  if (group.isBackOffice) tags.push("back_office");
  const changed = taskReassignmentGroupId(task) !== group.id;
  return {
    data: { tags, ...(changed ? { boState: "received" } : {}) },
    changed,
    recipientIds: Array.from(new Set(eligibleTaskGroupRecipients(user, task, group.id, catalog))),
    group,
  };
}