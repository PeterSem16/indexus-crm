import { test } from "node:test";
import assert from "node:assert/strict";
import { missionEmailScheduleSchema, missionEmailPeriod, nextMissionEmailRun, missionWallClock } from "./mission-email-schedule";
const input = { recipientUserIds: ["user"], sendTime: "08:00", frequency: "daily" as const, weekday: 1, monthDay: 31, country: "SK", locale: "sk" as const, enabled: false };
test("schedule validates recipients, real clock values, recurrence and language", () => {
  assert.equal(missionEmailScheduleSchema.parse(input).enabled, false);
  for (const patch of [{ recipientUserIds: [] }, { recipientUserIds: ["u", "u"] }, { sendTime: "25:00" }, { sendTime: "12:60" },
    { weekday: 0 }, { monthDay: 32 }, { frequency: "hourly" }, { locale: "xx" }, { externalEmails: ["invalid"] }]) {
    assert.equal(missionEmailScheduleSchema.safeParse({ ...input, ...patch }).success, false);
  }
});
test("external-only recipients are validated, normalized and bounded with internal recipients", () => {
  const parsed = missionEmailScheduleSchema.parse({ ...input, recipientUserIds: [],
    externalEmails: [" External@Example.test ", "external@example.test"] });
  assert.deepEqual(parsed.externalEmails, ["external@example.test"]);
  assert.deepEqual(parsed.recipientUserIds, []);
  assert.equal(missionEmailScheduleSchema.safeParse({ ...input, recipientUserIds: [], externalEmails: [] }).success, false);
  assert.equal(missionEmailScheduleSchema.safeParse({ ...input, externalEmails: ["user@example.test\r\nBcc:other@example.test"] }).success, false);
  assert.equal(missionEmailScheduleSchema.safeParse({ ...input, recipientUserIds: Array.from({ length: 100 }, (_, i) => `user-${i}`),
    externalEmails: ["external@example.test"] }).success, false);
});
for (const [now, expected] of [["2026-11-02T06:00:00Z", "2026-11-02T07:00:00.000Z"],
  ["2026-07-02T05:00:00Z", "2026-07-02T06:00:00.000Z"],
  ["2026-11-02T07:00:00Z", "2026-11-03T07:00:00.000Z"]]) {
  test(`daily clock ${now}`, () => assert.equal(nextMissionEmailRun(input, new Date(now)).toISOString(), expected));
}
test("weekly chooses the configured weekday, not seven elapsed days", () => {
  assert.equal(nextMissionEmailRun({ ...input, frequency: "weekly", weekday: 5 }, new Date("2026-11-02T10:00Z")).toISOString(), "2026-11-06T07:00:00.000Z");
});
test("monthly clamps 31 to short month and respects leap years", () => {
  for (const [year, day] of [[2026, "28"], [2028, "29"]] as const)
    assert.equal(nextMissionEmailRun({ ...input, frequency: "monthly" }, new Date(`${year}-02-01T10:00Z`)).toISOString(), `${year}-02-${day}T07:00:00.000Z`);
});
test("DST gaps move forward and repeated time uses first occurrence", () => {
  assert.equal(missionWallClock("2026-03-29", "02:30").toISOString(), "2026-03-29T01:00:00.000Z");
  assert.equal(missionWallClock("2026-10-25", "02:30").toISOString(), "2026-10-25T00:30:00.000Z");
  assert.equal(nextMissionEmailRun({ ...input, sendTime: "02:30" }, new Date("2026-10-25T00:31Z")).toISOString(), "2026-10-26T01:30:00.000Z");
});
test("periods are previous closed Bratislava calendar periods", () => {
  const now = new Date("2026-11-02T07:00Z");
  for (const [frequency, from, to] of [["daily", "2026-11-01", "2026-11-01"], ["weekly", "2026-10-26", "2026-11-01"], ["monthly", "2026-10-01", "2026-10-31"]] as const) {
    const result = missionEmailPeriod(frequency, now);
    assert.equal(result.from, from); assert.equal(result.to, to);
  }
  const spring = missionEmailPeriod("daily", new Date("2026-03-30T06:00Z"));
  assert.equal(spring.end.getTime() - spring.start.getTime(), 23 * 3600000);
  const autumn = missionEmailPeriod("daily", new Date("2026-10-26T07:00Z"));
  assert.equal(autumn.end.getTime() - autumn.start.getTime(), 25 * 3600000);
});
