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
  /** Put referral-origin contacts before non-referrals within this group. */
  referralsFirst?: boolean;
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
    /**
     * Legacy city snapshots omitted mode and therefore mean all cities.
     * `selected` is deliberately an allow-list: an empty list selects no
     * contacts, rather than accidentally falling back to all.
     */
    mode?: "all" | "selected";
    selectedKeys?: string[];
  };
}

export type PriorityPresetId =
  | "referral_cities"
  | "referral_first"
  | "todays_callbacks"
  | "fresh_opportunities"
  | "recovery_desk";

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
  referralsFirst: z.boolean().default(true),
});

const priorityViewSchema = z.object({
  version: z.literal(1),
  name: z.string().trim().min(1).max(120),
  segments: z.array(prioritySegmentSchema).min(1),
  presetId: z.enum(["referral_cities", "referral_first", "todays_callbacks", "fresh_opportunities", "recovery_desk"]).optional(),
  cityGrouping: z.object({
    enabled: z.boolean(),
    rankedKeys: z.array(z.string().trim().min(1)).max(500),
    unknownKeys: z.array(z.string().trim().min(1)).max(500),
    mode: z.enum(["all", "selected"]).optional(),
    selectedKeys: z.array(z.string().trim().min(1)).max(500).optional(),
  }).optional(),
});

/**
 * The first-run view deliberately contains no client-invented city order.
 * `rankedKeys`/`unknownKeys` are filled only by the authenticated ranking
 * endpoint once the mission has supplied an eligible city pool.
 */
export function createReferralCitiesPriorityView(
  rankedKeys: string[] = [],
  unknownKeys: string[] = [],
): PriorityView {
  return {
    version: 1,
    name: "Referral + cities",
    presetId: "referral_cities",
    segments: [
      { id: "referral", sort: "priority", referralsFirst: true },
      { id: "scheduled_today", sort: "priority", referralsFirst: true },
      { id: "new", sort: "created_desc", referralsFirst: true },
      { id: "my_scheduled", sort: "priority", referralsFirst: true },
    ],
    cityGrouping: {
      enabled: true,
      rankedKeys: Array.from(new Set(rankedKeys)),
      unknownKeys: Array.from(new Set(unknownKeys)).filter(key => !rankedKeys.includes(key)),
      mode: "all",
      selectedKeys: [],
    },
  };
}

export const PRIORITY_PRESETS: readonly PriorityView[] = [
  createReferralCitiesPriorityView(),
  {
    version: 1, name: "New referrals first", presetId: "referral_first",
    segments: [
      { id: "referral", sort: "priority", referralsFirst: true },
      { id: "scheduled_today", sort: "callback_asc", referralsFirst: true },
      { id: "new", sort: "created_desc", referralsFirst: true },
    ],
  },
  {
    version: 1, name: "Today's callbacks", presetId: "todays_callbacks",
    segments: [{ id: "scheduled_today", sort: "callback_asc", referralsFirst: true }, { id: "due", sort: "callback_asc", referralsFirst: true }, { id: "new", sort: "created_desc", referralsFirst: true }],
  },
  {
    version: 1, name: "Fresh opportunities", presetId: "fresh_opportunities",
    segments: [{ id: "new", sort: "created_desc", referralsFirst: true }, { id: "referral", sort: "priority", referralsFirst: true }, { id: "never_called", sort: "name_asc", referralsFirst: true }],
  },
  {
    version: 1, name: "Recovery desk", presetId: "recovery_desk",
    segments: [{ id: "unhandled", sort: "attempts_desc", referralsFirst: true }, { id: "stale", sort: "last_contact_asc", referralsFirst: true }, { id: "assigned_others", sort: "callback_asc", referralsFirst: true }],
  },
];

/** First-run and reset target. A persisted first-run view replaces its empty
 * city snapshot with the AI response before it becomes authoritative. */
export const DEFAULT_PRIORITY_VIEW = createReferralCitiesPriorityView();

