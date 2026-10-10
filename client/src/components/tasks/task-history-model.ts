import type { Task, TaskComment } from "@shared/schema";

type HistoryTask = Pick<Task, "resolvedAt" | "resolvedByUserId" | "resolution">;

export function isCompletionEvent(task: HistoryTask, comment: TaskComment): boolean {
  if (comment.kind !== "state_change") return false;
  const metadata = comment.metadata;
  const state = metadata && typeof metadata === "object" && "toState" in metadata ? metadata.toState : null;
  return state === "done" || state === "completed"
    || !!(task.resolution?.trim() && comment.content.trim() === task.resolution.trim());
}

/** The task supplies the canonical latest completion. Keep older transitions,
 * but don't repeat its resolution comment as a second history card. */
export function taskHistoryComments(task: HistoryTask, comments: TaskComment[]): TaskComment[] {
  const resolvedAt = task.resolvedAt ? new Date(task.resolvedAt).getTime() : NaN;
  return comments.filter(comment => {
    if (comment.kind !== "state_change") return false;
    if (!Number.isFinite(resolvedAt) || !isCompletionEvent(task, comment)) return true;
    if (task.resolvedByUserId && comment.userId !== task.resolvedByUserId) return true;
    const createdAt = new Date(comment.createdAt).getTime();
    return !Number.isFinite(createdAt) || Math.abs(createdAt - resolvedAt) > 2000;
  });
}

export function taskResolverId(task: HistoryTask, comments: TaskComment[]): string | null {
  if (task.resolvedByUserId) return task.resolvedByUserId;
  return comments.filter(comment => isCompletionEvent(task, comment))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.userId || null;
}
