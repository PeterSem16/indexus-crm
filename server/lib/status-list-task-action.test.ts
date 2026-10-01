import assert from "node:assert/strict";
import { resolveStatusListGroupTaskOwners } from "./status-list-task-action";

assert.deepEqual(
  resolveStatusListGroupTaskOwners(["member-1", "member-2", "member-3"], true),
  ["member-1"],
  "a Back Office group routes a confirmation to one shared-queue task",
);
assert.deepEqual(
  resolveStatusListGroupTaskOwners(["member-1", "member-2", "member-3"], false),
  ["member-1", "member-2", "member-3"],
  "an ordinary group still assigns one task to each member",
);
assert.deepEqual(
  resolveStatusListGroupTaskOwners(["triggering-agent"], true),
  ["triggering-agent"],
  "an empty-membership fallback still yields one Back Office task",
);
assert.deepEqual(
  resolveStatusListGroupTaskOwners(["member-1", "member-2"], undefined),
  ["member-1", "member-2"],
  "a missing group record retains the legacy per-member behavior",
);

console.log("Status List task group routing parity passed");