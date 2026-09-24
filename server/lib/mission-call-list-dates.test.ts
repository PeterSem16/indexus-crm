import test from "node:test";
import assert from "node:assert/strict";
import { missionCallListDateBounds } from "./mission-call-list-dates";
import { isMissionInboundOnlyCall } from "./mission-call-list-scope";

test("Full Call List bounds include Bratislava 00:30 on the selected date", () => {
  const bounds = missionCallListDateBounds("2026-09-24", "2026-09-24");
  assert.equal(bounds.dateFrom?.toISOString(), "2026-09-23T22:00:00.000Z");
  assert.equal(bounds.dateToExclusive?.toISOString(), "2026-09-24T22:00:00.000Z");
  const inbound = {
    campaignId: null,
    callLogId: null,
    inboundCallLogId: "inbound-early",
    startedAt: new Date("2026-09-23T22:30:00.000Z"), // 00:30 CEST, 24 Sep
    assignedAgentId: null,
    status: "abandoned",
    metadata: { campaignId: "mission-1" },
  };
  assert.equal(isMissionInboundOnlyCall({
    inbound,
    canonicalCallLogIds: new Set(),
    filters: {
      campaignId: "mission-1",
      dateFrom: bounds.dateFrom,
      dateToExclusive: bounds.dateToExclusive,
    },
  }), true);
});

test("Full Call List bounds handle the 23-hour Bratislava spring DST day", () => {
  const bounds = missionCallListDateBounds("2026-03-29", "2026-03-29");
  assert.equal(bounds.dateFrom?.toISOString(), "2026-03-28T23:00:00.000Z");
  assert.equal(bounds.dateToExclusive?.toISOString(), "2026-03-29T22:00:00.000Z");
  assert.equal(bounds.dateToExclusive!.getTime() - bounds.dateFrom!.getTime(), 23 * 60 * 60 * 1000);
});

test("Full Call List bounds handle the 25-hour Bratislava autumn DST day", () => {
  const bounds = missionCallListDateBounds("2026-10-25", "2026-10-25");
  assert.equal(bounds.dateFrom?.toISOString(), "2026-10-24T22:00:00.000Z");
  assert.equal(bounds.dateToExclusive?.toISOString(), "2026-10-25T23:00:00.000Z");
  assert.equal(bounds.dateToExclusive!.getTime() - bounds.dateFrom!.getTime(), 25 * 60 * 60 * 1000);
});

test("Full Call List date filters reject malformed and impossible dates", () => {
  for (const value of ["2026-9-24", "09/24/2026", "2026-02-29", "2026-13-01"]) {
    assert.throws(() => missionCallListDateBounds(value, undefined), /valid YYYY-MM-DD/);
  }
});