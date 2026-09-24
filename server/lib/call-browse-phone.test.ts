import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUnambiguousCallBrowsePhoneIndex,
  getCallBrowsePhoneCandidateSuffixes,
  normalizeCallBrowsePhone,
} from "./call-browse-phone";

test("phone lookup canonicalizes local and international forms within a country", () => {
  const index = buildUnambiguousCallBrowsePhoneIndex([
    { id: "customer-1", type: "customer", name: "Client One", countryCode: "SK", phones: ["0905-123-456", null] },
  ]);

  assert.equal(normalizeCallBrowsePhone("+421 905 123 456"), "SK:905123456");
  assert.equal(index.get("SK:905123456")?.name, "Client One");
  assert.equal(index.get("SK:905123457"), undefined);
});

test("country-aware normalization does not collide across countries", () => {
  assert.equal(normalizeCallBrowsePhone("0905 123 456", "SK"), "SK:905123456");
  assert.equal(normalizeCallBrowsePhone("0905 123 456", "CZ"), "CZ:905123456");
  assert.notEqual(
    normalizeCallBrowsePhone("+421 905 123 456"),
    normalizeCallBrowsePhone("+420 905 123 456"),
  );
  assert.equal(normalizeCallBrowsePhone("0905 123 456"), null);
});

test("duplicate phone fields on one owner are not ambiguous", () => {
  const index = buildUnambiguousCallBrowsePhoneIndex([
    { id: "clinic-1", type: "clinic", name: "Clinic One", countryCode: "SK", phones: ["+421 905 123 456", "0905 123 456"] },
  ]);

  assert.deepEqual(index.get("SK:905123456"), {
    id: "clinic-1",
    type: "clinic",
    name: "Clinic One",
  });
});

test("shared numbers across records or entity types are not attributed", () => {
  const index = buildUnambiguousCallBrowsePhoneIndex([
    { id: "customer-1", type: "customer", name: "Client One", countryCode: "SK", phones: ["0905 123 456"] },
    { id: "clinic-1", type: "clinic", name: "Clinic One", countryCode: "SK", phones: ["+421 905 123 456"] },
    { id: "hospital-1", type: "hospital", name: "Hospital One", countryCode: "SK", phones: ["0905-123-456"] },
  ]);

  assert.equal(index.get("SK:905123456"), undefined);
});

test("countries remain distinct even when their national digits match", () => {
  const index = buildUnambiguousCallBrowsePhoneIndex([
    { id: "clinic-sk", type: "clinic", name: "Clinic SK", countryCode: "SK", phones: ["0905 123 456"] },
    { id: "clinic-cz", type: "clinic", name: "Clinic CZ", countryCode: "CZ", phones: ["0905 123 456"] },
  ]);

  assert.equal(index.get("SK:905123456")?.name, "Clinic SK");
  assert.equal(index.get("CZ:905123456")?.name, "Clinic CZ");
});

test("SQL candidate suffixes stay country-scoped and support variable-length national numbers", () => {
  const keys = [
    normalizeCallBrowsePhone("+421 905 123 456"),
    normalizeCallBrowsePhone("+39 02 1234 5678"),
    normalizeCallBrowsePhone("+420 905 123 456"),
  ].filter((key): key is string => !!key);

  assert.deepEqual(getCallBrowsePhoneCandidateSuffixes(keys, "SK"), ["905123456"]);
  assert.deepEqual(getCallBrowsePhoneCandidateSuffixes(keys, "IT"), ["0212345678"]);
  assert.deepEqual(getCallBrowsePhoneCandidateSuffixes(keys, "CZ"), ["905123456"]);
  assert.deepEqual(
    getCallBrowsePhoneCandidateSuffixes(["SK:905123456", "SK:905123456", "SK:90-5123456", "CZ:905123456"], "SK"),
    ["905123456"],
  );
});