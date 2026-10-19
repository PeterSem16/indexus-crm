export const STATUS_LIST_CALLBACK_TIMEZONE = "Europe/Bratislava";

export type StatusListCallbackCalendar = {
  callbackOffsetDays?: number | null;
  callbackTime?: string | null;
  callbackBusinessDaysOnly?: boolean | null;
};

/** Calendar arithmetic in the operation's timezone, independent of browser/server
 * timezone and DST. Missing policy preserves the original Monday–Friday behavior.
 * An explicit manual date is handled separately and is never adjusted here.
 */
export function statusListCallbackParts(
  offsetDays: number = 1, timeStr?: string | null, businessDaysOnly: boolean = true,
  now = new Date(), timeZone = STATUS_LIST_CALLBACK_TIMEZONE,
) {
  if (!Number.isFinite(offsetDays) || !Number.isInteger(offsetDays) || !Number.isFinite(now.getTime())) throw new RangeError("Invalid callback calendar input");
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (name: string) => Number(parts.find(value => value.type === name)?.value);
  const cursor = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  // Retain the existing minimum one-day offset, including legacy saved zeroes.
  let remaining = Math.max(1, offsetDays);
  if (businessDaysOnly === false) cursor.setUTCDate(cursor.getUTCDate() + remaining);
  else {
    while (remaining > 0) {
      if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6 && remaining >= 5) {
        const weeks = Math.floor(remaining / 5);
        cursor.setUTCDate(cursor.getUTCDate() + weeks * 7);
        remaining -= weeks * 5;
      } else {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) remaining--;
      }
    }
  }
  if (!Number.isFinite(cursor.getTime())) throw new RangeError("Callback offset is outside the calendar range");
  let hour = 9, minute = 0;
  if (typeof timeStr === "string" && /^\d{1,2}:\d{2}$/.test(timeStr)) {
    const [h, m] = timeStr.split(":").map(Number);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) { hour = h; minute = m; }
  }
  return { year: cursor.getUTCFullYear(), month0: cursor.getUTCMonth(), day: cursor.getUTCDate(), hour, minute };
}

export function statusListCallbackPrefill(automation: StatusListCallbackCalendar, now = new Date()): string {
  const p = statusListCallbackParts(automation.callbackOffsetDays ?? 1, automation.callbackTime, automation.callbackBusinessDaysOnly !== false, now);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${p.year}-${pad(p.month0 + 1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}
