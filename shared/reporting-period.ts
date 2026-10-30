export interface ReportingPeriod { from: string; to: string }
export const reportingPresets = ["today", "yesterday", "thisWeek", "lastWeek", "last7Days", "last30Days", "thisMonth", "lastMonth", "thisYear", "allTime"] as const;
export type ReportingPreset = typeof reportingPresets[number];
export const REPORT_TIMEZONE = "Europe/Bratislava";

export function reportingDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: REPORT_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function validReportingDay(day: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(`${day}T00:00:00Z`)) &&
    new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
}
function shiftDay(day: string, offset: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function reportingPreset(preset: ReportingPreset, now = new Date()): ReportingPeriod {
  const today = reportingDay(now);
  const date = new Date(`${today}T12:00:00Z`);
  const monday = shiftDay(today, -((date.getUTCDay() + 6) % 7));
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (preset) {
    case "today": return { from: today, to: today };
    case "yesterday": return { from: shiftDay(today, -1), to: shiftDay(today, -1) };
    case "thisWeek": return { from: monday, to: shiftDay(monday, 6) };
    case "lastWeek": return { from: shiftDay(monday, -7), to: shiftDay(monday, -1) };
    case "last7Days": return { from: shiftDay(today, -6), to: today };
    case "last30Days": return { from: shiftDay(today, -29), to: today };
    case "thisMonth": return { from: monthStart, to: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10) };
    case "lastMonth": return { from: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1, 12)).toISOString().slice(0, 10), to: shiftDay(monthStart, -1) };
    case "thisYear": return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case "allTime": return { from: "", to: "" };
  }
}
export function validReportingPeriod(period: ReportingPeriod) {
  return (!period.from || validReportingDay(period.from)) && (!period.to || validReportingDay(period.to)) &&
    (!period.from || !period.to || period.from <= period.to);
}

/** Calendar-day boundaries in the app timezone, independent of browser/server TZ. */
export function reportingDayStart(day: string) {
  if (!validReportingDay(day)) throw new Error("Invalid reporting day");
  const target = Date.parse(`${day}T00:00:00Z`);
  let instant = target;
  for (let iteration = 0; iteration < 3; iteration++) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: REPORT_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const asUTC = Date.UTC(+value.year, +value.month - 1, +value.day, +value.hour, +value.minute, +value.second);
    instant += target - asUTC;
  }
  return new Date(instant).toISOString();
}
export function reportingBounds(period: ReportingPeriod) {
  if (!validReportingPeriod(period)) return { valid: false, fromISO: "", toISO: "" };
  return {
    valid: true,
    fromISO: period.from ? reportingDayStart(period.from) : "1970-01-01T00:00:00.000Z",
    toISO: period.to ? new Date(Date.parse(reportingDayStart(shiftDay(period.to, 1))) - 1).toISOString() : "9999-12-31T23:59:59.999Z",
  };
}
export function reportingMonthOverlaps(year: number, month: number, period: ReportingPeriod) {
  if (!validReportingPeriod(period) || month < 1 || month > 12) return false;
  const key = `${year}-${String(month).padStart(2, "0")}`;
  return (!period.from || key >= period.from.slice(0, 7)) && (!period.to || key <= period.to.slice(0, 7));
}

/** Optional legacy-route ISO bounds. Validate once before executing any query. */
export function parseReportingQuery(query: { from?: unknown; to?: unknown }) {
  const parse = (value: unknown, end: boolean): string | null => {
    if (value === undefined || value === "") return null;
    if (typeof value !== "string") throw new Error("Invalid reporting date");
    if (validReportingDay(value)) return end ? reportingBounds({ from: "", to: value }).toISO : reportingDayStart(value);
    if (!validReportingDay(value.slice(0, 10)) || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error("Invalid reporting date");
    return new Date(value).toISOString();
  };
  const from = parse(query.from, false), to = parse(query.to, true);
  if (from && to && Date.parse(from) > Date.parse(to)) throw new Error("Invalid reporting range");
  return { from, to };
}
