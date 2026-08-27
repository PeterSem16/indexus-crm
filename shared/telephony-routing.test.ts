import assert from "node:assert/strict";
import {
  isO2ImsOutboundCallerId,
  normalizePhoneForRouting,
  resolveOutboundCallProvider,
} from "./telephony-routing";

assert.equal(normalizePhoneForRouting("00 421 222 133 230"), "+421222133230");
assert.equal(normalizePhoneForRouting("+421 (222) 133 239"), "+421222133239");
assert.equal(isO2ImsOutboundCallerId("+421222133230"), true);
assert.equal(isO2ImsOutboundCallerId("00421222133239"), true);
assert.equal(isO2ImsOutboundCallerId("+421940682394"), false);
assert.equal(isO2ImsOutboundCallerId("+421222133240"), false);
assert.equal(resolveOutboundCallProvider("+421222133235"), "O2-IMS");
assert.equal(resolveOutboundCallProvider("+421232399030"), undefined);

console.log("telephony-routing: 8 passed");