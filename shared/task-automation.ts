/** Task routing snapshots contain IDs only, never the original task tags. */
export function taskAutomationGroupIds(task: { tags?: unknown; taskGroupIds?: unknown }): string[] {
  if (Array.isArray(task.taskGroupIds)) return task.taskGroupIds.filter((id): id is string => typeof id === "string" && !!id);
  if (!Array.isArray(task.tags)) return [];
  return [...new Set(task.tags.filter((tag): tag is string => typeof tag === "string" && tag.startsWith("group_id:"))
    .map(tag => tag.slice("group_id:".length)).filter(Boolean))];
}

export type TaskAssignmentTriggerTarget = { kind: "groups" | "users"; ids: string[] };

export function isTaskAssignmentTriggerTarget(value: unknown): value is TaskAssignmentTriggerTarget {
  if (!value || typeof value !== "object") return false;
  const target = value as TaskAssignmentTriggerTarget;
  return Object.keys(value).every(key => ["kind", "ids"].includes(key)) &&
    ["groups", "users"].includes(target.kind) && Array.isArray(target.ids) && target.ids.length > 0 &&
    target.ids.length <= 200 && target.ids.every(id => typeof id === "string" && id.trim().length > 0) &&
    new Set(target.ids).size === target.ids.length;
}

export function taskAssignmentTriggerMatches(trigger: any, values: any): boolean {
  if (trigger?.eventType !== "task.assigned" || trigger.assignmentTarget == null) return true;
  if (!isTaskAssignmentTriggerTarget(trigger.assignmentTarget)) return false;
  const target = trigger.assignmentTarget as TaskAssignmentTriggerTarget;
  const groups = taskAutomationGroupIds(values || {});
  // The nominal database owner of a shared group task is not a personal assignment.
  return target.kind === "groups"
    ? target.ids.some(id => groups.includes(id))
    : groups.length === 0 && target.ids.includes(values?.assignedUserId);
}

export function taskAutomationListMatches(actual: unknown, selected: unknown): boolean {
  return Array.isArray(actual) && Array.isArray(selected) &&
    actual.some(value => typeof value === "string" && selected.includes(value));
}
