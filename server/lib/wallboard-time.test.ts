import assert from "node:assert/strict";
import test from "node:test";
import {
  selectNewestWallboardSession,
  startOfBratislavaDay,
  wallboardSessionIncludesMission,
  unionWallboardSessionSeconds,
} from "./wallboard-time";

const at = (value: string) => new Date(value);

test("union counts ended, open, and abandoned sessions without double counting", () => {
  const now = at("2024-05-15T12:00:00.000Z");
  const day = at("2024-05-15T00:00:00.000Z");
  assert.equal(unionWallboardSessionSeconds([
    { startedAt: at("2024-05-15T08:00:00.000Z"), endedAt: at("2024-05-15T09:00:00.000Z"), lastActiveAt: null },
    // Overlaps the ended interval by 30 minutes.
    { startedAt: at("2024-05-15T08:30:00.000Z"), endedAt: at("2024-05-15T10:00:00.000Z"), lastActiveAt: null },
    // Disconnected open session stops at its heartbeat checkpoint.
    { startedAt: at("2024-05-15T10:30:00.000Z"), endedAt: null, lastActiveAt: at("2024-05-15T11:00:00.000Z") },
    // Only a connected current session may accrue through now.
    { startedAt: at("2024-05-15T11:30:00.000Z"), endedAt: null, lastActiveAt: at("2024-05-15T11:40:00.000Z"), accruing: true },
  ], day, now, now), 3 * 3600);
});

test("day boundaries follow Bratislava DST offsets", () => {
  // Spring-forward day is 23 hours; autumn fallback day is 25 hours.
  const spring = startOfBratislavaDay(at("2024-03-31T12:00:00.000Z"));
  const springNext = startOfBratislavaDay(at("2024-04-01T12:00:00.000Z"));
  assert.equal(spring.toISOString(), "2024-03-30T23:00:00.000Z");
  assert.equal((springNext.getTime() - spring.getTime()) / 3600000, 23);

  const autumn = startOfBratislavaDay(at("2024-10-27T12:00:00.000Z"));
  const autumnNext = startOfBratislavaDay(at("2024-10-28T12:00:00.000Z"));
  assert.equal(autumn.toISOString(), "2024-10-26T22:00:00.000Z");
  assert.equal((autumnNext.getTime() - autumn.getTime()) / 3600000, 25);
});

test("intervals clip to today and do not accrue before session start", () => {
  const now = at("2024-05-15T01:00:00.000Z");
  const day = at("2024-05-15T00:00:00.000Z");
  assert.equal(unionWallboardSessionSeconds([
    { startedAt: at("2024-05-14T23:00:00.000Z"), endedAt: at("2024-05-15T00:30:00.000Z"), lastActiveAt: null },
    { startedAt: at("2024-05-15T00:45:00.000Z"), endedAt: null, lastActiveAt: at("2024-05-15T01:30:00.000Z"), accruing: true },
  ], day, now, now), 2700);
});

test("mission scope is exact and newest open session wins", () => {
  const selected = { campaignId: "mission-a", campaignIds: ["mission-a", "mission-b"] };
  assert.equal(wallboardSessionIncludesMission(selected, "mission-a"), true);
  assert.equal(wallboardSessionIncludesMission(selected, "mission-c"), false);

  const old = { id: "old", startedAt: at("2024-05-15T08:00:00.000Z") };
  const newest = { id: "newest", startedAt: at("2024-05-15T09:00:00.000Z") };
  assert.equal(selectNewestWallboardSession([old, newest])?.id, "newest");
});
