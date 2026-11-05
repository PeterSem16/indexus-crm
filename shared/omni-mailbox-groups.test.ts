import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMailboxScope, validateMailboxGroups } from "./omni-mailbox-groups";
const mailboxes = [{ type: "personal", email: "me@example.test" }, { type: "shared", email: "support@example.test" }, { type: "shared", email: "billing@example.test" }];
const allowed = new Set(mailboxes.map(m => m.email));
const groups = [{ id: "care", name: "Support", emails: ["me@example.test", "support@example.test", "revoked@example.test"] }, { id: "empty", name: "Empty", emails: [] }];
test("group search intersects live inventory, maps personal, and never widens empty/missing groups", () => {
  assert.deepEqual(resolveMailboxScope("group:care", groups, mailboxes), ["personal", "support@example.test"]);
  assert.deepEqual(resolveMailboxScope("group:empty", groups, mailboxes), []);
  assert.deepEqual(resolveMailboxScope("group:deleted", groups, mailboxes), []);
  assert.deepEqual(resolveMailboxScope("other@example.test", groups, mailboxes), []);
  assert.deepEqual(resolveMailboxScope("all", groups, mailboxes), ["personal", "support@example.test", "billing@example.test"]);
});
test("names and addresses normalize; accounts can belong to multiple groups", () => {
  assert.deepEqual(validateMailboxGroups([{ id: "a", name: " A ", emails: [" SUPPORT@example.test ", "support@example.test"] }], allowed),
    [{ id: "a", name: "A", emails: ["support@example.test"] }]);
  assert.equal(validateMailboxGroups([{ id: "a", name: "A", emails: ["support@example.test"] }, { id: "b", name: "B", emails: ["support@example.test"] }], allowed).length, 2);
});
test("forged, duplicate, oversized, invalid and revoked entries are rejected", () => {
  for (const invalid of [null, {}, [{ id: "../x", name: "X", emails: [] }], [{ id: "a", name: " ", emails: [] }],
    [{ id: "a", name: "A", emails: ["revoked@example.test"] }], [{ id: "a", name: "A", emails: [42] }],
    [{ id: "a", name: "A", emails: [] }, { id: "a", name: "B", emails: [] }],
    Array.from({ length: 31 }, (_, i) => ({ id: `g${i}`, name: "A", emails: [] }))]) {
    assert.throws(() => validateMailboxGroups(invalid, allowed));
  }
});
