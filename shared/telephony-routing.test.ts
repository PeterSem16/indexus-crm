import assert from "node:assert/strict";
import {
  isO2ImsOutboundCallerId,
  normalizePhoneForRouting,
  resolveOutboundCallProvider,
  resolveMissionOutboundRouting,
  validateMissionOutboundSettings,
} from "./telephony-routing";

assert.equal(normalizePhoneForRouting("00 421 222 133 230"), "+421222133230");
assert.equal(normalizePhoneForRouting("+421 (222) 133 239"), "+421222133239");
assert.equal(isO2ImsOutboundCallerId("+421222133230"), true);
assert.equal(isO2ImsOutboundCallerId("00421222133239"), true);
assert.equal(isO2ImsOutboundCallerId("+421940682394"), false);
assert.equal(isO2ImsOutboundCallerId("+421222133240"), false);
assert.equal(resolveOutboundCallProvider("+421222133235"), "O2-IMS");
assert.equal(resolveOutboundCallProvider("+421232399030"), undefined);
assert.deepEqual(
  resolveMissionOutboundRouting({
    settings: JSON.stringify({
      outboundRoutingByCountry: {
        SK: { trunk: "o2-ims", callerIdId: "o2-sk-virtual-1" },
      },
    }),
    countryCode: "SK",
    legacyCallerIdNumber: "+421222133235",
  }),
  {
    trunk: "o2-ims",
    callerIdId: "o2-sk-virtual-1",
    callerIdNumber: "+421940682394",
    provider: "O2-IMS",
    source: "mission",
  },
);
assert.deepEqual(
  resolveMissionOutboundRouting({
    settings: { outboundRoutingByCountry: { SK: { trunk: "sk-existing" } } },
    countryCode: "SK",
    legacyCallerIdNumber: "+421222133235",
  }),
  {
    trunk: "sk-existing",
    callerIdNumber: "+421222133235",
    source: "mission",
  },
);
assert.equal(
  validateMissionOutboundSettings({
    outboundRoutingByCountry: { SK: { trunk: "o2-ims", callerIdId: "missing" } },
  }),
  "O2 IMS requires an active outbound Caller ID assigned to the Mission",
);

console.log("telephony-routing: 11 passed");