import assert from "node:assert/strict";
import test from "node:test";
import { normalizePhonePreferenceKey } from "./phone-preference-key";

test("treats plus and 00 international phone formats as the same number", () => {
  assert.equal(
    normalizePhonePreferenceKey("+421 918 751 470"),
    normalizePhonePreferenceKey("00421 918 751 470"),
  );
});

test("does not merge numbers from different international country prefixes", () => {
  assert.notEqual(
    normalizePhonePreferenceKey("+421 900 123 456"),
    normalizePhonePreferenceKey("+420 900 123 456"),
  );
});

test("keeps an unqualified local number separate from an international number", () => {
  assert.notEqual(
    normalizePhonePreferenceKey("0900 123 456"),
    normalizePhonePreferenceKey("+421 900 123 456"),
  );
});