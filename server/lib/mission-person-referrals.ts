export function includePersonReferrals(settings: unknown): boolean {
  try {
    const parsed = typeof settings === "string" ? JSON.parse(settings) : settings;
    return parsed !== null && typeof parsed === "object"
      && !Array.isArray(parsed) && parsed.includePersonReferrals === true;
  } catch {
    return false;
  }
}

type FacilityAssignment = {
  personId: string;
  entityType: string;
  entityId: string;
};

export function facilityPersonReferralIds(
  assignments: readonly FacilityAssignment[],
  referredPersonIds: ReadonlySet<string>,
): { clinic: Set<string>; hospital: Set<string> } {
  const clinic = new Set<string>();
  const hospital = new Set<string>();
  for (const assignment of assignments) {
    if (!referredPersonIds.has(assignment.personId)) continue;
    if (assignment.entityType === "clinic") clinic.add(assignment.entityId);
    if (assignment.entityType === "hospital") hospital.add(assignment.entityId);
  }
  return { clinic, hospital };
}