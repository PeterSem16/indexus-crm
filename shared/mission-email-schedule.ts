import { z } from "zod";

export const MISSION_EMAIL_REPORT = "mission_insights";
export const MISSION_EMAIL_TIMEZONE = "Europe/Bratislava";
export const missionEmailScheduleSchema = z.object({
  recipientUserIds: z.array(z.string().min(1).max(100)).min(1).max(100)
    .refine(values => new Set(values).size === values.length),
  sendTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  weekday: z.number().int().min(1).max(7).default(1),
  monthDay: z.number().int().min(1).max(31).default(1),
  country: z.string().regex(/^[A-Z]{2}$/),
  locale: z.enum(["en", "sk", "cs", "hu", "ro", "it", "de"]),
  enabled: z.boolean().default(false),
  includeExcel: z.boolean().default(false),
}).strict();
export type MissionEmailScheduleInput = z.infer<typeof missionEmailScheduleSchema>;
export type MissionEmailOptions = Pick<MissionEmailScheduleInput, "frequency" | "weekday" | "monthDay" | "country" | "locale">;
const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: MISSION_EMAIL_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: MISSION_EMAIL_TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
export function missionLocalDay(instant: Date): string {
  const parts = Object.fromEntries(dateFormat.formatToParts(instant).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function shiftMissionDay(day: string, count: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + count * 86_400_000).toISOString().slice(0, 10);
}
/** First occurrence of a repeated clock time. Missing DST clock times move forward. */
export function missionWallClock(day: string, time: string): Date {
  const wall = Date.parse(`${day}T${time}:00Z`);
  const candidates = [120, 60].map(offset => new Date(wall - offset * 60_000))
    .filter(value => missionLocalDay(value) === day && timeFormat.format(value) === time);
  if (candidates.length) return new Date(Math.min(...candidates.map(value => value.getTime())));
  for (let minute = 0; minute <= 180; minute++) {
    const value = new Date(wall - 120 * 60_000 + minute * 60_000);
    if (missionLocalDay(value) === day && timeFormat.format(value) >= time) return value;
  }
  throw new Error("Invalid Mission wall clock");
}
export function nextMissionEmailRun(input: Pick<MissionEmailScheduleInput, "frequency" | "weekday" | "monthDay" | "sendTime">, after = new Date()): Date {
  const day = missionLocalDay(after);
  for (let offset = 0; offset <= 370; offset++) {
    const candidateDay = shiftMissionDay(day, offset);
    const date = new Date(`${candidateDay}T12:00:00Z`);
    const weekday = date.getUTCDay() || 7;
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    if (input.frequency === "weekly" && weekday !== input.weekday) continue;
    if (input.frequency === "monthly" && date.getUTCDate() !== Math.min(input.monthDay, lastDay)) continue;
    const instant = missionWallClock(candidateDay, input.sendTime);
    if (instant > after) return instant;
  }
  throw new Error("No next Mission report slot");
}
export function missionEmailPeriod(frequency: MissionEmailOptions["frequency"], now = new Date()) {
  const today = missionLocalDay(now);
  let from = shiftMissionDay(today, -1), to = from;
  if (frequency === "weekly") {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() || 7;
    from = shiftMissionDay(today, -(weekday - 1) - 7);
    to = shiftMissionDay(from, 6);
  } else if (frequency === "monthly") {
    const first = today.slice(0, 8) + "01";
    to = shiftMissionDay(first, -1);
    from = to.slice(0, 8) + "01";
  }
  return { from, to, start: missionWallClock(from, "00:00"), end: missionWallClock(shiftMissionDay(to, 1), "00:00") };
}
