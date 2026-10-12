import assert from "node:assert/strict";
import { parseWebhook, parseWebhookBatch, bulkGateDeliveryStatus } from "./bulkgate";

const inbound = parseWebhook({
  status: 10, sms_id: "test-incoming", from: "+421000000001",
  to: "+421000000002", text: "fixture", tag: "outbound-id",
});
assert.equal(inbound.type, "inbox");
assert.equal(inbound.smsId, "test-incoming");
assert.equal(inbound.number, "+421000000001");
assert.equal(inbound.recipientPhone, "+421000000002");
assert.equal(inbound.tag, "outbound-id");
assert.equal(parseWebhook({ status: "3", smsid: "sent-id", number: "+421000000001" }).type, "delivery_report");
assert.equal(parseWebhook({ sms_id: "legacy-id", number: "+421000000001", message: "fixture" }).smsId, "legacy-id");
assert.equal(parseWebhook({ status: "10", number: "+421000000001", text: "fixture" }).recipientPhone, undefined);
assert.equal(parseWebhook({ status: "10", number: "+421000000001", to: { invalid: true } }).recipientPhone, undefined);
assert.equal(parseWebhook({ status: "1", smsID: "provider-dlr" }).smsId, "provider-dlr");
const mixed = parseWebhookBatch([
  { status: "1", smsID: "provider-dlr" },
  { status: "10", from: "421000000001", to: "421000000002", message: "actual provider shape" },
]);
assert.deepEqual(mixed.map(r => r.type), ["delivery_report", "inbox"]);
assert.equal(mixed[1].text, "actual provider shape");
assert.equal(mixed[1].number, "421000000001");
assert.throws(() => parseWebhookBatch([]));
assert.throws(() => parseWebhookBatch([{ status: "10" }]));
assert.throws(() => parseWebhook([]));
assert.equal(bulkGateDeliveryStatus("1"), "delivered");
assert.equal(bulkGateDeliveryStatus("2"), "pending");
assert.equal(bulkGateDeliveryStatus("3"), "failed");
assert.equal(bulkGateDeliveryStatus("13"), "read");
console.log("BulkGate webhook: inbound identity, explicit recipient, legacy idempotency ID and delivery-report separation PASSED");
