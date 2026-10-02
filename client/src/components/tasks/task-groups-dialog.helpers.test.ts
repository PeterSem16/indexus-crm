import assert from "node:assert/strict";
import {
  createEmptyTaskGroupForm,
  createTaskGroupForm,
  createTaskGroupPayload,
  isTaskGroupFormDirty,
} from "./task-groups-dialog.helpers";

const empty = createEmptyTaskGroupForm();
assert.equal(empty.color, "#3b82f6");
assert.deepEqual(empty.memberUserIds, []);

const existing = createTaskGroupForm({
  name: "Support",
  description: "  ",
  color: "#10b981",
  icon: "headset",
  displayAlias: "SUP",
  isBackOffice: true,
  members: [
    { userId: "inactive-user", fullName: "Former teammate" },
    { userId: "active-user", fullName: "Current teammate" },
  ],
});
assert.deepEqual(existing.memberUserIds, ["inactive-user", "active-user"]);
assert.equal(existing.icon, "headset");
assert.equal(existing.isBackOffice, true);

const reorderedIds = { ...existing, memberUserIds: ["active-user", "inactive-user"] };
assert.equal(isTaskGroupFormDirty(reorderedIds, existing), false);
assert.equal(isTaskGroupFormDirty({ ...existing, name: "Changed" }, existing), true);

assert.deepEqual(createTaskGroupPayload({
  ...existing,
  name: "  Support  ",
  description: "  Follow-ups  ",
  displayAlias: "  SUP  ",
  memberUserIds: ["inactive-user", "inactive-user", "active-user"],
}), {
  name: "Support",
  description: "Follow-ups",
  color: "#10b981",
  icon: "headset",
  memberUserIds: ["inactive-user", "active-user"],
  isBackOffice: true,
  displayAlias: "SUP",
});

console.log("task group dialog helpers tests passed");