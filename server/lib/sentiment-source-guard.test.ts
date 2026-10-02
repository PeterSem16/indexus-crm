import assert from "node:assert/strict";
import { permitsSentimentSource } from "./sentiment-source-guard";

for (const source of ["inbound_call", "outbound_call", "task"]) {
  const event = { module: "communication", eventType: "sentiment.negative", newValues: { type: source } };
  assert.equal(permitsSentimentSource(null, event), false, `${source} must not activate legacy rules`);
  assert.equal(permitsSentimentSource({ field: "newValues.customerId", op: "is_not_null" }, event), false);
  assert.equal(permitsSentimentSource({ all: [
    { field: "newValues.type", op: "in", value: ["email", "sms"] },
  ] }, event), false);
  assert.equal(permitsSentimentSource({ all: [
    { field: "newValues.type", op: "in", value: [source] },
    { field: "newValues.customerId", op: "is_not_null" },
  ] }, event), true);
  assert.equal(permitsSentimentSource({ any: [
    { field: "newValues.type", op: "eq", value: source },
    { field: "newValues.customerId", op: "is_not_null" },
  ] }, event), false, "advanced OR must fail closed");
}
assert.equal(permitsSentimentSource(null, {
  module: "communication", eventType: "sentiment.negative", newValues: { type: "email" },
}), true);
console.log("Expanded sentiment sources require explicit selection");