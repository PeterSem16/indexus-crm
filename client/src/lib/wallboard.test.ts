import { describe, expect, it } from "vitest";
import {
  getEffectiveWallboardServerTime,
  getWallboardElapsedSeconds,
  paginateWallboard,
  wallboardPageCount,
} from "@/components/wallboard/wallboard";

describe("wallboard clock and pagination helpers", () => {
  it("uses the server snapshot clock instead of the browser clock", () => {
    const generatedAt = "2025-01-01T00:00:00.000Z";
    const stateSince = "2024-12-31T23:59:00.000Z";
    const localFetch = Date.parse("2025-01-01T04:00:00.000Z");
    const localNow = localFetch + 5_000;

    const serverNow = getEffectiveWallboardServerTime(generatedAt, localFetch, localNow);
    expect(serverNow).toBe(Date.parse(generatedAt) + 5_000);
    expect(getWallboardElapsedSeconds(stateSince, serverNow!)).toBe(65);
  });

  it("returns unknown for a null or invalid state timestamp", () => {
    const serverNow = Date.parse("2025-01-01T00:01:00.000Z");
    expect(getWallboardElapsedSeconds(null, serverNow)).toBeNull();
    expect(getWallboardElapsedSeconds("not-a-date", serverNow)).toBeNull();
  });

  it("freezes elapsed time at the snapshot when data becomes stale", () => {
    const generatedAt = "2025-01-01T00:00:00.000Z";
    const fetchedAt = Date.parse("2025-01-01T00:00:02.000Z");
    const serverNow = getEffectiveWallboardServerTime(
      generatedAt,
      fetchedAt,
      Date.parse("2025-01-01T00:05:00.000Z"),
      true,
    );
    expect(serverNow).toBe(Date.parse(generatedAt));
    expect(getWallboardElapsedSeconds("2024-12-31T23:59:30.000Z", serverNow!)).toBe(30);
  });

  it("paginates every agent without hiding the fourth agent in a four-agent team", () => {
    const agents = ["one", "two", "three", "four"];
    expect(wallboardPageCount(agents.length)).toBe(1);
    expect(paginateWallboard(agents, 0)).toEqual(agents);
  });

  it("keeps larger teams accessible over six-card pages", () => {
    const agents = Array.from({ length: 13 }, (_, index) => index);
    expect(wallboardPageCount(agents.length)).toBe(3);
    expect(paginateWallboard(agents, 0)).toHaveLength(6);
    expect(paginateWallboard(agents, 2)).toEqual([12]);
  });
});