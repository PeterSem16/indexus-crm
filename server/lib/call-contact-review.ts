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