import type { CampaignContact } from "@shared/schema";
import { normalizeCityLocation, type NormalizedCityLocation } from "@shared/priority-city";
import { z } from "zod";

export const PRIORITY_BUILDER_MODULE = "agent-priority-builder";

export type PrioritySort =
  | "priority"
  | "name_asc"
  | "name_desc"
  | "attempts_desc"
  | "attempts_asc"
  | "last_contact_asc"
  | "last_contact_desc"
  | "callback_asc"
  | "callback_desc"
  | "created_desc"
  | "created_asc";

export type PrioritySegmentId =
  | "referral"
  | "scheduled_today"
  | "due"
  | "new"
  | "my_scheduled"
  | "team_scheduled"
  | "assigned_others"
  | "unhandled"
  | "never_called"
  | "recently_contacted"
  | "stale";

export interface PrioritySegment {
  id: PrioritySegmentId;
  sort: PrioritySort;
}

export interface PriorityView {
  version: 1;
  name: string;
  segments: PrioritySegment[];
  presetId?: PriorityPresetId;
  /** Optional city ordering snapshot. Omitted means the legacy segment-only queue. */
  cityGrouping?: {
    enabled: boolean;
    rankedKeys: string[];
    unknownKeys: string[];
  };
}

export type PriorityPresetId = "referral_first" | "todays_callbacks" | "fresh_opportunities" | "recovery_desk";

export type PriorityContact = Omit<CampaignContact, "attemptCount"> & {
  /** campaign_contacts defaults this to zero, but defensive UI paths may omit it. */
  attemptCount?: number | null;
  hasReferral?: boolean;
  priorityCity?: string | null;
  priorityCountryCode?: unknown;
  customer?: {
    firstName?: string | null; lastName?: string | null; name?: string | null;
    city?: string | null; country?: unknown;
  } | null;
  hospital?: { name?: string | null; city?: string | null; countryCode?: unknown } | null;
  clinic?: { name?: string | null; city?: string | null; countryCode?: unknown } | null;
  collaborator?: {
    firstName?: string | null; lastName?: string | null; name?: string | null;
    city?: string | null; countryCode?: unknown;
  } | null;
};

const pendingStatuses = new Set(["pending", "callback_scheduled"]);

export const PRIORITY_SEGMENT_IDS: PrioritySegmentId[] = [
  "referral", "scheduled_today", "due", "new", "my_scheduled", "team_scheduled",
  "assigned_others", "unhandled", "never_called", "recently_contacted", "stale",
];

const prioritySegmentSchema = z.object({
  id: z.enum(PRIORITY_SEGMENT_IDS as [PrioritySegmentId, ...PrioritySegmentId[]]),
  sort: z.enum([
    "priority", "name_asc", "name_desc", "attempts_desc", "attempts_asc",
    "last_contact_asc", "last_contact_desc", "callback_asc", "callback_desc",
    "created_desc", "created_asc",
  ]),
});

const priorityViewSchema = z.object({
  version: z.literal(1),
  name: z.string().trim().min(1).max(120),
  segments: z.array(prioritySegmentSchema).min(1),
  presetId: z.enum(["referral_first", "todays_callbacks", "fresh_opportunities", "recovery_desk"]).optional(),
  cityGrouping: z.object({
    enabled: z.boolean(),
    rankedKeys: z.array(z.string().trim().min(1)).max(500),
    unknownKeys: z.array(z.string().trim().min(1)).max(500),
  }).optional(),
});

export const PRIORITY_PRESETS: readonly PriorityView[] = [
  {
    version: 1, name: "Referral first", presetId: "referral_first",
    segments: [
      { id: "referral", sort: "priority" },
      { id: "scheduled_today", sort: "callback_asc" },
      { id: "new", sort: "created_desc" },
    ],
  },
  {
    version: 1, name: "Today's callbacks", presetId: "todays_callbacks",
    segments: [{ id: "scheduled_today", sort: "callback_asc" }, { id: "due", sort: "callback_asc" }, { id: "new", sort: "created_desc" }],
  },
  {
    version: 1, name: "Fresh opportunities", presetId: "fresh_opportunities",
    segments: [{ id: "new", sort: "created_desc" }, { id: "referral", sort: "priority" }, { id: "never_called", sort: "name_asc" }],
  },
  {
    version: 1, name: "Recovery desk", presetId: "recovery_desk",
    segments: [{ id: "unhandled", sort: "attempts_desc" }, { id: "stale", sort: "last_contact_asc" }, { id: "assigned_others", sort: "callback_asc" }],
  },
];

