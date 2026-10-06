import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTaskCreateAssignment, taskGroupNominalOwner } from "./task-create-assignment";

describe("Exclusive task creation assignment", () => {
  it("accepts a group-only target and a personal-only target", () => {
    assert.deepEqual(parseTaskCreateAssignment({ groupId: "it" }), { kind: "group", groupId: "it" });
    assert.deepEqual(parseTaskCreateAssignment({ assignedUserId: "person" }), { kind: "person", assignedUserId: "person" });
  });
  it("rejects mixed targets even when a caller bypasses the picker", () => {
    for (const extra of [
      { assignedUserId: "person" }, { assignedUserIds: ["person"] },
      { tags: ["group_id:other"] }, { tags: ["group:Other"] },
    ]) assert.throws(() => parseTaskCreateAssignment({ groupId: "it", ...extra }), /either/);
  });
  it("rejects missing or malformed targets", () => {
    for (const body of [{}, { groupId: "" }, { groupId: [] }, { assignedUserId: "" }, { assignedUserId: 12 }]) {
      assert.throws(() => parseTaskCreateAssignment(body));
    }
  });
  it("keeps legacy personal requests available for other task consumers", () => {
    assert.deepEqual(parseTaskCreateAssignment({ assignedUserId: "person", tags: ["group_id:it"] }),
      { kind: "person", assignedUserId: "person" });
  });
  it("uses an approved group member even if the creating agent is outside the group", () => {
    assert.equal(taskGroupNominalOwner("agent", ["person-b", "person-a"]), "person-a");
    assert.equal(taskGroupNominalOwner("person-b", ["person-b", "person-a"]), "person-b");
    assert.throws(() => taskGroupNominalOwner("agent", []), /no approved active/);
  });
});
