import assert from "node:assert/strict";
import { readSentimentSources, withSentimentSources } from "./sentiment-source-conditions";

const email = withSentimentSources(["email"], null);
assert.deepEqual(readSentimentSources(email), { channels: ["email"], extra: null, editable: true });
const both = withSentimentSources(["sms", "email"], { field: "newValues.campaignId", op: "eq", value: "mission" });
assert.deepEqual(readSentimentSources(both), {
  channels: ["email", "sms"],
  extra: { field: "newValues.campaignId", op: "eq", value: "mission" },
  editable: true,
});
const legacy = { any: [
  { field: "newValues.type", op: "eq", value: "email" },
  { field: "newValues.customerId", op: "is_not_null" },
] };
assert.deepEqual(readSentimentSources(legacy), { channels: [], extra: legacy, editable: false });
assert.deepEqual(readSentimentSources(null).channels, ["email", "sms"]);
const allSources = ["email", "sms", "inbound_call", "outbound_call", "task"] as const;
assert.deepEqual(readSentimentSources(withSentimentSources(allSources, null)).channels, [...allSources]);
assert.deepEqual(readSentimentSources(withSentimentSources(["outbound_call", "task"], null)).channels, ["outbound_call", "task"]);
assert.throws(() => withSentimentSources([], null));
console.log("Sentiment source selection tests passed");