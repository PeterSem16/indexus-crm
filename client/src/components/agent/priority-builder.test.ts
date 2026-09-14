import { describe, expect, it } from "vitest";
import {
  buildPriorityQueue,
  DEFAULT_PRIORITY_VIEW,
  buildPriorityQueueWithFallback,
  filterPriorityContacts,
  getBratislavaDateKey,
  getPriorityContactCityLocation,
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

  it("keeps a pending contact with a callback date in Scheduled today before New", () => {
    const pendingCallback = contact("pending-callback", { callbackDate: now });
    const view = {
      ...DEFAULT_PRIORITY_VIEW,
      segments: [
        { id: "scheduled_today" as const, sort: "callback_asc" as const },
        { id: "new" as const, sort: "created_desc" as const },
      ],
    };
    const queue = buildPriorityQueue([pendingCallback], view, "agent", now);
    expect(queue).toEqual([{ contact: pendingCallback, segment: "scheduled_today" }]);
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

  it("exposes the same Bratislava calendar key used by queue buckets", () => {
    expect(getBratislavaDateKey("2025-01-14T23:30:00.000Z")).toBe("2025-01-15");
    expect(getBratislavaDateKey("2025-01-15T23:30:00.000Z")).toBe("2025-01-16");
    expect(getBratislavaDateKey("not-a-date")).toBeNull();
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

  it("keeps legacy views ungrouped and partitions city queues outside-in", () => {
    const bratislavaReferral = contact("bratislava-referral", {
      hasReferral: true,
      customer: { firstName: "Zed", lastName: "Contact", city: "Bratislava", country: "SK" },
    });
    const kosiceNew = contact("kosice-new", {
      customer: { firstName: "Ava", lastName: "Contact", city: "Košice", country: "SK" },
    });
    const unknown = contact("unknown", { customer: { firstName: "Unknown", lastName: "Contact" } });
    const grouped = buildPriorityQueueWithFallback([kosiceNew, unknown, bratislavaReferral], {
      ...DEFAULT_PRIORITY_VIEW,
      cityGrouping: { enabled: true, rankedKeys: ["SK:bratislava", "SK:kosice"], unknownKeys: [] },
    }, "agent", now);
    expect(grouped.map(item => item.contact.id)).toEqual(["bratislava-referral", "kosice-new", "unknown"]);
    expect(grouped.map(item => item.cityGroup?.key)).toEqual(["SK:bratislava", "SK:kosice", null]);
    expect(buildPriorityQueueWithFallback([kosiceNew, bratislavaReferral], DEFAULT_PRIORITY_VIEW, "agent", now)
      .every(item => !item.cityGroup)).toBe(true);
  });

  it("sorts unranked cities alphabetically before explicit AI-unknown and missing locations", () => {
    const ranked = contact("ranked", { customer: { firstName: "Ranked", city: "Prague", country: "CZ" } });
    const alpha = contact("alpha", { customer: { firstName: "Alpha", city: "Brno", country: "CZ" } });
    const beta = contact("beta", { customer: { firstName: "Beta", city: "Zlin", country: "CZ" } });
    const aiUnknown = contact("ai-unknown", { customer: { firstName: "AI", city: "Olomouc", country: "CZ" } });
    const missing = contact("missing", { customer: { firstName: "Missing" } });
    const queue = buildPriorityQueueWithFallback([beta, missing, aiUnknown, ranked, alpha], {
      ...DEFAULT_PRIORITY_VIEW,
      cityGrouping: { enabled: true, rankedKeys: ["CZ:prague"], unknownKeys: ["CZ:olomouc"] },
    }, "agent", now);
    expect(queue.map(item => item.contact.id)).toEqual(["ranked", "alpha", "beta", "ai-unknown", "missing"]);
  });

  it("keeps first-match segment precedence ahead of globally higher-ranked later cities", () => {
    const referralZilina = contact("referral-1", {
      hasReferral: true,
      customer: { firstName: "Referral", lastName: "Zilina", city: "Zilina", country: "SK" },
    });
    const referralBratislava = contact("referral-2", {
      hasReferral: true,
      customer: { firstName: "Referral", lastName: "Bratislava", city: "Bratislava", country: "SK" },
    });
    const newVienna = contact("new-vienna", {
      customer: { firstName: "New", lastName: "Vienna", city: "Vienna", country: "AT" },
    });
    const queue = buildPriorityQueueWithFallback([referralZilina, newVienna, referralBratislava], {
      ...DEFAULT_PRIORITY_VIEW,
      cityGrouping: { enabled: true, rankedKeys: ["AT:vienna", "SK:bratislava", "SK:zilina"], unknownKeys: [] },
    }, "agent", now);
    expect(queue.map(item => item.contact.id)).toEqual(["referral-2", "referral-1", "new-vienna"]);
    expect(queue.map(item => item.segment)).toEqual(["referral", "referral", "new"]);
  });

  it("extracts only the declared entity's city and country", () => {
    expect(getPriorityContactCityLocation(contact("hospital", {
      contactType: "hospital",
      customer: { firstName: "Wrong", city: "Wrong", country: "SK" },
      hospital: { name: "Hospital", city: "Brno", countryCode: "CZ" },
    }))).toMatchObject({ key: "CZ:brno", city: "Brno", countryCode: "CZ" });
    expect(getPriorityContactCityLocation(contact("missing", {
      customer: { firstName: "No city", country: "SK" },
    }))).toBeNull();
    expect(getPriorityContactCityLocation(contact("enriched", {
      priorityCity: "Bratislava",
      priorityCountryCode: "SK",
      customer: { firstName: "Ignored", city: "Zilina", country: "SK" },
    }))).toMatchObject({ key: "SK:bratislava", city: "Bratislava", countryCode: "SK" });
  });
});