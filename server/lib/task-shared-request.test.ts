import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTaskCreateAssignment } from "./task-create-assignment";
import { buildValidatedTaskPatch, canAccessTaskByPolicy, collectTaskParticipantIds } from "./task-contract";

describe("Shared request recipients", () => {
  it("preserves one combined target and deduplicates recipients", () => {
    assert.deepEqual(parseTaskCreateAssignment({ recipients: { groupIds: ["bo", "it", "bo"], userIds: ["a", "b", "a"] } }),
      { kind: "shared", groupIds: ["bo", "it"], userIds: ["a", "b"] });
  });
  it("accepts group-only or person-only shared requests", () => {
    assert.equal(parseTaskCreateAssignment({ recipients: { groupIds: [], userIds: ["a"] } }).kind, "shared");
    assert.equal(parseTaskCreateAssignment({ recipients: { groupIds: ["bo"], userIds: [] } }).kind, "shared");
  });
  it("rejects empty, malformed, oversized and ambiguous targets", () => {
    for (const recipients of [null, [], {}, { groupIds: [], userIds: [] }, { groupIds: [" "], userIds: [] },
      { groupIds: [], userIds: [null] }, { groupIds: Array(31).fill("bo"), userIds: [] }]) {
      assert.throws(() => parseTaskCreateAssignment({ recipients }));
    }
    assert.throws(() => parseTaskCreateAssignment({ recipients: { groupIds: ["bo"], userIds: ["a"] }, assignedUserId: "forged" }));
  });
  it("shares access with every selected group and direct recipient, never another country", () => {
    const row = { country: "SK", assignedUserId: "nominal", createdByUserId: "creator", tags: ["group_id:bo", "group_id:it"], requestRecipients: { userIds: ["a", "b"] } };
    const person = (id: string, country = "SK") => ({ id, role: "user", assignedCountries: [country] });
    assert.ok(canAccessTaskByPolicy(person("a"), row));
    assert.ok(canAccessTaskByPolicy(person("b"), row));
    assert.ok(canAccessTaskByPolicy(person("it-member"), row, new Set(["it"])));
    assert.ok(canAccessTaskByPolicy(person("bo-member"), row, new Set(["bo"])));
    assert.ok(!canAccessTaskByPolicy(person("a", "CZ"), row));
    assert.ok(!canAccessTaskByPolicy(person("stranger"), row));
    assert.ok(!canAccessTaskByPolicy(person("foreign", "CZ"), row, new Set(["it"])));
  });
  it("keeps shared routing during ordinary edits but rejects forged recipients and extra groups", () => {
    const tags = ["group_id:bo", "group_id:it", "manual_pulse_task"];
    assert.deepEqual(buildValidatedTaskPatch({ title: "Edited", tags }, tags).tags, ["manual_pulse_task", "group_id:bo", "group_id:it"]);
    assert.throws(() => buildValidatedTaskPatch({ tags: [...tags, "group_id:secret"] }, tags));
    assert.throws(() => buildValidatedTaskPatch({ requestRecipients: { userIds: ["stranger"] } }, tags));
  });
  it("resolves direct-recipient names alongside historical participants", () => {
    assert.deepEqual(collectTaskParticipantIds([{ assignedUserId: "owner", createdByUserId: "creator", requestRecipients: { userIds: ["a", "b"] } }]),
      ["creator", "owner", "a", "b"]);
  });
});
