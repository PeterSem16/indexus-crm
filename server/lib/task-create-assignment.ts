/** Group routing and personal assignment are alternative create targets.
 * Legacy group tags are validated separately by the existing route. */
export type TaskCreateAssignment =
  | { kind: "shared"; groupIds: string[]; userIds: string[] }
  | { kind: "group"; groupId: string }
  | { kind: "person"; assignedUserId: string };

export class TaskCreateAssignmentError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function parseTaskCreateAssignment(body: Record<string, unknown>): TaskCreateAssignment {
  if (body.recipients !== undefined) {
    if (body.groupId != null || body.assignedUserId != null || body.assignedUserIds != null) {
      throw new TaskCreateAssignmentError("Shared recipients cannot be combined with legacy assignment fields");
    }
    const value = body.recipients as any;
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new TaskCreateAssignmentError("Invalid recipients");
    const ids = (input: unknown): string[] => {
      if (!Array.isArray(input) || input.length > 30 || input.some(id => typeof id !== "string" || !id.trim() || id.length > 100)) {
        throw new TaskCreateAssignmentError("Invalid recipient IDs");
      }
      return [...new Set(input.map(id => id.trim()))];
    };
    const groupIds = ids(value.groupIds);
    const userIds = ids(value.userIds);
    if (!groupIds.length && !userIds.length) throw new TaskCreateAssignmentError("Select at least one recipient");
    return { kind: "shared", groupIds, userIds };
  }
  if (body.groupId !== undefined) {
    if (typeof body.groupId !== "string" || !body.groupId.trim()) {
      throw new TaskCreateAssignmentError("groupId must identify a task group");
    }
    if (body.assignedUserId != null || body.assignedUserIds != null
      || (Array.isArray(body.tags) && body.tags.some(tag =>
        typeof tag === "string" && (tag.startsWith("group_id:") || tag.startsWith("group:"))))) {
      throw new TaskCreateAssignmentError("Choose either a task group or specific users, not both");
    }
    return { kind: "group", groupId: body.groupId.trim() };
  }
  if (typeof body.assignedUserId !== "string" || !body.assignedUserId.trim()) {
    throw new TaskCreateAssignmentError("Select a task group or an active assigned user");
  }
  return { kind: "person", assignedUserId: body.assignedUserId.trim() };
}

/** The required nominal owner is an implementation detail, not a second target.
 * All members still access the one shared task through its group tag. */
export function taskGroupNominalOwner(actorId: string, eligibleMemberIds: string[]): string {
  const members = [...new Set(eligibleMemberIds)].sort();
  if (!members.length) throw new TaskCreateAssignmentError("The task group has no approved active recipients for this country");
  return members.includes(actorId) ? actorId : members[0];
}
