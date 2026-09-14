import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPriorityQueueWithFallback, DEFAULT_PRIORITY_VIEW, getPriorityContactCityLocation,
  isPriorityReferral, parsePriorityView, type PriorityContact, type PriorityView,
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
  const legacy = parsePriorityView({ version: 1, name: "Legacy", segments: [{ id: "new", sort: "priority" }] })!;
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

test("selected city mode is a strict authoritative allow-list, including empty and unknown buckets", () => {
  const input = [
    contact("bratislava", "Bratislava"),
    contact("same-name-hu", "Bratislava", "HU"),
    contact("unknown"),
  ];
  const selected = {
    ...view,
    cityGrouping: {
      ...view.cityGrouping!,
      mode: "selected" as const,
      selectedKeys: ["SK:bratislava"],
    },
  };
  assert.deepEqual(
    buildPriorityQueueWithFallback(input, selected, "agent", now).map(item => item.contact.id),
    ["bratislava"],
  );
  assert.deepEqual(
    buildPriorityQueueWithFallback(input, {
      ...selected,
      cityGrouping: { ...selected.cityGrouping!, selectedKeys: [] },
    }, "agent", now),
    [],
  );
  assert.deepEqual(
    buildPriorityQueueWithFallback(input, {
      ...selected,
      cityGrouping: { ...selected.cityGrouping!, selectedKeys: ["__unknown__"] },
    }, "agent", now).map(item => item.contact.id),
    ["unknown"],
  );
});

test("legacy city snapshots parse as all cities and new cities remain outside a selected snapshot", () => {
  const legacy = parsePriorityView({
    ...view,
    cityGrouping: {
      enabled: true,
      rankedKeys: ["SK:bratislava"],
      unknownKeys: [],
    },
  })!;
  assert.equal(legacy.cityGrouping?.mode, "all");
  const selected = parsePriorityView({
    ...legacy,
    cityGrouping: { ...legacy.cityGrouping!, mode: "selected", selectedKeys: ["SK:bratislava"] },
  })!;
  const withNewCity = [contact("old", "Bratislava"), contact("new", "Trnava")];
  assert.deepEqual(
    buildPriorityQueueWithFallback(withNewCity, selected, "agent", now).map(item => item.contact.id),
    ["old"],
  );
});

test("referrals require an explicit zero attempt and leave the Referral group when scheduled", () => {
  const fresh = contact("fresh-referral", undefined, "SK", { hasReferral: true, attemptCount: 0 });
  const unknownCount = contact("unknown-count", undefined, "SK", { hasReferral: true, attemptCount: undefined });
  const rescheduled = contact("rescheduled-referral", "Bratislava", "SK", {
    hasReferral: true,
    attemptCount: 2,
    status: "callback_scheduled",
    callbackDate: new Date("2026-09-15T08:00:00Z"),
  });
  const zeroScheduled = contact("zero-scheduled-referral", "Bratislava", "SK", {
    hasReferral: true,
    attemptCount: 0,
    status: "callback_scheduled",
    callbackDate: new Date("2026-09-15T08:00:00Z"),
  });
  const result = buildPriorityQueueWithFallback([
    unknownCount, rescheduled, zeroScheduled, fresh,
  ], {
    ...DEFAULT_PRIORITY_VIEW,
    cityGrouping: undefined,
    segments: [
      { id: "referral", sort: "name_asc" },
      { id: "scheduled_today", sort: "callback_asc" },
      { id: "new", sort: "created_desc" },
    ],
  }, "agent", now);
  assert.deepEqual(result.map(item => [item.contact.id, item.segment]), [
    ["fresh-referral", "referral"],
    ["rescheduled-referral", "other"],
    ["unknown-count", "other"],
    ["zero-scheduled-referral", "other"],
  ]);
  assert.equal(result.find(item => item.contact.id === "zero-scheduled-referral")?.segment, "other");
  assert.equal(result.find(item => item.contact.id === "rescheduled-referral")?.segment, "other");
  assert.equal(isPriorityReferral(rescheduled), true);
  assert.equal(isPriorityReferral(zeroScheduled), true);
});

test("a referral with a callback date cannot fall into New even when its status is still pending", () => {
  const callbackPending = contact("callback-pending", undefined, "SK", {
    hasReferral: true,
    attemptCount: 0,
    status: "pending",
    callbackDate: new Date("2026-09-15T08:00:00Z"),
  });
  const result = buildPriorityQueueWithFallback([callbackPending], {
    ...DEFAULT_PRIORITY_VIEW,
    segments: [{ id: "referral", sort: "priority" }, { id: "new", sort: "created_desc" }],
  }, "agent", now);
  assert.equal(result[0]?.segment, "other");
});

test("referral partitioning is applied within each city without changing city or segment precedence", () => {
  const input = [
    contact("ordinary-a", "Bratislava", "SK", { priorityScore: 100 }),
    contact("referral-a", "Bratislava", "SK", { hasReferral: true, priorityScore: 1 }),
    contact("referral-b", "Vienna", "AT", { hasReferral: true, priorityScore: 1 }),
    contact("ordinary-b", "Vienna", "AT", { priorityScore: 100 }),
  ];
  const result = buildPriorityQueueWithFallback(input, {
    ...DEFAULT_PRIORITY_VIEW,
    segments: [{ id: "new", sort: "priority", referralsFirst: true }],
    cityGrouping: { enabled: true, rankedKeys: ["SK:bratislava", "AT:vienna"], unknownKeys: [] },
  }, "agent", now);
  assert.deepEqual(result.map(item => item.contact.id), [
    "referral-a", "ordinary-a", "referral-b", "ordinary-b",
  ]);
  assert.ok(isPriorityReferral(result[0].contact));
  assert.ok(isPriorityReferral(result[2].contact));
});

test("disabled referral toggles preserve the configured ordinary sort", () => {
  const input = [
    contact("ordinary", "Bratislava", "SK", { priorityScore: 100 }),
    contact("referral", "Bratislava", "SK", { hasReferral: true, priorityScore: 1 }),
  ];
  const result = buildPriorityQueueWithFallback(input, {
    ...DEFAULT_PRIORITY_VIEW,
    segments: [{ id: "new", sort: "priority", referralsFirst: false }],
  }, "agent", now);
  assert.deepEqual(result.map(item => item.contact.id), ["ordinary", "referral"]);
});

test("legacy segments normalize referral priority to enabled on parse and serialization", () => {
  const parsed = parsePriorityView({
    ...DEFAULT_PRIORITY_VIEW,
    segments: [{ id: "new", sort: "name_asc" }],
  })!;
  assert.equal(parsed.segments[0].referralsFirst, true);
  assert.equal(JSON.parse(JSON.stringify(parsed)).segments[0].referralsFirst, true);
});