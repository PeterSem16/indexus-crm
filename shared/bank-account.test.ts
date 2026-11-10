import assert from "node:assert/strict";
import test from "node:test";
import { calculateLocalIban } from "./bank-account";

test("SK and CZ published example accounts include the complete prefix", () => {
  assert.equal(calculateLocalIban("SK", "19-8742637541", "1200"), "SK3112000000198742637541");
  assert.equal(calculateLocalIban("CZ", "19-2000145399", "0800"), "CZ6508000000192000145399");
});
test("accounts without a prefix still produce a 24-character valid IBAN", () => {
  const iban = calculateLocalIban("SK", "1234567890", "0200");
  assert.equal(iban.length, 24);
  assert.equal(BigInt(iban.slice(4) + "2820" + iban.slice(2, 4)) % 97n, 1n);
  assert.equal(iban.slice(8, 14), "000000");
});
test("invalid input or an unsupported country never produces a fabricated IBAN", () => {
  for (const [country, account, bank] of [
    ["HU", "123", "0200"], ["SK", "", "0200"], ["SK", "1-2-3", "0200"],
    ["SK", "1234567-123", "0200"], ["SK", "12345678901", "0200"],
    ["SK", "123", "x200"], ["SK", "123", "200"],
  ]) assert.equal(calculateLocalIban(country, account, bank), "");
});
