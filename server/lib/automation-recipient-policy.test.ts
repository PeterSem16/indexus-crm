import assert from "node:assert/strict";
import { isSharedBackOfficeRole, taskOwnersForTarget } from "./automation-recipient-policy";

assert.equal(isSharedBackOfficeRole({ name: "Back Office", legacyRole: null }), true);
assert.equal(isSharedBackOfficeRole({ name: "Other", legacyRole: "back_office" }), true);
assert.equal(isSharedBackOfficeRole({ name: "Call Center", legacyRole: null }), false);
assert.deepEqual(taskOwnersForTarget({ userIds: ["agent-a", "agent-b"], isBackOffice: true }), ["agent-a"]);
assert.deepEqual(taskOwnersForTarget({ userIds: ["agent-a", "agent-b"], isBackOffice: false }), ["agent-a", "agent-b"]);
console.log("Automation recipient policy tests passed");