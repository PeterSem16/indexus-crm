import assert from "node:assert/strict";
import {
  isCorrelatedInboundHangup,
  shouldApplyEstablishedSessionEffects,
  shouldCancelAfterRingGrace,
} from "./sip-session-guards";

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
assert.equal(shouldCancelAfterRingGrace({
  sameSession: true,
  sessionState: "Establishing",
  finalResponseReceived: true,
}), false, "max-ring must not CANCEL while an accepted late offer is creating ICE and ACK");
assert.equal(shouldApplyEstablishedSessionEffects({
  sameSession: true,
  ownsFinalizer: true,
}), true, "the current owned session may activate shared call state");
assert.equal(shouldApplyEstablishedSessionEffects({
  sameSession: false,
  ownsFinalizer: true,
}), false, "a stale established session cannot mutate a newer call");
assert.equal(shouldApplyEstablishedSessionEffects({
  sameSession: true,
  ownsFinalizer: false,
}), false, "an already-finalized session cannot reactivate shared call state");

console.log("SIP session correlation guards passed");