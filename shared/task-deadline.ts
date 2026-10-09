const TASK_TIME_ZONE = "Europe/Bratislava";

export function getTaskTimestamp(value: string | Date | null | undefined): number | null {
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
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
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
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  // Resolve a civil time without assuming a fixed UTC offset (including DST).
  for (let attempt = 0; attempt < 5; attempt++) {
    const values = Object.fromEntries(formatter.formatToParts(new Date(estimate)).map(part => [part.type, part.value]));
    const shownAsUtc = utcEpochFromParts(Number(values.year), Number(values.month), Number(values.day),
      Number(values.hour), Number(values.minute), Number(values.second));
    const adjustment = targetAsUtc - shownAsUtc;
    estimate += adjustment;
    if (adjustment === 0) break;
  }
  return estimate;
}

/** Date-only / legacy UTC midnight means end of that day in Bratislava; other timestamps are instants. */
export function getTaskDeadlineTimestamp(dueDate: string | Date | null | undefined): number | null {
  let calendarDate: string | null = null;
  if (typeof dueDate === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) calendarDate = dueDate;
    else {
      const midnight = /^(\d{4}-\d{2}-\d{2})T00:00(?::00(?:\.0+)?)?(?:Z|\+00:00)$/.exec(dueDate);
      if (midnight) calendarDate = midnight[1];
    }
  } else if (dueDate instanceof Date) {
    const iso = Number.isFinite(dueDate.getTime()) ? dueDate.toISOString() : "";
    const midnight = /^(\d{4}-\d{2}-\d{2})T00:00(?::00(?:\.0+)?)?Z$/.exec(iso);
    if (midnight) calendarDate = midnight[1];
  }
  if (calendarDate) {
    const parts = parseCalendarDate(calendarDate);
    if (!parts) return null;
    const nextDay = new Date(0);
    nextDay.setUTCFullYear(parts.year, parts.month - 1, parts.day + 1);
    nextDay.setUTCHours(0, 0, 0, 0);
    return getZonedMidnightEpoch(nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate());
  }
  return getTaskTimestamp(dueDate);
}

export function isTaskOverdue(status: string, dueDate: string | Date | null | undefined, now = Date.now()): boolean {
  if (status === "completed" || status === "cancelled") return false;
  const deadline = getTaskDeadlineTimestamp(dueDate);
  return deadline !== null && now >= deadline;
}
