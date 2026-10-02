import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { inArray } from "drizzle-orm";
import { customers } from "@shared/schema";

test("scheduled matcher previews once and bounded per-record matches without actions", {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const [{ db, pool }, { scanScheduledRule }] = await Promise.all([
    import("../db"),
    import("./automation-engine"),
  ]);
  const testScore = 910000 + Math.floor(Math.random() * 8000);
  const smallIds: string[] = [];
  const capIds: string[] = [];
  const insertCustomers = async (count: number, offset: number, country: string) => {
    const rows = await db.insert(customers).values(Array.from({ length: count }, (_, index) => ({
      firstName: "Schedule test",
      lastName: `${offset + index}`,
      email: `schedule-${randomUUID()}@example.test`,
      country,
      leadScore: testScore,
      status: "active",
    }))).returning({ id: customers.id });
    return rows.map(row => row.id);
  };

  try {
    smallIds.push(...await insertCustomers(3, 0, "SK"));
    const czIds = await insertCustomers(1, 3, "CZ");
    smallIds.push(...czIds);
    const baseRule = {
      id: `schedule-preview-${randomUUID()}`,
      module: "customer",
      trigger: { type: "schedule", interval: "daily", mode: "per_record" },
      conditions: { field: "newValues.leadScore", op: "eq", value: testScore },
      actions: [],
      countryCode: null,
      countryCodes: ["SK"],
    } as any;
    const scoped = await scanScheduledRule(baseRule);
    assert.equal(scoped.matchedCount, 3);
    assert.equal(scoped.overLimit, false);
    assert.deepEqual(new Set(scoped.candidates.map(candidate => candidate.id)), new Set(smallIds.slice(0, 3)));
    assert.ok(scoped.candidates.every(candidate => candidate.countryCode === "SK"));
    assert.ok(scoped.candidates.every(candidate => !("email" in candidate.newValues)));

    const multiCountry = await scanScheduledRule({ ...baseRule, countryCodes: ["SK", "CZ"] });
    assert.equal(multiCountry.matchedCount, 4);
    assert.equal(multiCountry.candidates.length, 4);
    assert.ok(multiCountry.candidates.some(candidate => candidate.id === czIds[0] && candidate.countryCode === "CZ"));

    const legacyOnce = await scanScheduledRule({
      ...baseRule,
      trigger: { type: "schedule", interval: "daily" },
      conditions: null,
      actions: [],
    });
    assert.deepEqual({
      matchedCount: legacyOnce.matchedCount,
      overLimit: legacyOnce.overLimit,
      maxMatches: legacyOnce.maxMatches,
    }, { matchedCount: 1, overLimit: false, maxMatches: 100 });

    capIds.push(...await insertCustomers(101, 10, "SK"));
    const overCap = await scanScheduledRule(baseRule);
    assert.equal(overCap.matchedCount, 100);
    assert.equal(overCap.overLimit, true);
    assert.equal(overCap.maxMatches, 100);
  } finally {
    const ids = [...smallIds, ...capIds];
    if (ids.length) await db.delete(customers).where(inArray(customers.id, ids));
    await pool.end();
  }
});