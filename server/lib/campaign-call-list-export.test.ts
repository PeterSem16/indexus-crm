import test from "node:test";
import assert from "node:assert/strict";
import { campaignCallListEventsToExportRows } from "./campaign-call-list-export";

test("call-list exports project screen events and preserve timestamps, durations, and forwarding", () => {
  const rows = campaignCallListEventsToExportRows([
    {
      type: "call",
      agent: "Agent One",
      customer: "Customer One",
      phoneNumber: "+421900000001",
      direction: "inbound",
      status: "completed",
      startedAt: "2026-09-24T10:00:00.000Z",
      answeredAt: "2026-09-24T10:00:05.000Z",
      endedAt: "2026-09-24T10:01:05.000Z",
      ringTimeFormatted: "0:05",
      talkTimeFormatted: "1:00",
      totalDurationFormatted: "1:05",
      disposition: "sale",
      dispositionName: "Sale",
      hungUpBy: "agent",
      notes: "Follow-up",
      isForwarded: true,
    },
    {
      type: "call",
      agent: "Agent Two",
      customer: "Customer Two",
      phoneNumber: "+421900000002",
      direction: "inbound",
      status: "abandoned",
      startedAt: "2026-09-24T11:00:00.000Z",
      answeredAt: "",
      endedAt: "2026-09-24T11:00:30.000Z",
      ringTimeFormatted: "0:30",
      talkTimeFormatted: "0:00",
      totalDurationFormatted: "0:30",
      hungUpBy: "",
      notes: "",
      isForwarded: false,
    },
    { type: "email", agent: "Agent One" },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0]["Started At"], "2026-09-24T10:00:00.000Z");
  assert.equal(rows[0]["Answered At"], "2026-09-24T10:00:05.000Z");
  assert.equal(rows[0]["Talk Time"], "1:00");
  assert.equal(rows[0].Forwarded, "Yes");
  assert.equal(rows[0].Disposition, "Sale");
  assert.equal(rows[1]["Talk Time"], "0:00");
  assert.equal(rows[1].Forwarded, "No");
});