import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSmsPhone, uniqueSmsEntity } from "./sms-attribution";

test("phone normalization aligns local and international Slovak numbers", () => {
  assert.equal(normalizeSmsPhone("+421 905 123 456"), "905123456");
  assert.equal(normalizeSmsPhone("0905-123-456"), "905123456");
});

test("phone fallback assigns only one unique entity", () => {
  assert.deepEqual(uniqueSmsEntity([{ id: "c1", type: "clinic", name: "Clinic" }]), {
    id: "c1", type: "clinic", name: "Clinic",
  });
  assert.equal(uniqueSmsEntity([
    { id: "c1", type: "clinic" },
    { id: "h1", type: "hospital" },
  ]), null);
  assert.deepEqual(uniqueSmsEntity([
    { id: "c1", type: "clinic" },
    { id: "c1", type: "clinic" },
  ]), { id: "c1", type: "clinic" });
});