import assert from "node:assert/strict";
import { isMissionContactInactive } from "./inactive-contact-call";

assert.equal(isMissionContactInactive("customer", { status: "inactive" }), true);
assert.equal(isMissionContactInactive("customer", { status: "active" }), false);
assert.equal(isMissionContactInactive("customer", { status: "pending" }), false);
assert.equal(isMissionContactInactive("clinic", { isActive: false }), true);
assert.equal(isMissionContactInactive("hospital", { isActive: false }), true);
assert.equal(isMissionContactInactive("collaborator", { isActive: false }), true);
assert.equal(isMissionContactInactive("clinic", { isActive: true }), false);
assert.equal(isMissionContactInactive("clinic", {}), false);
assert.equal(isMissionContactInactive("customer", null), false);

console.log("inactive Mission contact call tests passed");