export const DEFAULT_PRIORITY_VIEW = PRIORITY_PRESETS[0];

/** Validate persisted JSON at the boundary. Unknown segment/sort values are rejected. */
export function parsePriorityView(value: unknown): PriorityView | null {
  const result = priorityViewSchema.safeParse(value);
  if (!result.success) return null;
  const rankedKeys = Array.from(new Set(result.data.cityGrouping?.rankedKeys || []));
  return {
    version: 1,
    name: result.data.name,
    segments: result.data.segments as PrioritySegment[],
    presetId: result.data.presetId,
    cityGrouping: result.data.cityGrouping
      ? {
        enabled: result.data.cityGrouping.enabled,
        rankedKeys,
        unknownKeys: Array.from(new Set(result.data.cityGrouping.unknownKeys)).filter(key => !rankedKeys.includes(key)),
      }
      : undefined,
  };
}

/**
 * The shared normalizer is intentionally mirrored here until the shared module
 * is available to the client bundle. Keep location extraction type-specific:
 * a clinic's countryCode must never be read from a similarly-shaped customer.
 */
export type PriorityCityLocation = NormalizedCityLocation;

/** Resolve the location from the contact's declared entity type. */
export function getPriorityContactCityLocation(contact: PriorityContact): PriorityCityLocation | null {
  const enriched = contact as PriorityContact & { priorityCity?: string | null; priorityCountryCode?: unknown };
  if ("priorityCity" in enriched || "priorityCountryCode" in enriched) {
    return normalizeCityLocation(enriched.priorityCountryCode, enriched.priorityCity);
  }
  const type = String((contact as PriorityContact & { contactType?: string }).contactType || "customer");
  if (type === "hospital") return normalizeCityLocation(contact.hospital?.countryCode, contact.hospital?.city);
  if (type === "clinic") return normalizeCityLocation(contact.clinic?.countryCode, contact.clinic?.city);
  if (type === "collaborator") return normalizeCityLocation(contact.collaborator?.countryCode, contact.collaborator?.city);
  return normalizeCityLocation(contact.customer?.country, contact.customer?.city);
}

export function getPriorityContactName(contact: PriorityContact): string {
  const entity = contact.customer || contact.hospital || contact.clinic || contact.collaborator;
  if (!entity) return contact.id;
  const person = entity as { firstName?: string | null; lastName?: string | null; name?: string | null };
  if (person.firstName || person.lastName) {
    const full = [person.firstName, person.lastName].filter(Boolean).join(" ");
    if (full) return full;
  }
  return person.name || contact.id;
}

function timestamp(value: unknown): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  const result = date.getTime();
  return Number.isFinite(result) ? result : null;
}

const PRIORITY_QUEUE_TIME_ZONE = "Europe/Bratislava";

function appDateKey(value: number): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: PRIORITY_QUEUE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Return the app's calendar date for a value, independent of browser timezone. */
export function getBratislavaDateKey(value: unknown): string | null {
  const date = timestamp(value);
  return date === null ? null : appDateKey(date);
}

function sameDay(a: number, b: number): boolean {
  return appDateKey(a) === appDateKey(b);
}

