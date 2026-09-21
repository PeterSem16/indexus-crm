import assert from "node:assert/strict";
import {
  isPersonnelDialingEnabled,
  resolvePersonnelCallTimelineAction,
} from "./personnel-call-attribution";

assert.equal(isPersonnelDialingEnabled(null), false);
assert.equal(isPersonnelDialingEnabled("{}"), false);
assert.equal(isPersonnelDialingEnabled('{"enablePersonnelDialing":"true"}'), false);
assert.equal(isPersonnelDialingEnabled('{"enablePersonnelDialing":1}'), false);
assert.equal(isPersonnelDialingEnabled('{"enablePersonnelDialing":true}'), true);
assert.equal(isPersonnelDialingEnabled({ enablePersonnelDialing: true }), true);
assert.equal(isPersonnelDialingEnabled("{broken"), false);

assert.equal(resolvePersonnelCallTimelineAction("initiated"), null);
assert.equal(resolvePersonnelCallTimelineAction("answered"), "call_answered");
assert.equal(resolvePersonnelCallTimelineAction("completed"), "call_answered");
assert.equal(resolvePersonnelCallTimelineAction("failed"), "call_failed");
assert.equal(resolvePersonnelCallTimelineAction("no_answer"), "call_missed");

console.log("personnel call attribution tests passed");