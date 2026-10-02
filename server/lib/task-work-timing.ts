export type TaskWorkTiming = {
  workStartedAt: Date | null;
  workStoppedAt: Date | null;
};

export type TaskWorkTimingSource = {
  status: string;
  workStartedAt?: Date | null;
  workStoppedAt?: Date | null;
};

function isTerminalTaskStatus(status: string): boolean {
  return status === "completed" || status === "cancelled";
}

/**
 * Derive server-owned elapsed-time markers for one persisted status transition.
 * Callers must supply a row read while holding its database row lock.
 */
export function transitionTaskWorkTiming(
  current: TaskWorkTimingSource,
  nextStatus: string,
  now = new Date(),
): TaskWorkTiming {
  const wasTerminal = isTerminalTaskStatus(current.status);
  const becomesTerminal = isTerminalTaskStatus(nextStatus);

  if (wasTerminal && !becomesTerminal) {
    return {
      workStartedAt: nextStatus === "in_progress" ? now : null,
      workStoppedAt: null,
    };
  }

  let workStartedAt = current.workStartedAt ?? null;
  let workStoppedAt = current.workStoppedAt ?? null;

  // Only a real transition to in_progress starts a legacy task with unknown
  // timing. Existing in-progress tasks are deliberately not backfilled.
  if (current.status !== "in_progress" && nextStatus === "in_progress" && !workStartedAt) {
    workStartedAt = now;
  }

  if (!wasTerminal && becomesTerminal && workStartedAt && !workStoppedAt) {
    workStoppedAt = now;
  }

  return { workStartedAt, workStoppedAt };
}

/** Remove any untrusted timestamp values before applying server-derived timing. */
export function stripTaskWorkTimingInput<T extends object>(input: T): Omit<T, "workStartedAt" | "workStoppedAt"> {
  const copy = { ...input } as Record<string, unknown>;
  delete copy.workStartedAt;
  delete copy.workStoppedAt;
  return copy as Omit<T, "workStartedAt" | "workStoppedAt">;
}