export function matchesPrioritySegment(
  contact: PriorityContact,
  segmentId: PrioritySegmentId,
  currentUserId: string | undefined,
  now = new Date(),
): boolean {
  const callback = timestamp(contact.callbackDate);
  const lastAttempt = timestamp(contact.lastAttemptAt);
  const pending = pendingStatuses.has(contact.status);
  const nowTime = now.getTime();
  switch (segmentId) {
    case "referral": return contact.hasReferral === true;
    case "scheduled_today": return pending && callback !== null && sameDay(callback, nowTime);
    case "due": return pending && callback !== null && callback <= nowTime;
    case "new": return contact.status === "pending" && (contact.attemptCount || 0) === 0;
    case "my_scheduled": return pending && callback !== null && !!currentUserId && contact.assignedTo === currentUserId;
    case "team_scheduled": return pending && callback !== null && !contact.assignedTo;
    case "assigned_others": return pending && callback !== null && !!contact.assignedTo && contact.assignedTo !== currentUserId;
    case "unhandled": return pending && (contact.attemptCount || 0) > 0;
    case "never_called": return pending && (contact.attemptCount || 0) === 0;
    case "recently_contacted": return lastAttempt !== null && nowTime - lastAttempt <= 7 * 24 * 60 * 60 * 1000;
    // "Stale" intentionally uses only campaign-contact timestamps: an unworked contact
    // is stale after seven days, and a worked one after thirty days.
    case "stale": return pending && (lastAttempt === null
      ? (timestamp(contact.createdAt) ?? nowTime) <= nowTime - 7 * 24 * 60 * 60 * 1000
      : lastAttempt <= nowTime - 30 * 24 * 60 * 60 * 1000);
  }
}

function compareNullable(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
}

export function sortPriorityContacts(
  contacts: PriorityContact[],
  sort: PrioritySort,
): PriorityContact[] {
  return [...contacts].sort((a, b) => {
    const nameResult = getPriorityContactName(a).localeCompare(getPriorityContactName(b), undefined, { sensitivity: "base" });
    let result = 0;
    switch (sort) {
      case "name_asc": result = nameResult; break;
      case "name_desc": result = -nameResult; break;
      case "attempts_desc": result = (b.attemptCount || 0) - (a.attemptCount || 0); break;
      case "attempts_asc": result = (a.attemptCount || 0) - (b.attemptCount || 0); break;
      case "last_contact_asc": result = compareNullable(timestamp(a.lastAttemptAt), timestamp(b.lastAttemptAt), 1); break;
      case "last_contact_desc": result = compareNullable(timestamp(a.lastAttemptAt), timestamp(b.lastAttemptAt), -1); break;
      case "callback_asc": result = compareNullable(timestamp(a.callbackDate), timestamp(b.callbackDate), 1); break;
      case "callback_desc": result = compareNullable(timestamp(a.callbackDate), timestamp(b.callbackDate), -1); break;
      case "created_desc": result = compareNullable(timestamp(a.createdAt), timestamp(b.createdAt), -1); break;
      case "created_asc": result = compareNullable(timestamp(a.createdAt), timestamp(b.createdAt), 1); break;
      case "priority": result = (b.priorityScore || 0) - (a.priorityScore || 0); break;
    }
    if (result !== 0) return result;
    return nameResult || String(a.id).localeCompare(String(b.id));
  });
}

/** Apply groups top-to-bottom. A contact belongs to its first matching group only. */
export function buildPriorityQueue(
  contacts: PriorityContact[],
  view: PriorityView,
  currentUserId?: string,
  now = new Date(),
): Array<{ contact: PriorityContact; segment: PrioritySegmentId }> {
  const used = new Set<string>();
  const result: Array<{ contact: PriorityContact; segment: PrioritySegmentId }> = [];
  for (const segment of view.segments) {
    const matches = sortPriorityContacts(
      contacts.filter(contact => !used.has(contact.id) && matchesPrioritySegment(contact, segment.id, currentUserId, now)),
      segment.sort,
    );
    for (const contact of matches) {
      used.add(contact.id);
      result.push({ contact, segment: segment.id });
    }
  }
  return result;
}

export type PriorityQueueSegmentId = PrioritySegmentId | "other";

export interface PriorityCityGroup {
  key: string | null;
  city: string | null;
  countryCode: string | null;
}

export interface PriorityQueueItem {
  contact: PriorityContact;
  segment: PriorityQueueSegmentId;
  cityGroup?: PriorityCityGroup;
}

