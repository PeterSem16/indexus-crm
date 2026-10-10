export type CommunicationTask = {
  id: string; status: string; boState?: string | null;
  workStartedAt?: Date | string | null; resolvedAt?: Date | string | null;
};
export function communicationTaskState(task: CommunicationTask): "inProgress" | "completed" | null {
  if (task.status === "cancelled") return null;
  if (task.status === "completed" || task.boState === "done") return "completed";
  return task.status === "in_progress" || task.boState === "in_progress" ? "inProgress" : null;
}
export function communicationTaskVersion(task: CommunicationTask): string {
  const stamp = (value?: Date | string | null) => value instanceof Date ? value.toISOString() : value || "";
  return JSON.stringify([task.status, task.boState || "", stamp(task.workStartedAt), stamp(task.resolvedAt)]);
}
export function communicationTaskCounts(tasks: CommunicationTask[], seen: Record<string, string> | null) {
  const counts = { inProgress: 0, completed: 0 };
  if (!seen) return counts;
  for (const task of tasks) {
    const state = communicationTaskState(task);
    if (state && seen[task.id] !== communicationTaskVersion(task)) counts[state]++;
  }
  return counts;
}
export function communicationChatCount(threads: { partnerId: string; unreadCount: number }[], live: Map<string, number>) {
  const counts = new Map(live);
  for (const thread of threads) counts.set(thread.partnerId, Math.max(counts.get(thread.partnerId) || 0, thread.unreadCount || 0));
  return [...counts.values()].reduce((sum, value) => sum + Math.max(0, value), 0);
}
