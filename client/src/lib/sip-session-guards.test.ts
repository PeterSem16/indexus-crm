import assert from "node:assert/strict";
import {
  isCorrelatedInboundHangup,
  shouldCancelAfterRingGrace,
  shouldRecoverOutboundMediaAfterAnswer,
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

assert.equal(shouldRecoverOutboundMediaAfterAnswer({
  ringDurationMs: 9_900,
  earlyIceDegraded: false,
  postAnswerBidirectionalRtp: false,
  sessionState: "Established",
  isHeld: false,
  recoveryAttempted: false,
}), false, "a short ring without ICE failure does not force renegotiation");
assert.equal(shouldRecoverOutboundMediaAfterAnswer({
  ringDurationMs: 10_100,
  earlyIceDegraded: false,
  postAnswerBidirectionalRtp: false,
  sessionState: "Established",
  isHeld: false,
  recoveryAttempted: false,
}), true, "a long ring with no post-answer RTP refreshes ICE once");
assert.equal(shouldRecoverOutboundMediaAfterAnswer({
  ringDurationMs: 29_000,
  earlyIceDegraded: false,
  postAnswerBidirectionalRtp: true,
  sessionState: "Established",
  isHeld: false,
  recoveryAttempted: false,
}), false, "healthy long-ringing calls are never renegotiated");
assert.equal(shouldRecoverOutboundMediaAfterAnswer({
  ringDurationMs: 9_000,
  earlyIceDegraded: true,
  postAnswerBidirectionalRtp: false,
  sessionState: "Established",
  isHeld: false,
  recoveryAttempted: false,
}), true, "observed early-dialog ICE failure permits answer-time recovery");
assert.equal(shouldRecoverOutboundMediaAfterAnswer({
  ringDurationMs: 29_000,
  earlyIceDegraded: true,
  postAnswerBidirectionalRtp: false,
  sessionState: "Established",
  isHeld: true,
  recoveryAttempted: false,
}), false, "answer-time recovery cannot run on hold");
assert.equal(shouldRecoverOutboundMediaAfterAnswer({
  ringDurationMs: 29_000,
  earlyIceDegraded: true,
  postAnswerBidirectionalRtp: false,
  sessionState: "Terminated",
  isHeld: false,
  recoveryAttempted: false,
}), false, "answer-time recovery cannot run after termination");

console.log("SIP session correlation guards passed");