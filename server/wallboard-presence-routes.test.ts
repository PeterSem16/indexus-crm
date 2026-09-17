import assert from "node:assert/strict";
import test from "node:test";
import { parseWallboardPresencePayload } from "./wallboard-presence-routes";

test("presence route accepts only the three strict fields", () => {
  assert.deepEqual(parseWallboardPresencePayload({
    sessionId: "s1", campaignId: "c1", working: true,
  }), { sessionId: "s1", campaignId: "c1", working: true });
  assert.equal(parseWallboardPresencePayload({
    sessionId: "s1", campaignId: "c1", working: "true",
  }), undefined);
  assert.equal(parseWallboardPresencePayload({
    sessionId: "s1", campaignId: "c1", working: true, userId: "spoof",
  }), undefined);
  assert.equal(parseWallboardPresencePayload(null), undefined);
  assert.equal(parseWallboardPresencePayload({
    sessionId: " ", campaignId: "c1", working: false,
  }), undefined);
});