function cityGroupSort(
  a: { location: PriorityCityLocation | null; contacts: PriorityContact[] },
  b: { location: PriorityCityLocation | null; contacts: PriorityContact[] },
  rankedKeys: string[],
  unknownKeys: string[],
): number {
  if (!a.location && !b.location) return 0;
  if (!a.location) return 1;
  if (!b.location) return -1;
  const rank = new Map(rankedKeys.map((key, index) => [key, index]));
  const unknown = new Set(unknownKeys);
  const aUnknown = unknown.has(a.location.key);
  const bUnknown = unknown.has(b.location.key);
  if (aUnknown && !bUnknown) return 1;
  if (!aUnknown && bUnknown) return -1;
  const aRank = rank.get(a.location.key);
  const bRank = rank.get(b.location.key);
  if (aRank !== undefined && bRank !== undefined && aRank !== bRank) return aRank - bRank;
  if (aRank !== undefined) return -1;
  if (bRank !== undefined) return 1;
  return `${a.location.city} ${a.location.countryCode}`.localeCompare(
    `${b.location.city} ${b.location.countryCode}`,
    undefined,
    { sensitivity: "base" },
  ) || a.location.key.localeCompare(b.location.key);
}

export function buildPriorityQueueWithFallback(
  contacts: PriorityContact[],
  view: PriorityView,
  currentUserId?: string,
  now = new Date(),
): PriorityQueueItem[] {
  if (view.cityGrouping?.enabled) {
    // Segment assignment is authoritative. City grouping is only a secondary
    // ordering inside each first-match segment; never let a city pull a later
    // segment ahead of an earlier one.
    const baseQueue = buildPriorityQueueWithFallback(
      contacts,
      { ...view, cityGrouping: undefined },
      currentUserId,
      now,
    );
    const segmentGroups = new Map<PriorityQueueSegmentId, {
      items: PriorityQueueItem[];
      cities: Map<string, { location: PriorityCityLocation | null; items: PriorityQueueItem[]; contacts: PriorityContact[] }>;
    }>();
    for (const item of baseQueue) {
      let segment = segmentGroups.get(item.segment);
      if (!segment) {
        segment = { items: [], cities: new Map() };
        segmentGroups.set(item.segment, segment);
      }
      segment.items.push(item);
      const location = getPriorityContactCityLocation(item.contact);
      const key = location?.key || "__unknown__";
      const city = segment.cities.get(key);
      if (city) {
        city.items.push(item);
        city.contacts.push(item.contact);
      } else {
        segment.cities.set(key, { location, items: [item], contacts: [item.contact] });
      }
    }
    return Array.from(segmentGroups.values()).flatMap(segment =>
      Array.from(segment.cities.values())
        .sort((a, b) => cityGroupSort(a, b, view.cityGrouping!.rankedKeys, view.cityGrouping!.unknownKeys))
        .flatMap(city => {
          const cityGroup: PriorityCityGroup = city.location
            ? { key: city.location.key, city: city.location.city, countryCode: city.location.countryCode }
            : { key: null, city: null, countryCode: null };
          return city.items.map(item => ({ ...item, cityGroup }));
        }),
    );
  }
  const queue = buildPriorityQueue(contacts, view, currentUserId, now);
  const used = new Set(queue.map(item => item.contact.id));
  return [
    ...queue,
    ...sortPriorityContacts(contacts.filter(contact => !used.has(contact.id)), "priority")
      .map(contact => ({ contact, segment: "other" as const })),
  ];
}

export function filterPriorityContacts(
  contacts: PriorityContact[],
  query: string,
  field: "all" | "name" | "phone" | "email" | "city",
): PriorityContact[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return contacts;
  return contacts.filter(contact => {
    const entity = contact.customer || contact.hospital || contact.clinic || contact.collaborator;
    const values = [
      getPriorityContactName(contact),
      (entity as { phone?: string | null } | null)?.phone || "",
      (entity as { email?: string | null } | null)?.email || "",
      contact.priorityCity || (entity as { city?: string | null } | null)?.city || "",
    ];
    const index = field === "name" ? 0 : field === "phone" ? 1 : field === "email" ? 2 : field === "city" ? 3 : -1;
    const searchable = index === -1
      ? [...values, ...Object.values(entity || {}).filter(value => typeof value === "string") as string[]]
      : [values[index]];
    return searchable.some(value => value.toLocaleLowerCase().includes(normalized));
  });
}