import assert from "node:assert/strict";
import { parseWebhook } from "./bulkgate";

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
console.log("BulkGate webhook: inbound identity, explicit recipient, legacy idempotency ID and delivery-report separation PASSED");
