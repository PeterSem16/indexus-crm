export type ScheduledQueueContactType = "customer" | "clinic" | "hospital" | "collaborator";

export interface ScheduledQueueContactRow {
  ccContactType?: string | null;
  ccCustomerId?: string | null;
  ccClinicId?: string | null;
  ccHospitalId?: string | null;
  ccCollaboratorId?: string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerCity?: string | null;
  customerCountry?: string | null;
  clinicName?: string | null;
  clinicDoctorFirstName?: string | null;
  clinicDoctorLastName?: string | null;
  clinicPhone?: string | null;
  clinicEmail?: string | null;
  clinicCity?: string | null;
  clinicCountryCode?: string | null;
  hospitalName?: string | null;
  hospitalPhone?: string | null;
  hospitalEmail?: string | null;
  hospitalCity?: string | null;
  hospitalCountryCode?: string | null;
  collaboratorFirstName?: string | null;
  collaboratorLastName?: string | null;
  collaboratorPhone?: string | null;
  collaboratorMobile?: string | null;
  collaboratorEmail?: string | null;
}

export interface ScheduledQueuePriorityLocation {
  city: string;
  countryCode: string;
}

export interface ScheduledQueueReferralIds {
  clinic: ReadonlySet<string>;
  collaborator: ReadonlySet<string>;
}

export interface ScheduledQueueContactDetails {
  contactType: ScheduledQueueContactType;
  contactId: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  hasReferral: boolean;
  priorityCity: string | null;
  priorityCountryCode: string | null;
}

/**
 * Resolve the polymorphic entity explicitly named by a campaign contact.
 *
 * Queue contacts are represented by the same aliases for campaign_contacts
 * and campaign_contact_sessions. Keeping this resolver pure makes it harder
 * for one source to silently lose referral/city metadata or for a missing
 * entity to be replaced by a guessed city/name.
 */
export function resolveScheduledQueueContact(
  row: ScheduledQueueContactRow,
  referralIds: ScheduledQueueReferralIds,
  collaboratorLocations: ReadonlyMap<string, ScheduledQueuePriorityLocation>,
): ScheduledQueueContactDetails {
  const contactType: ScheduledQueueContactType = row.ccContactType === "clinic"
    || row.ccContactType === "hospital"
    || row.ccContactType === "collaborator"
    ? row.ccContactType
    : "customer";

  if (contactType === "clinic") {
    return {
      contactType,
      contactId: row.ccClinicId || null,
      contactName: row.clinicDoctorLastName
        ? `${row.clinicDoctorFirstName || ""} ${row.clinicDoctorLastName}`.trim() + (row.clinicName ? ` (${row.clinicName})` : "")
        : row.clinicName || "",
      contactPhone: row.clinicPhone || "",
      contactEmail: row.clinicEmail || "",
      hasReferral: !!row.ccClinicId && referralIds.clinic.has(row.ccClinicId),
      priorityCity: row.clinicCity || null,
      priorityCountryCode: row.clinicCountryCode || null,
    };
  }

  if (contactType === "hospital") {
    return {
      contactType,
      contactId: row.ccHospitalId || null,
      contactName: row.hospitalName || "",
      contactPhone: row.hospitalPhone || "",
      contactEmail: row.hospitalEmail || "",
      hasReferral: false,
      priorityCity: row.hospitalCity || null,
      priorityCountryCode: row.hospitalCountryCode || null,
    };
  }

  if (contactType === "collaborator") {
    const location = row.ccCollaboratorId
      ? collaboratorLocations.get(row.ccCollaboratorId)
      : undefined;
    return {
      contactType,
      contactId: row.ccCollaboratorId || null,
      contactName: `${row.collaboratorFirstName || ""} ${row.collaboratorLastName || ""}`.trim(),
      contactPhone: row.collaboratorPhone || row.collaboratorMobile || "",
      contactEmail: row.collaboratorEmail || "",
      hasReferral: !!row.ccCollaboratorId && referralIds.collaborator.has(row.ccCollaboratorId),
      priorityCity: location?.city || null,
      priorityCountryCode: location?.countryCode || null,
    };
  }

  return {
    contactType,
    contactId: row.ccCustomerId || null,
    contactName: `${row.customerFirstName || ""} ${row.customerLastName || ""}`.trim(),
    contactPhone: row.customerPhone || "",
    contactEmail: row.customerEmail || "",
    hasReferral: false,
    priorityCity: row.customerCity || null,
    priorityCountryCode: row.customerCountry || null,
  };
}