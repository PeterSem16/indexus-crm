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
  referralsFirst?: boolean;
}

export interface PriorityView {
  version: 1;
  name: string;
  segments: PrioritySegment[];
  presetId?: PriorityPresetId;
  cityGrouping?: {
    enabled: boolean;
    rankedKeys: string[];
    unknownKeys: string[];
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

export interface PriorityContact {
  id: string;
  status: string;
  attemptCount?: number | null;
  callbackDate?: string | Date | null;
  lastAttemptAt?: string | Date | null;
  createdAt?: string | Date | null;
  assignedTo?: string | null;
  priorityScore?: number | null;
  hasReferral?: boolean;
  contactType?: string;
  doctorName?: string | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  priorityCity?: string | null;
  priorityCountryCode?: string | null;
  customer?: Entity | null;
  hospital?: Entity | null;
  clinic?: Entity | null;
  collaborator?: Entity | null;
}

export interface Entity {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  city?: string | null;
  countryCode?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
}

export type PriorityQueueSegmentId = PrioritySegmentId | "other";
export type PriorityCitySelectionMode = "all" | "selected";
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

export const PRIORITY_SEGMENT_IDS: PrioritySegmentId[] = [
  "referral", "scheduled_today", "due", "new", "my_scheduled", "team_scheduled",
  "assigned_others", "unhandled", "never_called", "recently_contacted", "stale",
];

export const PRIORITY_UNKNOWN_CITY_KEY = "__unknown__";

export const DEFAULT_PRIORITY_VIEW: PriorityView = {
  version: 1,
  name: "Odporúčania + mestá",
  presetId: "referral_cities",
  segments: [
    { id: "referral", sort: "priority", referralsFirst: true },
    { id: "new", sort: "created_desc", referralsFirst: true },
    { id: "scheduled_today", sort: "callback_asc", referralsFirst: true },
  ],
  cityGrouping: {
    enabled: true,
    rankedKeys: ["trnava,sk", "bratislava,sk", "kosice,sk"],
    unknownKeys: [],
    mode: "all",
    selectedKeys: [],
  },
};

export const PRIORITY_PRESETS: readonly PriorityView[] = [
  DEFAULT_PRIORITY_VIEW,
  {
    version: 1, name: "Nové odporúčania", presetId: "referral_first",
    segments: [
      { id: "referral", sort: "priority", referralsFirst: true },
      { id: "scheduled_today", sort: "callback_asc", referralsFirst: true },
      { id: "new", sort: "created_desc", referralsFirst: true },
    ],
  },
  {
    version: 1, name: "Dnešné spätné hovory", presetId: "todays_callbacks",
    segments: [
      { id: "scheduled_today", sort: "callback_asc", referralsFirst: true },
      { id: "due", sort: "callback_asc", referralsFirst: true },
      { id: "new", sort: "created_desc", referralsFirst: true },
    ],
  },
  {
    version: 1, name: "Nové príležitosti", presetId: "fresh_opportunities",
    segments: [
      { id: "new", sort: "created_desc", referralsFirst: true },
      { id: "referral", sort: "priority", referralsFirst: true },
      { id: "never_called", sort: "name_asc", referralsFirst: true },
    ],
  },
  {
    version: 1, name: "Obnova kontaktov", presetId: "recovery_desk",
    segments: [
      { id: "unhandled", sort: "attempts_desc", referralsFirst: true },
      { id: "stale", sort: "last_contact_asc", referralsFirst: true },
      { id: "assigned_others", sort: "callback_asc", referralsFirst: true },
    ],
  },
];

export function getPriorityContactCityLocation(contact: PriorityContact): PriorityCityGroup | null {
  const entity = contact.customer || contact.hospital || contact.clinic || contact.collaborator;
  const city = contact.priorityCity || entity?.city || null;
  const countryCode = contact.priorityCountryCode || entity?.countryCode || entity?.country || null;
  if (!city || !countryCode) return null;
  return { key: `${city.trim().toLocaleLowerCase()},${countryCode.trim().toLocaleLowerCase()}`, city, countryCode };
}

export function getPriorityContactName(contact: PriorityContact): string {
  const entity = contact.customer || contact.hospital || contact.clinic || contact.collaborator;
  if (!entity) return contact.id;
  if (entity.firstName || entity.lastName) return [entity.firstName, entity.lastName].filter(Boolean).join(" ");
  return entity.name || contact.id;
}

function timestamp(value: unknown): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  const result = date.getTime();
  return Number.isFinite(result) ? result : null;
}

function sameDay(a: number, b: number): boolean {
  const format = (value: number) => new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Bratislava", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(value));
  return format(a) === format(b);
}

export function isPriorityReferral(contact: PriorityContact): boolean {
  return contact.hasReferral === true;
}

export function matchesPrioritySegment(
  contact: PriorityContact,
  segmentId: PrioritySegmentId,
  currentUserId: string | undefined,
  now = new Date(),
): boolean {
  const callback = timestamp(contact.callbackDate);
  const lastAttempt = timestamp(contact.lastAttemptAt);
  const pending = contact.status === "pending" || contact.status === "callback_scheduled";
  const nowTime = now.getTime();
  switch (segmentId) {
    case "referral": return contact.hasReferral === true && contact.attemptCount === 0 && callback === null;
    case "scheduled_today": return pending && callback !== null && sameDay(callback, nowTime);
    case "due": return pending && callback !== null && callback <= nowTime;
    case "new": return contact.status === "pending" && contact.attemptCount === 0 && callback === null;
    case "my_scheduled": return pending && callback !== null && !!currentUserId && contact.assignedTo === currentUserId;
    case "team_scheduled": return pending && callback !== null && !contact.assignedTo;
    case "assigned_others": return pending && callback !== null && !!contact.assignedTo && contact.assignedTo !== currentUserId;
    case "unhandled": return pending && (contact.attemptCount || 0) > 0;
    case "never_called": return pending && contact.attemptCount === 0 && callback === null;
    case "recently_contacted": return lastAttempt !== null && nowTime - lastAttempt <= 7 * 24 * 60 * 60 * 1000;
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

export function sortPriorityContacts(contacts: PriorityContact[], sort: PrioritySort): PriorityContact[] {
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
    return result || nameResult || a.id.localeCompare(b.id);
  });
}

function sortReferralPartition(contacts: PriorityContact[], sort: PrioritySort, referralsFirst = true) {
  if (!referralsFirst) return sortPriorityContacts(contacts, sort);
  return [
    ...sortPriorityContacts(contacts.filter(isPriorityReferral), sort),
    ...sortPriorityContacts(contacts.filter(contact => !isPriorityReferral(contact)), sort),
  ];
}

export function filterPriorityContactsByCity(
  contacts: PriorityContact[],
  viewOrGrouping: PriorityView | PriorityView["cityGrouping"] | null | undefined,
): PriorityContact[] {
  const grouping = viewOrGrouping && "cityGrouping" in viewOrGrouping
    ? viewOrGrouping.cityGrouping
    : viewOrGrouping as PriorityView["cityGrouping"] | undefined;
  if (!grouping?.enabled || grouping.mode !== "selected") return contacts;
  const selected = new Set(grouping.selectedKeys || []);
  return contacts.filter(contact => selected.has(getPriorityContactCityLocation(contact)?.key || PRIORITY_UNKNOWN_CITY_KEY));
}

export function buildPriorityQueue(
  contacts: PriorityContact[],
  view: PriorityView,
  currentUserId?: string,
  now = new Date(),
): Array<{ contact: PriorityContact; segment: PrioritySegmentId }> {
  const used = new Set<string>();
  const result: Array<{ contact: PriorityContact; segment: PrioritySegmentId }> = [];
  const scoped = filterPriorityContactsByCity(contacts, view);
  for (const segment of view.segments) {
    const matches = sortReferralPartition(
      scoped.filter(contact => !used.has(contact.id) && matchesPrioritySegment(contact, segment.id, currentUserId, now)),
      segment.sort, segment.referralsFirst !== false,
    );
    matches.forEach(contact => { used.add(contact.id); result.push({ contact, segment: segment.id }); });
  }
  return result;
}

export function buildPriorityQueueWithFallback(
  contacts: PriorityContact[],
  view: PriorityView,
  currentUserId?: string,
  now = new Date(),
): PriorityQueueItem[] {
  const scoped = filterPriorityContactsByCity(contacts, view);
  const queue = buildPriorityQueue(scoped, { ...view, cityGrouping: undefined }, currentUserId, now);
  const used = new Set(queue.map(item => item.contact.id));
  const base = [
    ...queue,
    ...sortReferralPartition(scoped.filter(contact => !used.has(contact.id)), "priority")
      .map(contact => ({ contact, segment: "other" as const })),
  ];
  if (!view.cityGrouping?.enabled) return base;

  return base.map(item => {
    const location = getPriorityContactCityLocation(item.contact);
    return {
      ...item,
      cityGroup: location || { key: null, city: null, countryCode: null },
    };
  });
}

export function filterPriorityContacts(
  contacts: PriorityContact[],
  query: string,
  field: "all" | "name" | "phone" | "email" | "city",
): PriorityContact[] {
  const normalizeSearch = (value: unknown) => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  const normalized = normalizeSearch(query.trim());
  if (!normalized) return contacts;
  return contacts.filter(contact => {
    const entity = contact.customer || contact.hospital || contact.clinic || contact.collaborator;
    const values = {
      name: [getPriorityContactName(contact), contact.doctorName || ""].join(" "),
      phone: contact.phone || entity?.phone || "",
      email: contact.email || entity?.email || "",
      city: contact.priorityCity || entity?.city || "",
    };
    const searchable = field === "all"
      ? Object.values(values).concat(
        contact.doctorName || "",
        contact.role || "",
        entity?.name || "",
        contact.id,
      )
      : [values[field]];
    return searchable.some(value => normalizeSearch(value).includes(normalized));
  });
}