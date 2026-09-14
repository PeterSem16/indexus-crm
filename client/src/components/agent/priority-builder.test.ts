import { describe, expect, it } from "vitest";
import {
  buildPriorityQueue,
  DEFAULT_PRIORITY_VIEW,
  buildPriorityQueueWithFallback,
  filterPriorityContacts,
  matchesPrioritySegment,
  parsePriorityView,
  PRIORITY_PRESETS,
  sortPriorityContacts,
  type PriorityContact,
} from "./priority-builder";

const now = new Date("2025-01-15T12:00:00.000Z");
const contact = (id: string, values: Partial<PriorityContact> = {}): PriorityContact => ({
  id,
  campaignId: "campaign",
  contactType: "customer",
  status: "pending",
  assignedTo: null,
  attemptCount: 0,
  priorityScore: 50,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
  customer: { firstName: id, lastName: "Contact" },
  ...values,
});

describe("priority builder pure queue functions", () => {
  it("matches the available campaign-contact segment fields", () => {
    expect(matchesPrioritySegment(contact("referral", { hasReferral: true }), "referral", "agent", now)).toBe(true);
    expect(matchesPrioritySegment(contact("today", { status: "callback_scheduled", callbackDate: now }), "scheduled_today", "agent", now)).toBe(true);
    expect(matchesPrioritySegment(contact("new"), "new", "agent", now)).toBe(true);
    expect(matchesPrioritySegment(contact("mine", { status: "callback_scheduled", assignedTo: "agent", callbackDate: now }), "my_scheduled", "agent", now)).toBe(true);
    expect(matchesPrioritySegment(contact("missed", { attemptCount: 2 }), "unhandled", "agent", now)).toBe(true);
  });

  it("classifies Scheduled today in the Europe/Bratislava work timezone", () => {
    const bratislavaTodayAfterUtcMidnight = contact("today-boundary", {
      status: "callback_scheduled",
      callbackDate: new Date("2025-01-14T23:30:00.000Z"),
    });
    const bratislavaTomorrowBeforeUtcMidnight = contact("tomorrow-boundary", {
      status: "callback_scheduled",
      callbackDate: new Date("2025-01-15T23:30:00.000Z"),
    });
    expect(matchesPrioritySegment(bratislavaTodayAfterUtcMidnight, "scheduled_today", "agent", now)).toBe(true);
    expect(matchesPrioritySegment(bratislavaTomorrowBeforeUtcMidnight, "scheduled_today", "agent", now)).toBe(false);
  });

  it("deduplicates in segment order, not source order", () => {
    const first = contact("first", { hasReferral: true, attemptCount: 2 });
    const second = contact("second");
    const queue = buildPriorityQueue([second, first], DEFAULT_PRIORITY_VIEW, "agent", now);
    expect(queue.map(item => item.contact.id)).toEqual(["first", "second"]);
    expect(queue.map(item => item.segment)).toEqual(["referral", "new"]);
  });

  it("keeps unmatched eligible contacts in the fallback while direct search sees them", () => {
    const unmatched = contact("unmatched", { status: "callback_scheduled", callbackDate: new Date("2026-04-01T12:00:00Z") });
    const queue = buildPriorityQueueWithFallback([unmatched], DEFAULT_PRIORITY_VIEW, "agent", now);
    expect(queue.map(item => item.segment)).toEqual(["other"]);
    expect(filterPriorityContacts([unmatched], "unmatched", "name").map(item => item.id)).toEqual(["unmatched"]);
  });

  it("sorts null dates deterministically and uses name/id tie breaks", () => {
    const sorted = sortPriorityContacts([
      contact("z", { callbackDate: null }),
      contact("a", { callbackDate: now }),
      contact("b", { callbackDate: now }),
    ], "callback_asc");
    expect(sorted.map(item => item.id)).toEqual(["a", "b", "z"]);
  });

  it("ships four protected presets and defaults to Referral first", () => {
    expect(PRIORITY_PRESETS).toHaveLength(4);
    expect(PRIORITY_PRESETS.every(preset => !!preset.presetId)).toBe(true);
    expect(DEFAULT_PRIORITY_VIEW.name).toBe("Referral first");
    expect(parsePriorityView(JSON.parse(JSON.stringify(DEFAULT_PRIORITY_VIEW)))).toMatchObject({ name: "Referral first" });
    expect(parsePriorityView({ version: 1, name: "unsafe", segments: [{ id: "unknown", sort: "priority" }] })).toBeNull();
  });
});