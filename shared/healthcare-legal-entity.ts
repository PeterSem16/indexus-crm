export type FacilityType = "clinic" | "hospital";
export type RegistryReference = { section: string; insertNumber: number; court: string };
export const REGISTRY_COUNTRIES = ["SK", "CZ", "RO"] as const;
export type RegistryCountry = typeof REGISTRY_COUNTRIES[number];
export interface NormalizedCompany {
  countryCode: RegistryCountry; ico: string; name: string; legalForm: string | null;
  registeredAddress: string | null; city: string | null; postalCode: string | null;
  status: "active" | "terminated" | "unknown"; registryReference: RegistryReference;
  establishedAt: string | null; terminatedAt: string | null;
  registrySource?: "ORSR" | "ARES" | "ANAF";
  taxStatus?: { vatRegistered?: boolean; inactive?: boolean };
}
export interface LegalEntitySummary extends NormalizedCompany {
  id: string; sourceUpdatedAt: string | null; checkedAt: string; notes: string;
  facilityCount?: number; personCount?: number;
  registryCompany?: NormalizedCompany;
  details?: LegalEntityDetails;
  changeStatus?: RegistryReviewStatus;
  pendingSnapshotCount?: number;
}
export const LEGAL_ENTITY_EDITABLE_FIELDS = ["name", "legalForm", "registeredAddress", "city", "postalCode"] as const;
export type LegalEntityDetailField = typeof LEGAL_ENTITY_EDITABLE_FIELDS[number];
export type LegalEntityDetails = Partial<Record<LegalEntityDetailField, string>>;
export interface RegistryPerson {
  key: string; name: string; role: string; kind: string; current: boolean;
  validFrom: string | null; validTo: string | null;
  firstName?: string | null; lastName?: string | null; isNaturalPerson?: boolean;
}
export interface Facility {
  id: string; type: FacilityType; name: string; ico: string | null;
  countryCode: string | null; address: string | null; city: string | null; postalCode: string | null;
}
export interface FacilityLink {
  id: string; legalEntityId: string; facilityType: FacilityType; facilityId: string;
  facilityName: string; relationship: "operator"; validFrom: string; validTo: string | null; confirmedAt: string;
  legalEntityName?: string;
  confirmedByName?: string | null;
}
export interface PersonViaFacility {
  personId: string; personName: string; facilityType: FacilityType; facilityId: string;
  facilityName: string; legalEntityId?: string; legalEntityName?: string; role?: string | null;
  validFrom?: string | null; validTo?: string | null;
}
export interface RegistryPersonLink {
  id: string; legalEntityId: string; personId: string; personName: string;
  registryPersonKey: string; role: string; validFrom: string; validTo: string | null;
}
export interface SnapshotSummary {
  id: string; checkedAt: string; sourceUpdatedAt: string | null; createdByName?: string; kind?: string;
  review?: SnapshotReview | null;
  changeStatus?: RegistryReviewStatus;
}

export type RegistryReviewStatus = "baseline" | "unchanged" | "pending" | "reviewed";
export const REGISTRY_REVIEW_NOTE_MAX_LENGTH = 2000;
export interface SnapshotReview {
  reviewedBy: string;
  reviewedByName: string;
  reviewedAt: string;
  note?: string | null;
}
export type RegistryChangeField = "name" | "registeredAddress" | "city" | "postalCode" | "legalForm" | "status" | "vatRegistered" | "taxInactive";
export interface VerificationPreview {
  verificationId: string; expiresAt: string; company: NormalizedCompany;
  existingEntityId: string | null; facility?: Facility; registryPeople: RegistryPerson[];
  documents: Record<string, unknown>[]; checkedAt: string; sourceUpdatedAt: string | null;
}
export interface LegalEntityDetail {
  entity: LegalEntitySummary; facilities: FacilityLink[]; people: PersonViaFacility[];
  registryPeople: RegistryPerson[]; personLinks: RegistryPersonLink[]; history: SnapshotSummary[];
  canManage: boolean; canViewSensitive: boolean; rawData?: Record<string, unknown>;
  comparison?: RegistryComparison | null;
  audit?: Array<{ id: string; checkedAt: string; sourceUpdatedAt: null; createdByName?: string; kind: string; details?: Record<string, unknown> }>;
}
export type FacilityUpdateField = "name" | "address" | "city" | "postalCode" | "ico";

export interface SavedLegalVerification {
  entityId: string; linkId: string | null; comparison: RegistryComparison;
}

export interface LegalSnapshotDetail {
  snapshot: SnapshotSummary; comparison: RegistryComparison; rawData?: Record<string, unknown>;
}

export interface RegistryComparison {
  previous: SnapshotSummary | null;
  current: SnapshotSummary;
  fields: Array<{ field: RegistryChangeField; before: string | null; after: string | null }>;
  roles: { removed: RegistryPerson[]; added: RegistryPerson[] };
}
