import assert from "node:assert/strict";
import { test } from "node:test";
import type { RegistryPerson } from "@shared/healthcare-legal-entity";
import { sortRegistryPeopleForTimeline } from "./registry-roles-timeline";

const person = (key: string, validFrom: string | null, validTo: string | null, current = false): RegistryPerson =>
  ({ key, name: key, role: "Konateľ", kind: "statutory", validFrom, validTo, current });

test("timeline sorts newest starts first without promoting ongoing roles over chronology", () => {
  const oldCurrent = person("current", "2020-01-01", null, true);
  const recentEnded = person("ended", "2024-01-01", "2025-12-31");
  assert.deepEqual(sortRegistryPeopleForTimeline([oldCurrent, recentEnded]).map(p => p.key), ["ended", "current"]);
});

test("missing or invalid start falls back to end; wholly undated roles stay last", () => {
  const values = [
    person("undated", null, null),
    person("invalid", "not a date", "also invalid"),
    person("end-only", null, "2023-01-01"),
    person("bad-start", "invalid", "2025-01-01"),
  ];
  assert.deepEqual(sortRegistryPeopleForTimeline(values).map(p => p.key), ["bad-start", "end-only", "undated", "invalid"]);
});

test("timeline preserves duplicate-date source order and never mutates input", () => {
  const values = Object.freeze([
    Object.freeze(person("first", "2024-05-01", null, true)),
    Object.freeze(person("second", "2024-05-01", null)),
  ]);
  assert.deepEqual(sortRegistryPeopleForTimeline(values), [...values]);
  assert.deepEqual(values.map(p => p.key), ["first", "second"]);
});

test("the Unix epoch is a known date, not a missing date", () => {
  assert.deepEqual(sortRegistryPeopleForTimeline([
    person("missing", null, null), person("epoch", "1970-01-01", null),
  ]).map(p => p.key), ["epoch", "missing"]);
});

test("impossible calendar dates use a valid end fallback, not a normalized invented start", () => {
  assert.deepEqual(sortRegistryPeopleForTimeline([
    person("bad-calendar", "2026-02-31", "2019-01-01"),
    person("leap-day", "2024-02-29", null),
  ]).map(p => p.key), ["leap-day", "bad-calendar"]);
});
