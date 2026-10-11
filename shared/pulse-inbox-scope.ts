export const PULSE_TASK_MISSION_PREFIX = "pulse_mission:";

export interface InboxScopeTask {
  createdByUserId: string;
  tags?: string[] | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}

export function personalInboxTask(
  task: InboxScopeTask,
  userId: string,
  missionId: string | null | undefined,
  statusListMissions: ReadonlyMap<string, string> = new Map(),
): boolean {
  if (task.createdByUserId !== userId) return false;
  if (missionId === undefined) return true;
  if (!missionId) return false;
  const identities = new Set((task.tags || [])
    .filter(tag => tag.startsWith(PULSE_TASK_MISSION_PREFIX))
    .map(tag => tag.slice(PULSE_TASK_MISSION_PREFIX.length)));
  if (task.relatedEntityType === "status_list_item" && task.relatedEntityId) {
    const linked = statusListMissions.get(task.relatedEntityId);
    if (linked) identities.add(linked);
  }
  if (task.relatedEntityType === "campaign" && task.relatedEntityId) identities.add(task.relatedEntityId);
  return identities.size === 1 && identities.has(missionId);
}

export function inboxScopeUrl(path: string, missionId?: string | null): string {
  return missionId === undefined ? path : `${path}?missionId=${encodeURIComponent(missionId || "")}`;
}
