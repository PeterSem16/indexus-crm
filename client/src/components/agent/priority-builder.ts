import type { CampaignContact } from "@shared/schema";
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
}

export type PriorityPresetId = "referral_first" | "todays_callbacks" | "fresh_opportunities" | "recovery_desk";

export interface PriorityContact extends CampaignContact {
  hasReferral?: boolean;
  customer?: { firstName?: string | null; lastName?: string | null; name?: string | null } | null;
  hospital?: { name?: string | null } | null;
  clinic?: { name?: string | null } | null;
  collaborator?: { firstName?: string | null; lastName?: string | null; name?: string | null } | null;
}

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
  return {
    version: 1,
    name: result.data.name,
    segments: result.data.segments as PrioritySegment[],
    presetId: result.data.presetId,
  };
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

function sameDay(a: number, b: number): boolean {
  const first = new Date(a); const second = new Date(b);
  return first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth() && first.getDate() === second.getDate();
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

export function buildPriorityQueueWithFallback(
  contacts: PriorityContact[],
  view: PriorityView,
  currentUserId?: string,
  now = new Date(),
): Array<{ contact: PriorityContact; segment: PriorityQueueSegmentId }> {
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
      (entity as { city?: string | null } | null)?.city || "",
    ];
    const index = field === "name" ? 0 : field === "phone" ? 1 : field === "email" ? 2 : field === "city" ? 3 : -1;
    const searchable = index === -1
      ? [...values, ...Object.values(entity || {}).filter(value => typeof value === "string") as string[]]
      : [values[index]];
    return searchable.some(value => value.toLocaleLowerCase().includes(normalized));
  });
}