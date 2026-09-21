import assert from "node:assert/strict";
import { resolveShiftLoginCampaignIds } from "./shift-login-selection";

assert.deepEqual(resolveShiftLoginCampaignIds([]), []);
assert.deepEqual(
  resolveShiftLoginCampaignIds(["mission-a", "mission-a", "mission-b"]),
  ["mission-a", "mission-b"],
);

console.log("shift login selection tests passed");