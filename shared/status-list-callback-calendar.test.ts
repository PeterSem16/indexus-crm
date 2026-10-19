import assert from "node:assert/strict";
import { statusListCallbackParts, statusListCallbackPrefill } from "./status-list-callback-calendar";

let checks = 0;
const check = (value: unknown, message: string) => { assert.ok(value, message); checks++; };
const cases: [string, number, boolean, string][] = [
  ["2026-10-16T10:00:00Z", 1, true, "2026-10-19"],
  ["2026-10-16T10:00:00Z", 1, false, "2026-10-17"],
  ["2026-10-17T10:00:00Z", 1, true, "2026-10-19"],
  ["2026-10-17T10:00:00Z", 1, false, "2026-10-18"],
  ["2026-10-18T10:00:00Z", 5, true, "2026-10-23"],
  ["2026-10-19T10:00:00Z", 5, true, "2026-10-26"],
  ["2026-10-19T10:00:00Z", 5, false, "2026-10-24"],
  ["2026-10-16T22:30:00Z", 1, false, "2026-10-18"],
  ["2026-10-23T10:00:00Z", 1, true, "2026-10-26"],
  ["2026-03-27T10:00:00Z", 1, true, "2026-03-30"],
  ["2026-12-31T10:00:00Z", 1, true, "2027-01-01"],
  ["2024-02-28T10:00:00Z", 1, false, "2024-02-29"],
  ["2026-10-16T10:00:00Z", 0, true, "2026-10-19"],
];
for (const [start, days, weekdays, expected] of cases) {
  const now = new Date(start);
  check(statusListCallbackPrefill({ callbackOffsetDays: days, callbackBusinessDaysOnly: weekdays }, now) === `${expected}T09:00`, `${start} + ${days}, weekdays=${weekdays}`);
  const p = statusListCallbackParts(days, "10:30", weekdays, now);
  check(p.hour === 10 && p.minute === 30, "Calendar mode never changes the configured time");
}
const friday = new Date("2026-10-16T10:00:00Z");
check(statusListCallbackPrefill({ callbackOffsetDays: 1 }, friday) === "2026-10-19T09:00", "Missing legacy setting retains business days");
check(statusListCallbackPrefill({ callbackOffsetDays: 1, callbackBusinessDaysOnly: null }, friday) === "2026-10-19T09:00", "Legacy nullable policy also retains business days");
check(statusListCallbackPrefill({ callbackOffsetDays: 1, callbackTime: "25:00", callbackBusinessDaysOnly: false }, friday) === "2026-10-17T09:00", "Invalid legacy time keeps the 09:00 fallback");
// Compare the optimized whole-week jumps against simple weekday iteration.
for (const start of ["2026-10-12T10:00:00Z", "2026-10-16T10:00:00Z", "2026-10-17T10:00:00Z", "2026-10-18T10:00:00Z"]) {
  for (const days of [1, 2, 4, 5, 6, 9, 10, 11, 99]) {
    const slow = new Date(start); let left = days;
    while (left) { slow.setUTCDate(slow.getUTCDate() + 1); if (![0, 6].includes(slow.getUTCDay())) left--; }
    check(statusListCallbackPrefill({ callbackOffsetDays: days }, new Date(start)).startsWith(slow.toISOString().slice(0, 10)), "Whole-week optimization equals ordinary weekday counting");
  }
}
check(statusListCallbackPrefill({ callbackOffsetDays: 100_000 }, friday).length >= 16, "Large offsets do not require day-by-day loops");
console.log(`Status List callback calendar: ${checks} assertions passed (${process.env.TZ || "default timezone"})`);
