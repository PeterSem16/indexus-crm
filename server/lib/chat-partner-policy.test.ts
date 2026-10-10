import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildChatPolicy, chatPairAllowed, validateChatSelections } from "./chat-partner-policy";

test("unconfigured users retain their directory; self is excluded", () => {
  const policy = buildChatPolicy([{ userId: "a", chatUserIds: null }]);
  assert.equal(chatPairAllowed(policy, "a", "b"), true);
  assert.equal(chatPairAllowed(policy, "a", "a"), false);
});
test("configured assignments restrict every direction without role bypass", () => {
  const policy = buildChatPolicy([{ userId: "a", chatUserIds: ["b"] }]);
  assert.equal(chatPairAllowed(policy, "a", "b"), true);
  assert.equal(chatPairAllowed(policy, "b", "a"), true);
  assert.equal(chatPairAllowed(policy, "a", "admin"), false);
  assert.equal(chatPairAllowed(policy, "admin", "a"), false);
});
test("unconfigured Missions do not widen explicit lists; configured Missions union", () => {
  const policy = buildChatPolicy([
    { userId: "a", chatUserIds: ["b"] }, { userId: "a", chatUserIds: null },
    { userId: "a", chatUserIds: ["c"] },
  ]);
  assert.equal(chatPairAllowed(policy, "a", "b"), true);
  assert.equal(chatPairAllowed(policy, "a", "c"), true);
  assert.equal(chatPairAllowed(policy, "a", "d"), false);
});
test("explicit empty lists disable chat and both participants must permit it", () => {
  const policy = buildChatPolicy([{ userId: "a", chatUserIds: ["b"] }, { userId: "b", chatUserIds: [] }]);
  assert.equal(chatPairAllowed(policy, "a", "b"), false);
});
test("validate selection membership, inactive targets, self, shape; preserve null and empty", () => {
  const users = new Set(["a", "b"]);
  assert.deepEqual({ ...validateChatSelections({ a: ["b", "b"] }, ["a"], users) }, { a: ["b"] });
  assert.deepEqual({ ...validateChatSelections({ a: [] }, ["a"], users) }, { a: [] });
  assert.deepEqual({ ...validateChatSelections({ a: null }, ["a"], users) }, { a: null });
  for (const input of [{ a: ["a"] }, { a: ["inactive"] }, { b: [] }, [], { a: "b" }]) {
    assert.throws(() => validateChatSelections(input, ["a"], users));
  }
});
