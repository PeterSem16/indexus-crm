type MissionContact = {
  id: string;
  campaignId?: string | null;
  customerId?: string | null;
  clinicId?: string | null;
  hospitalId?: string | null;
  collaboratorId?: string | null;
};

const entityFields = ["customerId", "clinicId", "hospitalId", "collaboratorId"] as const;
const fieldsByType: Record<string, typeof entityFields[number]> = {
  customer: "customerId", clinic: "clinicId", hospital: "hospitalId", collaborator: "collaboratorId",
};

/** A cached enrollment is usable only if it still belongs to this entity and Mission. */
export function resolveMissionContactId(input: {
  contacts: readonly MissionContact[];
  campaignId: string | null | undefined;
  entityId: string | null | undefined;
  contactType: string;
  preferredId?: string | null;
}): string | null {
  if (!input.campaignId || !input.entityId) return null;
  const contacts = input.contacts.filter(row =>
    (!row.campaignId || row.campaignId === input.campaignId) &&
    entityFields.some(field => row[field] != null && String(row[field]) === String(input.entityId)),
  );
  const field = fieldsByType[input.contactType];
  const typed = field ? contacts.filter(row => String(row[field]) === String(input.entityId)) : [];
  // Retain the existing legacy wrong-contactType fallback, but never guess between two cards.
  const candidates = typed.length ? typed : contacts;
  const preferred = candidates.find(row => row.id === input.preferredId);
  if (preferred) return preferred.id;
  const ids = [...new Set(candidates.map(row => row.id))];
  return ids.length === 1 ? ids[0] : null;
}
