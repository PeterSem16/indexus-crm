import assert from "node:assert/strict";
import { test } from "node:test";
import { callBrowseDisplayName } from "./call-browse-identity";

test("unanswered institution calls display the clinic or hospital name without a recording", () => {
  assert.equal(callBrowseDisplayName({ entityName: "Clinic A", customerName: null, phoneNumber: "123" }), "Clinic A");
  assert.equal(callBrowseDisplayName({ entityName: "Hospital B", customerName: null, phoneNumber: "456" }), "Hospital B");
});

test("customer calls display the customer name and unknown calls retain the number", () => {
  assert.equal(callBrowseDisplayName({ entityName: null, customerName: "Customer C", phoneNumber: "123" }), "Customer C");
  assert.equal(callBrowseDisplayName({ entityName: null, customerName: null, phoneNumber: "456" }), "456");
});