export type FacilityType = "clinic" | "hospital";
export type RegistryReference = { section: string; insertNumber: number; court: string };
export interface NormalizedCompany {
  countryCode: "SK"; ico: string; name: string; legalForm: string | null;
  registeredAddress: string | null; city: string | null; postalCode: string | null;
  status: "active" | "terminated"; registryReference: RegistryReference;
  establishedAt: string | null; terminatedAt: string | null;
}
export interface LegalEntitySummary extends NormalizedCompany {
  id: string; sourceUpdatedAt: string | null; checkedAt: string; notes: string;
  facilityCount?: number; personCount?: number;
}
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
}
export interface VerificationPreview {
  verificationId: string; expiresAt: string; company: NormalizedCompany;
  existingEntityId: string | null; facility?: Facility; registryPeople: RegistryPerson[];
  documents: Record<string, unknown>[]; checkedAt: string; sourceUpdatedAt: string | null;
}
export interface LegalEntityDetail {
  entity: LegalEntitySummary; facilities: FacilityLink[]; people: PersonViaFacility[];
  registryPeople: RegistryPerson[]; personLinks: RegistryPersonLink[]; history: SnapshotSummary[];
  canManage: boolean; canViewSensitive: boolean; rawData?: Record<string, unknown>;
  audit?: Array<{ id: string; checkedAt: string; sourceUpdatedAt: null; createdByName?: string; kind: string; details?: Record<string, unknown> }>;
}
export type FacilityUpdateField = "name" | "address" | "city" | "postalCode" | "ico";
