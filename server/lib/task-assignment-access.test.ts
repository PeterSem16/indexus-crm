import assert from "node:assert/strict";
import test from "node:test";
import { taskAssignmentAllowed, taskAssignmentPolicyVersionMatches } from "./task-assignment-access";

test("an unconfigured task allowlist preserves active-user behavior", () => {
  assert.equal(taskAssignmentAllowed("existing", true, false, []), true);
  assert.equal(taskAssignmentAllowed("new-user", true, false, []), true);
  assert.equal(taskAssignmentAllowed("inactive", false, false, []), false);
});

test("allowlist writes use optimistic timestamp comparison, including first configuration", () => {
  const version = new Date("2026-01-01T00:00:00.000Z");
  assert.equal(taskAssignmentPolicyVersionMatches(version.toISOString(), version), true);
  assert.equal(taskAssignmentPolicyVersionMatches("2026-01-01T00:00:01.000Z", version), false);
  assert.equal(taskAssignmentPolicyVersionMatches(null, null), true);
  assert.equal(taskAssignmentPolicyVersionMatches(null, version), false);
});

test("configured allowlists distinguish explicit none, selected IDs, revoked users, and future users", () => {
  assert.equal(taskAssignmentAllowed("any", true, true, []), false);
  const allowed = ["selected"];
  assert.equal(taskAssignmentAllowed("selected", true, true, allowed), true);
  assert.equal(taskAssignmentAllowed("revoked", true, true, allowed), false);
  assert.equal(taskAssignmentAllowed("new-user", true, true, allowed), false);
  assert.equal(taskAssignmentAllowed("selected", false, true, allowed), false);
});