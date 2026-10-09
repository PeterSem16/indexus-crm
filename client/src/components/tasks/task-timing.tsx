import { useEffect, useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { useI18n } from "@/i18n";
import { getTaskDeadlineTimestamp, isTaskOverdue, getTaskTimestamp as parseTimestamp } from "@shared/task-deadline";
export { getTaskDeadlineTimestamp, isTaskOverdue } from "@shared/task-deadline";

export type TaskTimingFields = {
  id: string;
  status: string;
  dueDate?: string | Date | null;
  workStartedAt?: string | Date | null;
  workStoppedAt?: string | Date | null;
};

export function getTaskElapsedMilliseconds(
  status: string,
  workStartedAt: string | Date | null | undefined,
  workStoppedAt: string | Date | null | undefined,
  now = Date.now(),
): number | null {
  const startedAt = parseTimestamp(workStartedAt);
  const stoppedAt = parseTimestamp(workStoppedAt);
  const isActive = status !== "completed" && status !== "cancelled";
  const endAt = stoppedAt ?? (isActive ? now : null);
  return startedAt !== null && endAt !== null ? Math.max(0, endAt - startedAt) : null;
}

export function formatTaskElapsedTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatOverdueDuration(milliseconds: number, template: string): string {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days === 0) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return template
    .replace("{days}", String(days))
    .replace("{hours}", String(hours).padStart(2, "0"))
    .replace("{minutes}", String(minutes).padStart(2, "0"));
}

export function TaskTimingStatus({
  task,
  compact = false,
  className = "",
}: { task: TaskTimingFields; compact?: boolean; className?: string }) {
  const { t } = useI18n();
  const { id: taskId, status, dueDate, workStartedAt, workStoppedAt } = task;
  const startedAt = parseTimestamp(workStartedAt);
  const stoppedAt = parseTimestamp(workStoppedAt);
  const isActive = status !== "completed" && status !== "cancelled";
  const deadlineAt = getTaskDeadlineTimestamp(dueDate);
  const [clock, setClock] = useState<{ taskId: string; now: number }>(() => ({ taskId, now: Date.now() }));
  const now = clock.taskId === taskId ? clock.now : Date.now();
  const hasUnknownStart = status === "in_progress" && startedAt === null;
  const elapsedMilliseconds = getTaskElapsedMilliseconds(status, workStartedAt, workStoppedAt, now);
  const overdue = isTaskOverdue(status, dueDate, now);

  useEffect(() => {
    const updateClock = () => setClock({ taskId, now: Date.now() });
    updateClock();

    const hasRunningTimer = isActive && startedAt !== null && stoppedAt === null;
    const shouldRefreshOverdue = isActive && deadlineAt !== null;
    const interval = hasRunningTimer
      ? window.setInterval(updateClock, 1000)
      : shouldRefreshOverdue
        ? window.setInterval(updateClock, 60_000)
        : null;
    const untilDeadline = shouldRefreshOverdue ? deadlineAt - Date.now() : -1;
    const deadlineTimeout = untilDeadline > 0
      ? window.setTimeout(updateClock, untilDeadline + 20)
      : null;

    return () => {
      if (interval !== null) window.clearInterval(interval);
      if (deadlineTimeout !== null) window.clearTimeout(deadlineTimeout);
    };
  }, [taskId, isActive, startedAt, stoppedAt, deadlineAt]);

  const showTimer = elapsedMilliseconds !== null && (isActive || stoppedAt !== null);
  if (!showTimer && !hasUnknownStart && !overdue) return null;

  const textSize = compact ? "text-[10px]" : "text-xs";
  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-1.5 ${textSize} ${className}`.trim()}>
      {showTimer && (
        <span
          className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap rounded-sm border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300"
          data-testid={`task-time-${taskId}`}
          aria-label={t.tasks.taskWorkElapsedDescription}
          title={t.tasks.taskWorkElapsedDescription}
        >
          <Clock className={`h-3 w-3 shrink-0 ${isActive && stoppedAt === null ? "text-blue-500" : "text-muted-foreground"}`} />
          <span>{t.tasks.taskWorkElapsed}</span>
          <time>{formatTaskElapsedTime(elapsedMilliseconds!)}</time>
        </span>
      )}
      {hasUnknownStart && (
        <span
          className="inline-flex items-center gap-1 rounded-sm border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400"
          data-testid={`task-time-${taskId}`}
        >
          <Clock className="h-3 w-3" />{t.tasks.taskWorkStartUnknown}
        </span>
      )}
      {overdue && deadlineAt !== null && (
        <span
          className="inline-flex max-w-full items-center gap-1 rounded-sm border border-rose-200 bg-rose-50 px-1.5 py-0.5 font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          data-testid={`task-overdue-${taskId}`}
          role="status"
        >
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>{t.tasks.taskOverdueLabel}</span>
          <span className="truncate">· {formatOverdueDuration(now - deadlineAt, t.tasks.taskOverdueDuration)}</span>
        </span>
      )}
    </div>
  );
}