import { statusListCallbackParts } from "../../shared/status-list-callback-calendar";

export function callbackInstant(parts: { year: number; month0: number; day: number; hour: number; minute: number }) {
  const wall = Date.UTC(parts.year, parts.month0, parts.day, parts.hour, parts.minute);
  const offset = (ms: number) => {
    const values = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Bratislava", hourCycle: "h23", year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(ms));
    const get = (key: string) => Number(values.find(p => p.type === key)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - ms;
  };
  return new Date(wall - offset(wall - offset(wall)));
}
/** Same accepted explicit ISO / Bratislava picker inputs as the existing action.
 * Invalid overrides retain the configured calendar, never the server timezone.
 */
export function callbackOverride(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const s = value.trim();
  if (/(?:z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const date = new Date(s);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?$/);
  return m ? callbackInstant({ year: +m[1], month0: +m[2] - 1, day: +m[3], hour: +m[4], minute: +m[5] }) : null;
}
export function serviceCallbackDate(action: { days: number; time: string | null; weekdaysOnly: boolean }, at: Date, manual?: string | null) {
  return callbackOverride(manual) ?? callbackInstant(statusListCallbackParts(action.days, action.time, action.weekdaysOnly, at));
}
