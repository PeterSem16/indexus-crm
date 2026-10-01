import { useEffect, useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { useI18n } from "@/i18n";

const TASK_TIME_ZONE = "Europe/Bratislava";

export type TaskTimingFields = {
  id: string;
  status: string;
  dueDate?: string | Date | null;
  workStartedAt?: string | Date | null;
  workStoppedAt?: string | Date | null;
};

function parseTimestamp(value: string | Date | null | undefined): number | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function parseCalendarDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(0);
  check.setUTCFullYear(year, month - 1, day);
  check.setUTCHours(0, 0, 0, 0);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

function utcEpochFromParts(year: number, month: number, day: number, hour: number, minute: number, second: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getTime();
}

function getZonedMidnightEpoch(year: number, month: number, day: number): number {
  const targetAsUtc = utcEpochFromParts(year, month, day, 0, 0, 0);
  let estimate = targetAsUtc;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: TASK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  // Resolve a local civil time to an instant without assuming a fixed UTC offset.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const parts = formatter.formatToParts(new Date(estimate));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const shownAsUtc = utcEpochFromParts(
      Number(values.year),
      Number(values.month),
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
    const adjustment = targetAsUtc - shownAsUtc;
    estimate += adjustment;
    if (adjustment === 0) break;
  }
  return estimate;
}

/**
 * Resolve date-only and legacy UTC-midnight due dates as the end of that
 * calendar day in Bratislava. Other timestamps remain absolute instants.
 */
export function getTaskDeadlineTimestamp(dueDate: string | Date | null | undefined): number | null {
  let calendarDate: string | null = null;
  if (typeof dueDate === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      calendarDate = dueDate;
    } else {
      const legacyMidnight = /^(\d{4}-\d{2}-\d{2})T00:00(?::00(?:\.0+)?)?(?:Z|\+00:00)$/.exec(dueDate);
      if (legacyMidnight) calendarDate = legacyMidnight[1];
    }
  } else if (dueDate instanceof Date) {
    const iso = Number.isFinite(dueDate.getTime()) ? dueDate.toISOString() : "";
    const legacyMidnight = /^(\d{4}-\d{2}-\d{2})T00:00(?::00(?:\.0+)?)?Z$/.exec(iso);
    if (legacyMidnight) calendarDate = legacyMidnight[1];
  }

  if (calendarDate) {
    const parts = parseCalendarDate(calendarDate);
    if (!parts) return null;
    const nextDay = new Date(0);
    nextDay.setUTCFullYear(parts.year, parts.month - 1, parts.day + 1);
    nextDay.setUTCHours(0, 0, 0, 0);
    return getZonedMidnightEpoch(nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate());
  }
  return parseTimestamp(dueDate);
}

export function isTaskOverdue(status: string, dueDate: string | Date | null | undefined, now = Date.now()): boolean {
  if (status === "completed" || status === "cancelled") return false;
  const deadline = getTaskDeadlineTimestamp(dueDate);
  return deadline !== null && now >= deadline;
}

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