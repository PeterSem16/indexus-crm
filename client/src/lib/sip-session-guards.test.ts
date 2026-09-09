import assert from "node:assert/strict";
import { isCorrelatedInboundHangup, shouldCancelAfterRingGrace } from "./sip-session-guards";

const inboundA = {};
const outboundB = {};

assert.equal(isCorrelatedInboundHangup({
  eventCallId: "A",
  activeCallId: "A",
  activeDirection: "inbound",
  activeSession: inboundA,
  currentSession: inboundA,
  finalizerSession: inboundA,
}), true, "the matching active inbound session accepts its server hangup");

assert.equal(isCorrelatedInboundHangup({
  eventCallId: "A",
  activeCallId: "A",
  activeDirection: "inbound",
  activeSession: inboundA,
  currentSession: outboundB,
  finalizerSession: outboundB,
}), false, "a stale inbound hangup cannot terminate a newer outbound session");

assert.equal(shouldCancelAfterRingGrace({ sameSession: true, sessionState: "Establishing" }), true);
assert.equal(shouldCancelAfterRingGrace({ sameSession: true, sessionState: "Established" }), false);
assert.equal(shouldCancelAfterRingGrace({ sameSession: false, sessionState: "Establishing" }), false);

console.log("SIP session correlation guards passed");