import assert from "node:assert/strict";
import type { CallLog } from "@shared/schema";
import {
  outboundCallEventValues,
  outboundCallTransitions,
  verifiedOutboundAgentId,
  writeOutboundCallEvents,
} from "./outbound-call-automation";

const log = (values: Partial<CallLog> = {}): CallLog => ({
  id: "persisted-call-id",
  userId: "agent-id",
  customerId: null,
  campaignId: "mission-id",
  campaignContactId: null,
  phoneNumber: "+421900000000",
  direction: "outbound",
  status: "initiated",
  startedAt: new Date("2025-01-01T10:00:00Z"),
  answeredAt: null,
  endedAt: null,
  durationSeconds: 0,
  hungUpBy: null,
  sipCallId: "provider-id-is-not-identity",
  notes: null,
  metadata: null,
  inboundQueueId: null,
  inboundQueueName: null,
  inboundCallLogId: null,
  isImportant: false,
  isForwarded: false,
  forwardedToNumber: null,
  createdAt: new Date("2025-01-01T10:00:00Z"),
  ...values,
});

assert.deepEqual(outboundCallTransitions(null, log()), ["outbound.started"]);
assert.deepEqual(outboundCallTransitions(log(), log({
  status: "answered",
  answeredAt: new Date("2025-01-01T10:00:10Z"),
})), ["outbound.answered"]);
assert.deepEqual(outboundCallTransitions(log({ status: "answered", answeredAt: new Date() }), log({
  status: "completed",
  answeredAt: new Date("2025-01-01T10:00:10Z"),
  endedAt: new Date("2025-01-01T10:00:30Z"),
  durationSeconds: 20,
})), ["outbound.completed"]);
// Regression for POST /api/mobile/call-log/:id/duration: completed alone is
// not evidence of answer, even when a duration is supplied. Ambiguous
// completion must not be relabeled unanswered either.
assert.deepEqual(outboundCallTransitions(log(), log({
  status: "completed",
  endedAt: new Date("2025-01-01T10:00:30Z"),
  durationSeconds: 30,
})), []);
assert.deepEqual(outboundCallTransitions(log(), log({
  status: "completed",
  endedAt: new Date("2025-01-01T10:00:30Z"),
  durationSeconds: 0,
})), []);
assert.deepEqual(outboundCallTransitions(null, log({
  status: "completed",
  endedAt: new Date("2025-01-01T10:00:30Z"),
  durationSeconds: 0,
})), ["outbound.started"]);
assert.deepEqual(outboundCallTransitions(log(), log({
  status: "completed",
  answeredAt: new Date("2025-01-01T10:00:10Z"),
  endedAt: new Date("2025-01-01T10:00:30Z"),
  durationSeconds: 20,
})), ["outbound.answered", "outbound.completed"]);
// A prior persisted answered state is sufficient evidence even if the final
// completed row does not retain answeredAt.
assert.deepEqual(outboundCallTransitions(log({ status: "answered" }), log({
  status: "completed",
  endedAt: new Date("2025-01-01T10:00:30Z"),
  durationSeconds: 30,
})), ["outbound.completed"]);
assert.deepEqual(outboundCallTransitions(log(), log({ status: "no_answer", endedAt: new Date() })), [
  "outbound.unanswered",
]);
assert.deepEqual(outboundCallTransitions(log(), log({ status: "busy", endedAt: new Date() })), [
  "outbound.unanswered",
]);

// Duplicate saved-state retries do not represent a fresh transition; event-bus
// emit-once additionally protects concurrent/replayed storage updates.
const answered = log({ status: "answered", answeredAt: new Date() });
assert.deepEqual(outboundCallTransitions(answered, answered), []);
const completed = log({ status: "completed", answeredAt: new Date(), endedAt: new Date() });
assert.deepEqual(outboundCallTransitions(completed, completed), []);
const unanswered = log({ status: "no_answer", endedAt: new Date() });
assert.deepEqual(outboundCallTransitions(unanswered, unanswered), []);

assert.deepEqual(outboundCallTransitions(null, log({ direction: "inbound" })), []);
assert.deepEqual(outboundCallTransitions(null, log({ id: "" })), []);
assert.deepEqual(outboundCallTransitions(null, undefined), []);
// A call provider ID does not replace the canonical persisted primary key.
assert.deepEqual(outboundCallTransitions(null, log({ id: "  " })), []);

// Mobile collaborator IDs are not users-table recipients. The lifecycle still
// has its canonical call identity, but it carries no agent recipient or actor.
const collaboratorCall = log({ userId: "collaborator-only-id" });
const collaboratorAgentId = verifiedOutboundAgentId(collaboratorCall.userId, null);
assert.equal(collaboratorAgentId, null);
assert.deepEqual(outboundCallTransitions(null, collaboratorCall), ["outbound.started"]);
const collaboratorEventValues = outboundCallEventValues(collaboratorCall, collaboratorAgentId);
assert.equal(collaboratorEventValues.callId, collaboratorCall.id);
assert.equal(collaboratorEventValues.agentId, null);
const recordedEvents: Array<{ eventType: string; entityId: string | null; newValues: any; actorUserId: string | null }> = [];
await writeOutboundCallEvents(
  collaboratorCall,
  outboundCallTransitions(null, collaboratorCall),
  collaboratorAgentId,
  null,
  async (input, _dedupeKey) => {
    recordedEvents.push({
      eventType: input.eventType,
      entityId: input.entityId || null,
      newValues: input.newValues,
      actorUserId: input.actorUserId || null,
    });
    return "event-id";
  },
);
assert.equal(recordedEvents.length, 1);
assert.equal(recordedEvents[0].eventType, "outbound.started");
assert.equal(recordedEvents[0].entityId, collaboratorCall.id);
assert.equal(recordedEvents[0].newValues.agentId, null);
assert.equal(recordedEvents[0].actorUserId, null);
assert.deepEqual(outboundCallTransitions(log(), log({
  userId: "collaborator-only-id",
  status: "no_answer",
  endedAt: new Date(),
})), ["outbound.unanswered"]);

// Matching IDs are accepted only when supplied by the users-row lookup.
assert.equal(verifiedOutboundAgentId("user-1", "user-1"), "user-1");
assert.equal(verifiedOutboundAgentId("collaborator-1", "user-1"), null);

console.log("Outbound call lifecycle transition tests passed");