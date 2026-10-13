import assert from "node:assert/strict";
import { recordEntryIssues, recordPhoneKey, uniqueRecordMatch } from "./automation-record-entry";
import { conditionChoiceSource } from "./automation-condition-catalog";
const config = { recordEntryVersion: 1, targetType: "auto", lookup: "configured", email: "contact@example.test", mode: "history", title: "Finding" };
assert.deepEqual(recordEntryIssues(config), []);
for (const bad of [null, [], {}, { ...config, email: {} }, { ...config, email: "{{communication.senderEmail}}" },
  { ...config, email: "", phone: "" }, { ...config, title: "" }, { ...config, targetType: "users" },
  { ...config, attachmentIds: ["untrusted"] }, { ...config, lookup: "guess" }]) assert.ok(recordEntryIssues(bad).length);
assert.deepEqual(recordEntryIssues({ ...config, onAmbiguous: { taskGroupId: "bo-group" } }), []);
assert.ok(recordEntryIssues({ ...config, onAmbiguous: { taskGroupId: "" } }).length);
assert.ok(recordEntryIssues({ ...config, onAmbiguous: { taskGroupId: "bo-group", customerId: "guessed" } }).length);
assert.equal(recordPhoneKey("+421 900 123 456", null), recordPhoneKey("00421900123456", null));
assert.equal(recordPhoneKey("0900 123 456", "SK"), recordPhoneKey("+421900123456", "SK"));
assert.notEqual(recordPhoneKey("0900123456", "SK"), recordPhoneKey("0900123456", "CZ"));
assert.equal(recordPhoneKey("06 1234567", "IT"), "e164:39061234567");
assert.equal(recordPhoneKey("123", "SK"), null);
assert.equal(recordPhoneKey("0900123456", null), null);
assert.throws(() => uniqueRecordMatch([]), /not_found/);
assert.throws(() => uniqueRecordMatch([1, 2]), /ambiguous/);
assert.throws(() => uniqueRecordMatch([1], true), /ambiguous/);
assert.equal(uniqueRecordMatch([1]), 1);
assert.deepEqual(conditionChoiceSource("communication", "communication.customerId")?.kind, "record");
assert.equal(conditionChoiceSource("communication", "communication.text"), null);
assert.equal(conditionChoiceSource("communication", "analysis.summary"), null);
assert.equal(conditionChoiceSource("clinic", "oldValues.initialStatus")?.kind, "values");
assert.equal(conditionChoiceSource("collection", "newValues.statusId")?.kind, "collection_status");
assert.equal(conditionChoiceSource("call", "newValues.queueId")?.kind, "queue");
console.log("Record-entry identity/config and IF choice tests passed");
