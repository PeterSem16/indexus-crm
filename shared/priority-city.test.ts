import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCityLocation } from "./priority-city";

test("normalizes readable city labels into accent- and case-insensitive country keys", () => {
  assert.deepEqual(normalizeCityLocation("Slovakia", "  Bratislava  "), {
    key: "SK:bratislava",
    city: "Bratislava",
    countryCode: "SK",
  });
  assert.deepEqual(normalizeCityLocation("Česká republika", "  Praha  "), {
    key: "CZ:praha",
    city: "Praha",
    countryCode: "CZ",
  });
  assert.equal(
    normalizeCityLocation("Ceska republika", "Praha")?.countryCode,
    normalizeCityLocation("Česká republika", "Praha")?.countryCode,
  );
  assert.equal(
    normalizeCityLocation("Slovenska republika", "Bratislava")?.countryCode,
    "SK",
  );
  assert.equal(
    normalizeCityLocation("SK", "Bratislava")?.key,
    normalizeCityLocation("sk", "bratislava")?.key,
  );
});

test("keeps same-named cities separate by country and does not infer country", () => {
  assert.notEqual(
    normalizeCityLocation("US", "Springfield")?.key,
    normalizeCityLocation("GB", "Springfield")?.key,
  );
  assert.equal(normalizeCityLocation(undefined, "Springfield")?.key, "??:springfield");
  assert.equal(normalizeCityLocation(undefined, "Springfield")?.countryCode, "??");
  assert.notEqual(
    normalizeCityLocation("日本", "Tokyo")?.countryCode,
    "??",
  );
  assert.notEqual(
    normalizeCityLocation("Россия", "Moscow")?.countryCode,
    normalizeCityLocation("中国", "Moscow")?.countryCode,
  );
});

test("returns null only when the city is missing or unusable", () => {
  assert.equal(normalizeCityLocation("SK", undefined), null);
  assert.equal(normalizeCityLocation("SK", ""), null);
  assert.equal(normalizeCityLocation("SK", " \t "), null);
  assert.equal(normalizeCityLocation("SK", 42), null);
});