import { startOfBratislavaDay } from "./wallboard-time";

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
/** Inclusive calendar dates in the app timezone; the upper instant is exclusive. */
export function omniSearchDateRange(from?: unknown, to?: unknown) {
  if ((from !== undefined && from !== "" && !validDate(from)) ||
    (to !== undefined && to !== "" && !validDate(to)) || (from && to && String(from) > String(to))) {
    throw new Error("invalid_date_range");
  }
  const start = from ? startOfBratislavaDay(new Date(`${from}T12:00:00Z`)).toISOString() : undefined;
  const dayAfter = to ? new Date(Date.parse(`${to}T12:00:00Z`) + 86400_000) : undefined;
  const end = dayAfter ? startOfBratislavaDay(dayAfter).toISOString() : undefined;
  return { start, end };
}