/** Validate persisted JSON at the boundary. Unknown segment/sort values are rejected. */
export function parsePriorityView(value: unknown): PriorityView | null {
  const result = priorityViewSchema.safeParse(value);
  if (!result.success) return null;
  const rankedKeys = Array.from(new Set(result.data.cityGrouping?.rankedKeys || []));
  return {
    version: 1,
    name: result.data.name,
    segments: result.data.segments.map(segment => ({
      ...segment,
      // Views saved before referral partitioning are intentionally upgraded
      // on read so reopening an old view meets the new default.
      referralsFirst: segment.referralsFirst ?? true,
    })) as PrioritySegment[],
    presetId: result.data.presetId,
    cityGrouping: result.data.cityGrouping
      ? {
        enabled: result.data.cityGrouping.enabled,
        rankedKeys,
        unknownKeys: Array.from(new Set(result.data.cityGrouping.unknownKeys)).filter(key => !rankedKeys.includes(key)),
        // Before city selection existed, an enabled grouping always meant all
        // cities. Keep that meaning when old personal views are reopened.
        mode: result.data.cityGrouping.mode || "all",
        selectedKeys: Array.from(new Set(result.data.cityGrouping.selectedKeys || [])),
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

/** Stable bucket key for contacts without a usable city/country pair. */
export const PRIORITY_UNKNOWN_CITY_KEY = "__unknown__";

export type PriorityCitySelectionMode = "all" | "selected";

export function getPriorityCitySelectionMode(
  grouping: PriorityView["cityGrouping"] | null | undefined,
): PriorityCitySelectionMode {
  return grouping?.mode === "selected" ? "selected" : "all";
}

/**
 * Return the city/country allow-list applied to the authoritative mission
 * queue. This is intentionally separate from city ordering: ordering may be
 * stale or unavailable while an explicit selection must remain authoritative.
 */
export function filterPriorityContactsByCity(
  contacts: PriorityContact[],
  viewOrGrouping: PriorityView | PriorityView["cityGrouping"] | null | undefined,
): PriorityContact[] {
  const grouping = "cityGrouping" in (viewOrGrouping || {})
    ? (viewOrGrouping as PriorityView).cityGrouping
    : viewOrGrouping as PriorityView["cityGrouping"] | undefined;
  if (!grouping?.enabled || getPriorityCitySelectionMode(grouping) !== "selected") {
    return contacts;
  }
  const selected = new Set(grouping.selectedKeys || []);
  return contacts.filter(contact => selected.has(
    getPriorityContactCityLocation(contact)?.key || PRIORITY_UNKNOWN_CITY_KEY,
  ));
}

/**
 * Referral means a new, never-dialed referral. Unknown attempt counts are not
 * treated as zero. A callback date/status is already scheduled work, so it
 * cannot be pulled ahead by the Referral-first preset even when its count is
 * still zero.
 */
export function isPriorityNewReferral(contact: PriorityContact): boolean {
  const attemptCount = contact.attemptCount;
  const callback = timestamp(contact.callbackDate);
  const alreadyScheduled = contact.status === "callback_scheduled"
    || (pendingStatuses.has(contact.status) && callback !== null);
  return contact.hasReferral === true && attemptCount === 0 && !alreadyScheduled;
}

/** Referral origin is retained as a priority/badge signal after any call. */
export function isPriorityReferral(contact: PriorityContact): boolean {
  return contact.hasReferral === true;
}

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
    case "referral": return isPriorityNewReferral(contact);
    case "scheduled_today": return pending && callback !== null && sameDay(callback, nowTime);
    case "due": return pending && callback !== null && callback <= nowTime;
    case "new": return contact.status === "pending" && contact.attemptCount === 0 && callback === null;
    case "my_scheduled": return pending && callback !== null && !!currentUserId && contact.assignedTo === currentUserId;
    case "team_scheduled": return pending && callback !== null && !contact.assignedTo;
    case "assigned_others": return pending && callback !== null && !!contact.assignedTo && contact.assignedTo !== currentUserId;
    case "unhandled": return pending && (contact.attemptCount || 0) > 0;
    case "never_called": return pending && contact.attemptCount === 0 && callback === null;
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

/**
 * Keep a group's configured sort intact while optionally partitioning referral
 * origin contacts ahead of all other contacts.  This is deliberately applied
 * after first-match assignment, never across groups.
 */
function sortPriorityContactsWithinReferralPartitions(
  contacts: PriorityContact[],
  sort: PrioritySort,
  referralsFirst = true,
): PriorityContact[] {
  if (!referralsFirst) return sortPriorityContacts(contacts, sort);
  return [
    ...sortPriorityContacts(contacts.filter(isPriorityReferral), sort),
    ...sortPriorityContacts(contacts.filter(contact => !isPriorityReferral(contact)), sort),
  ];
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
  const scopedContacts = filterPriorityContactsByCity(contacts, view);
  for (const segment of view.segments) {
    const matches = sortPriorityContactsWithinReferralPartitions(
      scopedContacts.filter(contact => !used.has(contact.id) && matchesPrioritySegment(contact, segment.id, currentUserId, now)),
      segment.sort,
      segment.referralsFirst !== false,
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
  const scopedContacts = filterPriorityContactsByCity(contacts, view);
  if (view.cityGrouping?.enabled) {
    // Segment assignment is authoritative. City grouping is only a secondary
    // ordering inside each first-match segment; never let a city pull a later
    // segment ahead of an earlier one.
    const baseQueue = buildPriorityQueueWithFallback(
      scopedContacts,
      { ...view, cityGrouping: undefined },
      currentUserId,
      now,
    );
    const segmentGroups = new Map<PriorityQueueSegmentId, {
      items: PriorityQueueItem[];
      sort: PrioritySort;
      referralsFirst: boolean;
      cities: Map<string, { location: PriorityCityLocation | null; items: PriorityQueueItem[]; contacts: PriorityContact[] }>;
    }>();
    for (const item of baseQueue) {
      let segment = segmentGroups.get(item.segment);
      if (!segment) {
        const configuredSegment = view.segments.find(candidate => candidate.id === item.segment);
        segment = {
          items: [],
          sort: configuredSegment?.sort || "priority",
          referralsFirst: configuredSegment?.referralsFirst !== false,
          cities: new Map(),
        };
        segmentGroups.set(item.segment, segment);
      }
      segment.items.push(item);
      const location = getPriorityContactCityLocation(item.contact);
      const key = location?.key || PRIORITY_UNKNOWN_CITY_KEY;
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
          return sortPriorityContactsWithinReferralPartitions(
            city.contacts,
            segment.sort,
            segment.referralsFirst,
          ).map(contact => {
            const item = city.items.find(candidate => candidate.contact.id === contact.id)!;
            return { ...item, cityGroup };
          });
        }),
    );
  }
  const queue = buildPriorityQueue(scopedContacts, view, currentUserId, now);
  const used = new Set(queue.map(item => item.contact.id));
  return [
    ...queue,
    ...sortPriorityContactsWithinReferralPartitions(scopedContacts.filter(contact => !used.has(contact.id)), "priority")
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