import assert from "node:assert/strict";
import test from "node:test";
import {
  claimInboundCall,
  releaseInboundCallClaim,
  shouldIgnoreInboundCallNotification,
} from "./inbound-call-claim";

test("the same inbound call cannot be claimed or shown twice", () => {
  const claimed = new Set<string>();

  assert.equal(claimInboundCall(claimed, "call-1"), true);
  assert.equal(claimInboundCall(claimed, "call-1"), false);
  assert.equal(shouldIgnoreInboundCallNotification(claimed, "call-1"), true);
});

test("a failed SIP answer releases only its own call for a later retry", () => {
  const claimed = new Set(["call-1"]);

  releaseInboundCallClaim(claimed, "call-1");

  assert.equal(shouldIgnoreInboundCallNotification(claimed, "call-1"), false);
  assert.equal(claimInboundCall(claimed, "call-1"), true);
});

test("a bridge recovery makes the same re-queued call actionable again", () => {
  const claimed = new Set(["call-1"]);

  // The live browser invitation was accepted, but ARI could not build the
  // bridge and returned this same queue call for a new offer.
  releaseInboundCallClaim(claimed, "call-1");

  assert.equal(shouldIgnoreInboundCallNotification(claimed, "call-1"), false);
});

test("claiming one call does not suppress a different inbound call", () => {
  const claimed = new Set<string>();

  claimInboundCall(claimed, "call-1");

  assert.equal(shouldIgnoreInboundCallNotification(claimed, "call-2"), false);
});