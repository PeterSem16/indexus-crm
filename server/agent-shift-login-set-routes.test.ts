import assert from "node:assert/strict";
import { filterAllowedShiftLoginScope } from "./agent-shift-login-set-routes";

const filtered = filterAllowedShiftLoginScope(
  {
    name: "  Morning set  ",
    campaignIds: ["mission-a", "mission-a", "mission-revoked"],
    inboundQueueIds: ["queue-a", "queue-revoked", "queue-a"],
    backOffice: true,
  },
  new Set(["mission-a"]),
  new Set(["queue-a"]),
);

assert.deepEqual(filtered, {
  name: "Morning set",
  campaignIds: ["mission-a"],
  inboundQueueIds: ["queue-a"],
  backOffice: true,
});

const empty = filterAllowedShiftLoginScope(
  {
    name: "Revoked",
    campaignIds: ["mission-revoked"],
    inboundQueueIds: ["queue-revoked"],
    backOffice: false,
  },
  new Set(),
  new Set(),
);

assert.deepEqual(empty.campaignIds, []);
assert.deepEqual(empty.inboundQueueIds, []);

console.log("agent shift login set scope tests passed");