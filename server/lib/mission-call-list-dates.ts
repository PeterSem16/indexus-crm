import { startOfBratislavaDay } from "./wallboard-time";

export interface MissionCallListDateBounds {
  dateFrom: Date | null;
  dateToExclusive: Date | null;
}

function parseCalendarDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error(`${field} must be a valid YYYY-MM-DD date`);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`${field} must be a valid YYYY-MM-DD date`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const localDateSeed = new Date(0);
  localDateSeed.setUTCFullYear(year, month - 1, day);
  localDateSeed.setUTCHours(12, 0, 0, 0);
  if (localDateSeed.getUTCFullYear() !== year ||
      localDateSeed.getUTCMonth() !== month - 1 ||
      localDateSeed.getUTCDate() !== day) {
    throw new Error(`${field} must be a valid YYYY-MM-DD date`);
  }
  return localDateSeed;
}

function nextCalendarDate(value: Date): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

/**
 * Date-only filters in Full Call List represent Europe/Bratislava calendar days.
 * End is exclusive so sub-millisecond timestamps at the end of a day are not
 * lost, and each boundary is resolved independently for DST transitions.
 */
export function missionCallListDateBounds(
  dateFrom: unknown,
  dateTo: unknown,
): MissionCallListDateBounds {
  const fromDate = parseCalendarDate(dateFrom, "dateFrom");
  const toDate = parseCalendarDate(dateTo, "dateTo");
  return {
    dateFrom: fromDate ? startOfBratislavaDay(fromDate) : null,
    dateToExclusive: toDate ? startOfBratislavaDay(nextCalendarDate(toDate)) : null,
  };
}