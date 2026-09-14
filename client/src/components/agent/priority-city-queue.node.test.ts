import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPriorityQueueWithFallback, DEFAULT_PRIORITY_VIEW, getPriorityContactCityLocation,
  parsePriorityView, type PriorityContact, type PriorityView,
} from "./priority-builder";

const now = new Date("2026-09-14T08:00:00Z");
function contact(id: string, city?: string, country = "SK", extra: Partial<PriorityContact> = {}): PriorityContact {
  return {
    id, campaignId: "test", contactType: "customer", status: "pending",
    assignedTo: null, attemptCount: 0, priorityScore: 10,
    createdAt: now, updatedAt: now, customer: { firstName: id, city, country }, ...extra,
  } as PriorityContact;
}
const view: PriorityView = {
  ...DEFAULT_PRIORITY_VIEW,
  segments: [{ id: "referral", sort: "name_asc" }, { id: "new", sort: "priority" }],
  cityGrouping: { enabled: true, rankedKeys: ["AT:vienna", "SK:bratislava", "SK:zilina"], unknownKeys: [] },
};

test("first-match group outranks city and existing sort applies inside city", () => {
  const input = [
    contact("new-vienna", "Vienna", "AT"),
    contact("ref-zilina", "Žilina", "SK", { hasReferral: true }),
    contact("ref-B", "Bratislava", "SK", { hasReferral: true }),
    contact("ref-A", "Bratislava", "SK", { hasReferral: true }),
  ];
  const result = buildPriorityQueueWithFallback(input, view, "agent", now);
  assert.deepEqual(result.map(x => x.contact.id), ["ref-A", "ref-B", "ref-zilina", "new-vienna"]);
  assert.deepEqual(result.map(x => x.segment), ["referral", "referral", "referral", "new"]);
  assert.equal(new Set(result.map(x => x.contact.id)).size, input.length);
});

test("missing cities and fallback contacts are retained; saved city snapshots roundtrip", () => {
  const input = [
    contact("unknown"), contact("known", "Bratislava"),
    contact("fallback", "Žilina", "SK", { attemptCount: 5 }),
  ];
  const parsed = parsePriorityView(JSON.parse(JSON.stringify(view)))!;
  assert.ok(parsed.cityGrouping?.enabled);
  const result = buildPriorityQueueWithFallback(input, parsed, "agent", now);
  assert.deepEqual(result.map(x => x.contact.id), ["known", "unknown", "fallback"]);
  assert.equal(result[1].cityGroup?.key, null);
  assert.equal(result[2].segment, "other");
  const legacy = parsePriorityView(JSON.parse(JSON.stringify(DEFAULT_PRIORITY_VIEW)))!;
  assert.ok(!legacy.cityGrouping?.enabled);
  assert.ok(buildPriorityQueueWithFallback(input, legacy, "agent", now).every(x => !x.cityGroup));
});

test("entity locations are country-specific and collaborator enrichment is respected", () => {
  assert.notEqual(
    getPriorityContactCityLocation(contact("one", "Komarno", "SK"))?.key,
    getPriorityContactCityLocation(contact("two", "Komarno", "HU"))?.key,
  );
  const collaborator = contact("collab", "Wrong", "SK", {
    contactType: "collaborator", priorityCity: "Brno", priorityCountryCode: "CZ",
  });
  assert.equal(getPriorityContactCityLocation(collaborator)?.key, "CZ:brno");
});