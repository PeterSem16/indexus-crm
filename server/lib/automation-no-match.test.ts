import assert from "node:assert/strict";
import { noMatchRoutingIssue, enterRuleEvaluation } from "./automation-no-match";
const rule = (id: string, next?: string, owner = "owner") => ({ id, createdByUserId: owner,
  module: "communication", trigger: { type: "event", eventType: "communication.received",
    analysis: { channels: ["email"] }, ...(next ? { noMatchRuleId: next } : {}) } });
assert.equal(noMatchRoutingIssue(rule("a"), []), null);
assert.equal(noMatchRoutingIssue(rule("a", "b"), [rule("b", "c"), rule("c")]), null);
assert.ok(noMatchRoutingIssue(rule("a", "a"), [rule("a")]));
assert.ok(noMatchRoutingIssue(rule("a", "b"), [rule("b", "a")]));
assert.ok(noMatchRoutingIssue(rule("a", "b"), [rule("b", undefined, "someone-else")]));
assert.ok(noMatchRoutingIssue(rule("a", "missing"), []));
assert.ok(noMatchRoutingIssue(rule("a", "b"), [{ ...rule("b"), trigger: { type: "schedule" } }]));
assert.ok(noMatchRoutingIssue(rule("a", "b"), [rule("b", "c"), rule("c", "d"), rule("d", "e"), rule("e", "f"), rule("f")]));
const visited = new Set<string>();
assert.ok(enterRuleEvaluation("a", { visited, path: [] }));
assert.ok(enterRuleEvaluation("b", { visited, path: ["a"] }));
assert.ok(!enterRuleEvaluation("a", { visited, path: ["a", "b"] }), "Do not re-enter a rule through a cycle");
assert.ok(!enterRuleEvaluation("b", { visited, path: [] }), "Normal dispatch must not repeat a routed rule");
assert.ok(!enterRuleEvaluation("z", { visited, path: ["a", "b", "c", "d", "e"] }));
console.log("No-match routing: default stop, valid chain, owner boundary, deleted target, schedules, cycles, depth and dispatch dedup passed.");
