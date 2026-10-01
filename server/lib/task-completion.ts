import { isPulseOriginTask, userMayAccessTaskCountry } from "./task-contract";

export interface CompletionTask {
  status: string;
  createdByUserId?: string | null;
  country?: string | null;
  resolution?: string | null;
}

export interface CompletionNoticeRecipient {
  isActive: boolean;
  role?: string;
  assignedCountries?: readonly string[] | null;
}

export class TaskCompletionNoticeAuthorizationError extends Error {
  constructor() {
    super("Task creator is inactive or no longer authorized for this task country; disable notifyAgent to complete without a notice");
    this.name = "TaskCompletionNoticeAuthorizationError";
  }
}

export class TaskInactiveCompletionError extends Error {
  readonly code = "task_inactive" as const;

  constructor() {
    super("Reopen the task before completing it");
    this.name = "TaskInactiveCompletionError";
  }
}

export function assertTaskCanBeCompletedStatus(status: string): void {
  if (status !== "pending" && status !== "in_progress") {
    throw new TaskInactiveCompletionError();
  }
}

export type PulseChecklistCompletionErrorCode = "task_checklist_required" | "task_checklist_incomplete";

export class TaskChecklistInactiveError extends Error {
  constructor() {
    super("Checklist changes require an active task");
    this.name = "TaskChecklistInactiveError";
  }
}

export function assertTaskChecklistEditableStatus(status: string): void {
  if (status !== "pending" && status !== "in_progress") throw new TaskChecklistInactiveError();
}

export class PulseChecklistCompletionError extends Error {
  readonly code: PulseChecklistCompletionErrorCode;
  readonly remainingCount: number;

  constructor(code: PulseChecklistCompletionErrorCode, remainingCount: number) {
    super(code === "task_checklist_required"
      ? "Pulse tasks require at least one checklist item before completion"
      : "Complete all Pulse task checklist steps before completion");
    this.name = "PulseChecklistCompletionError";
    this.code = code;
    this.remainingCount = remainingCount;
  }
}

export function assertPulseTaskChecklistComplete(
  task: { tags?: string[] | null; relatedEntityType?: string | null },
  items: readonly { doneAt?: Date | string | null }[],
): void {
  if (!isPulseOriginTask(task)) return;
  if (items.length === 0) {
    throw new PulseChecklistCompletionError("task_checklist_required", 0);
  }
  const remainingCount = items.filter(item => item.doneAt == null).length;
  if (remainingCount > 0) {
    throw new PulseChecklistCompletionError("task_checklist_incomplete", remainingCount);
  }
}

export async function assertTaskCompletionNoticeRecipient(
  task: CompletionTask,
  loadCreator: (id: string) => Promise<CompletionNoticeRecipient | null | undefined>,
): Promise<void> {
  if (!task.createdByUserId) throw new TaskCompletionNoticeAuthorizationError();
  const creator = await loadCreator(task.createdByUserId);
  if (!creator?.isActive || !userMayAccessTaskCountry(creator.role, creator.assignedCountries, task.country)) {
    throw new TaskCompletionNoticeAuthorizationError();
  }
}

/**
 * Run the task update and its optional creator notice inside a caller-owned DB
 * transaction. If notice persistence fails, the task update must roll back too.
 */
export async function completeTaskWithinTransaction<
  TTask extends CompletionTask,
  TNotice,
>(
  oldTask: TTask,
  applyTaskUpdate: (completedNow: boolean) => Promise<TTask>,
  persistNotice?: (creatorUserId: string, task: TTask) => Promise<TNotice>,
  completionRequested = true,
  authorizeNotice?: (creatorUserId: string, task: TTask) => Promise<void>,
  validateCompletion?: (task: TTask) => Promise<void>,
): Promise<{ task: TTask; completedNow: boolean; notification?: TNotice }> {
  const completedNow = completionRequested && oldTask.status !== "completed";
  if (completedNow) assertTaskCanBeCompletedStatus(oldTask.status);
  if (completedNow && persistNotice) {
    if (!oldTask.createdByUserId) throw new TaskCompletionNoticeAuthorizationError();
    await authorizeNotice?.(oldTask.createdByUserId, oldTask);
  }
  if (completedNow) await validateCompletion?.(oldTask);
  const task = await applyTaskUpdate(completedNow);
  if (!completedNow || !persistNotice || !oldTask.createdByUserId) {
    return { task, completedNow };
  }
  const notification = await persistNotice(oldTask.createdByUserId, task);
  return { task, completedNow, notification };
}