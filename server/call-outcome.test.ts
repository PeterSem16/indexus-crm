import assert from "node:assert/strict";
import { eventsForCallOutcome, selectCallOutcomeBadges, type CallOutcomeHistoryEvent } from "./call-outcome";

const statusListItems = new Map([
  ["step-a", { label: "Prvý krok", color: "#16a34a" }],
  ["step-b", { label: "Posledná voľba", color: "#7c3aed" }],
]);
const dispositions = new Map([
  ["answered", { name: "Zodpovedané", color: "#16a34a" }],
  ["send_sms", { name: "SMS odoslaná", color: "#2563eb" }],
]);
const event = (createdAt: string, action: string, metadata: Record<string, any> = {}, notes: string | null = null): CallOutcomeHistoryEvent =>
  ({ createdAt, action, metadata, notes });

const batch = selectCallOutcomeBadges({
  events: [
    event("2026-09-09T10:01:00Z", "status_list_confirmation", { statusListItemId: "step-a", confirmed: true }),
    event("2026-09-09T10:02:00Z", "status_list_action", { actionType: "send_sms" }),
    event("2026-09-09T10:03:00Z", "status_list_confirmation", { statusListItemId: "step-b", confirmed: true }),
    event("2026-09-09T10:04:00Z", "status_list_action", { actionType: "set_callback", callbackDate: "2026-09-10T08:00:00Z" }),
  ],
  workflowMode: "status_list",
  statusListMode: "batch",
  statusListItems,
  dispositions,
});
assert.deepEqual(batch.map((badge) => badge.kind), ["status_list", "callback"]);
assert.equal(batch[0].label, "Posledná voľba");

const immediate = selectCallOutcomeBadges({
  events: [
    event("2026-09-09T10:01:00Z", "status_list_confirmation", { statusListItemId: "step-b", confirmed: true }),
    event("2026-09-09T10:02:00Z", "status_list_action", { actionType: "send_sms", dispositionCode: "send_sms" }),
  ],
  workflowMode: "status_list",
  statusListMode: "immediate",
  statusListItems,
  dispositions,
});
assert.deepEqual(immediate.map((badge) => badge.label), ["Posledná voľba"]);

const disposition = selectCallOutcomeBadges({
  events: [event("2026-09-09T10:01:00Z", "status_change", { dispositionCode: "answered" })],
  workflowMode: "disposition",
  statusListMode: "immediate",
  statusListItems,
  dispositions,
});
assert.deepEqual(disposition.map((badge) => badge.label), ["Zodpovedané"]);

const oldCallEvents = eventsForCallOutcome([
  event("2026-09-09T10:31:00Z", "status_list_confirmation", { statusListItemId: "step-b", confirmed: true }),
], "2026-09-09T10:00:00Z", "2026-09-09T10:00:00Z");
const oldCall = selectCallOutcomeBadges({
  events: oldCallEvents,
  workflowMode: "status_list",
  statusListMode: "batch",
  statusListItems,
  dispositions,
});
assert.deepEqual(oldCall, []);

console.log("4 call outcome scenarios passed");
