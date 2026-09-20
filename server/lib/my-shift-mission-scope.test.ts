import assert from "node:assert/strict";
import test from "node:test";
import { activityBelongsToMission } from "./my-shift-mission-scope";

test("keeps communication activity only in its exact Mission", () => {
  const fmo = JSON.stringify({ campaignId: "fmo", subject: "Follow-up" });
  assert.equal(activityBelongsToMission(fmo, "fmo"), true);
  assert.equal(activityBelongsToMission(fmo, "medical"), false);
});

test("does not leak unattributed or malformed activity into a Mission", () => {
  assert.equal(activityBelongsToMission(JSON.stringify({ subject: "No Mission" }), "fmo"), false);
  assert.equal(activityBelongsToMission("not-json", "fmo"), false);
  assert.equal(activityBelongsToMission(null, "fmo"), false);
});