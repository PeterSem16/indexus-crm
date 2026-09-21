export type CampaignContactVisibility = "all" | "assigned_representative";

export function resolveCampaignContactEntityType(contact: {
  contactType?: string | null;
  clinicId?: string | null;
  hospitalId?: string | null;
  collaboratorId?: string | null;
}): string | null | undefined {
  if (contact.clinicId) return "clinic";
  if (contact.hospitalId) return "hospital";
  if (contact.collaboratorId) return "collaborator";
  return contact.contactType;
}

export function parseCampaignContactVisibility(settings: unknown): CampaignContactVisibility {
  let value: unknown = settings;
  if (typeof settings === "string") {
    try { value = JSON.parse(settings); } catch { return "all"; }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return "all";
  return (value as Record<string, unknown>).contactVisibility === "assigned_representative"
    ? "assigned_representative"
    : "all";
}

export function hasCampaignContactVisibilityChange(
  currentSettings: Record<string, unknown>,
  nextSettings: Record<string, unknown>,
): boolean {
  return Object.prototype.hasOwnProperty.call(nextSettings, "contactVisibility")
    && currentSettings.contactVisibility !== nextSettings.contactVisibility;
}

export function preserveCampaignContactVisibility(
  currentSettings: Record<string, unknown>,
  nextSettings: Record<string, unknown>,
): Record<string, unknown> {
  if (Object.prototype.hasOwnProperty.call(nextSettings, "contactVisibility")) return nextSettings;
  if (!Object.prototype.hasOwnProperty.call(currentSettings, "contactVisibility")) return nextSettings;
  return { ...nextSettings, contactVisibility: currentSettings.contactVisibility };
}

export function isCampaignContactVisibleToAgent(input: {
  settings: unknown;
  contact: { contactType?: string | null };
  userId: string;
  representativeId?: string | null;
  collaboratorRepresentativeIds?: unknown;
}): boolean {
  if (parseCampaignContactVisibility(input.settings) === "all") return true;
  return contactMatchesRepresentative(
    input.contact,
    input.representativeId,
    input.userId,
    input.collaboratorRepresentativeIds,
  );
}

export function contactMatchesRepresentative(
  contact: { contactType?: string | null },
  representativeId: string | null | undefined,
  userId: string,
  collaboratorRepresentativeIds?: unknown,
): boolean {
  if (!userId) return false;
  if (contact.contactType === "collaborator") {
    const ids = Array.isArray(collaboratorRepresentativeIds)
      ? collaboratorRepresentativeIds.filter((id): id is string => typeof id === "string")
      : [];
    return representativeId === userId || ids.includes(userId);
  }
  return representativeId === userId;
}