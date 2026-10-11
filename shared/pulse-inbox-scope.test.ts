import assert from "node:assert/strict";
import { personalInboxTask, inboxScopeUrl } from "./pulse-inbox-scope";
import { isProtectedRecordTag, visibleRecordTags } from "./automation-record-tags";
import { buildValidatedTaskPatch } from "../server/lib/task-contract";

const mine = { createdByUserId: "agent", tags: ["pulse_mission:one"] };
assert.equal(personalInboxTask(mine, "agent", "one"), true);
assert.equal(personalInboxTask(mine, "agent", "two"), false);
assert.equal(personalInboxTask(mine, "other", "one"), false);
assert.equal(personalInboxTask(mine, "agent", null), false);
assert.equal(personalInboxTask(mine, "agent", undefined), true);
assert.equal(personalInboxTask({ createdByUserId: "agent" }, "agent", "one"), false);
assert.equal(personalInboxTask({ ...mine, tags: ["pulse_mission:one", "pulse_mission:two"] }, "agent", "one"), false);
const linked = { createdByUserId: "agent", relatedEntityType: "status_list_item", relatedEntityId: "step" };
const missions = new Map([["step", "one"]]);
assert.equal(personalInboxTask(linked, "agent", "one", missions), true);
assert.equal(personalInboxTask(linked, "agent", "two", missions), false);
assert.equal(personalInboxTask({ ...linked, tags: ["pulse_mission:two"] }, "agent", "two", missions), false);
assert.equal(inboxScopeUrl("/api/tasks/created", "one"), "/api/tasks/created?missionId=one");
assert.equal(inboxScopeUrl("/api/tasks/created", null), "/api/tasks/created?missionId=");
assert.equal(isProtectedRecordTag("pulse_mission:one"), true);
assert.deepEqual(visibleRecordTags(["pulse_mission:one", "VIP"]), ["VIP"]);
assert.deepEqual(buildValidatedTaskPatch({ tags: ["group_id:assigned"] }, ["pulse_mission:one", "old"]).tags,
  ["pulse_mission:one", "old", "group_id:assigned"]);
assert.throws(() => buildValidatedTaskPatch({ tags: ["pulse_mission:two"] }, ["pulse_mission:one"]));
console.log("Personal Inbox scope: ownership, exact Mission, missing/conflicting attribution and URL checks passed");
