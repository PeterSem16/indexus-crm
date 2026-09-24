export type ReviewEntityType = "customer" | "clinic" | "hospital" | "collaborator";

export interface ReviewContactLink {
  id: string;
  campaignId: string;
  contactType: string;
  customerId: string | null;
  clinicId: string | null;
  hospitalId: string | null;
  collaboratorId: string | null;
}

// Only the exact saved campaign-contact link may supply status-list context.
// A matching phone, recording label, or a current Mission assignment is not evidence.
export function resolveCallReviewContact(
  call: { customerId: string | null; campaignId: string | null; campaignContactId: string | null },
  contact: ReviewContactLink | null | undefined,
): { type: ReviewEntityType; entityId: string; campaignId: string; campaignContactId: string } | null {
  if (!contact || !call.campaignContactId || contact.id !== call.campaignContactId ||
      (call.campaignId && contact.campaignId !== call.campaignId)) return null;
  const fieldByType = {
    customer: "customerId", clinic: "clinicId",
    hospital: "hospitalId", collaborator: "collaboratorId",
  } as const;
  if (!Object.prototype.hasOwnProperty.call(fieldByType, contact.contactType)) return null;
  const type = contact.contactType as ReviewEntityType;
  const entityId = contact[fieldByType[type]];
  if (!entityId) return null;
  if (call.customerId && ![
    contact.customerId, contact.clinicId, contact.hospitalId, contact.collaboratorId,
  ].includes(call.customerId)) return null;
  return { type, entityId, campaignId: contact.campaignId, campaignContactId: contact.id };
}

// Legacy logs can omit campaignContactId, but a saved Mission + entity link
// can still be authoritative if it resolves to exactly one contact row.
export function resolveUniqueCallReviewContact(
  call: { customerId: string | null; campaignId: string | null; campaignContactId: string | null },
  candidates: ReviewContactLink[],
): ReturnType<typeof resolveCallReviewContact> {
  if (call.campaignContactId || !call.campaignId || !call.customerId || candidates.length !== 1) return null;
  return resolveCallReviewContact({ ...call, campaignContactId: candidates[0].id }, candidates[0]);
}

export interface CallReviewEvent {
  action: string;
  metadata: unknown;
  createdAt: Date;
}

export interface CallReviewOption {
  id: string;
  label: string;
  note: string | null;
  selectedAt: string;
}

// This is only a current-state fallback, never evidence of what was scheduled
// during the historical call. Require the exact option selected in that call.
export function currentCallbackMatchingCallOption(
  contact: {
    status: string | null;
    callbackDate: Date | null;
    callbackNote: string | null;
    callbackStatusListItemId: string | null;
  } | null | undefined,
  selectedOptions: CallReviewOption[],
): { date: string; note: string | null } | null {
  if (contact?.status !== "callback_scheduled" || !contact.callbackDate ||
      !Number.isFinite(contact.callbackDate.getTime()) || !contact.callbackStatusListItemId ||
      !selectedOptions.some(option => option.id === contact.callbackStatusListItemId)) return null;
  return {
    date: contact.callbackDate.toISOString(),
    note: contact.callbackNote?.trim() || null,
  };
}

export function callbackDateChanged(
  previous: Date | null,
  current: Date | null,
  dateWasSupplied: boolean,
): boolean {
  return dateWasSupplied && (previous?.getTime() ?? null) !== (current?.getTime() ?? null);
}

export function summarizeCallReviewEvents(
  eventsNewestFirst: CallReviewEvent[],
  items: Array<{ id: string; label: string }>,
): { selectedOptions: CallReviewOption[]; reschedule: { date: string; note: string | null; setAt: string } | null } {
  const latestConfirmation = new Map<string, { confirmed: boolean; label?: string; itemType?: string; selectedAt: string; note: string | null }>();
  const latestNotes = new Map<string, string | null>();
  let reschedule: { date: string; note: string | null; setAt: string } | null = null;
  let callbackSeen = false;

  for (const event of eventsNewestFirst) {
    const meta = event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
      ? event.metadata as Record<string, unknown> : {};
    if (event.action === "status_list_note_update" && typeof meta.statusListItemId === "string" &&
        !latestNotes.has(meta.statusListItemId)) {
      latestNotes.set(meta.statusListItemId, typeof meta.itemNote === "string" ? meta.itemNote : null);
    }
    if (event.action === "status_list_confirmation" && typeof meta.statusListItemId === "string" &&
        !latestConfirmation.has(meta.statusListItemId)) {
      latestConfirmation.set(meta.statusListItemId, {
        confirmed: meta.confirmed === true,
        label: typeof meta.itemLabel === "string" ? meta.itemLabel : undefined,
        itemType: typeof meta.itemType === "string" ? meta.itemType : undefined,
        selectedAt: event.createdAt.toISOString(),
        note: typeof meta.itemNote === "string" ? meta.itemNote : null,
      });
    }
    const isCallbackAction = event.action === "callback_change" ||
      (event.action === "status_list_action" &&
       (meta.actionType === "set_callback" || meta.actionType === "set_contact_status") &&
       typeof meta.callbackDate === "string");
    if (isCallbackAction && !callbackSeen) {
      callbackSeen = true;
      const rawDate = meta.callbackDate;
      if (typeof rawDate === "string" && Number.isFinite(Date.parse(rawDate))) {
        reschedule = {
          date: new Date(rawDate).toISOString(),
          note: typeof meta.callbackNote === "string" && meta.callbackNote.trim() ? meta.callbackNote.trim() : null,
          setAt: event.createdAt.toISOString(),
        };
      }
    }
  }

  const itemById = new Map(items.map(item => [item.id, item]));
  const selectedOptions = [...latestConfirmation.entries()].flatMap(([id, confirmation]) => {
    if (!confirmation.confirmed || (confirmation.itemType && !["option", "step"].includes(confirmation.itemType)) ||
        (!itemById.has(id) && !confirmation.label)) return [];
    const label = confirmation.label || itemById.get(id)?.label;
    if (!label) return [];
    return [{
      id,
      label,
      note: latestNotes.has(id) ? latestNotes.get(id)! : confirmation.note,
      selectedAt: confirmation.selectedAt,
    }];
  }).sort((a, b) => a.selectedAt.localeCompare(b.selectedAt));
  return {
    selectedOptions,
    reschedule,
  };
}