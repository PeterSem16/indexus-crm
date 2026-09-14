/**
 * The Clinics and Hospitals list pages use the same rule shape as
 * EntityFilter.  Bulk representative assignment deliberately uses this
 * small, dependency-free evaluator as well so that a preview and a write
 * cannot disagree about what a rule means.
 */

export type MedicalPartnerEntity = "clinic" | "hospital";
export type MedicalPartnerFilterOp =
  | "is"
  | "isAny"
  | "isNot"
  | "contains"
  | "isEmpty"
  | "isNotEmpty";

export type MedicalPartnerFilterRule = {
  id?: string;
  conjunction?: "and" | "or";
  field: string;
  op: MedicalPartnerFilterOp;
  value?: string | string[];
};

type FilterFieldKind = "select" | "multiselect" | "text" | "boolean";

/**
 * Kept in one place for server validation.  These are the fields exposed by
 * the corresponding Clinics/Hospitals EntityFilter definitions.
 */
export const MEDICAL_PARTNER_FILTER_FIELDS: Record<
  MedicalPartnerEntity,
  Record<string, FilterFieldKind>
> = {
  hospital: {
    country: "multiselect",
    status: "select",
    personnel: "select",
    name: "text",
    fullName: "text",
    city: "text",
    region: "text",
    district: "text",
    postalCode: "text",
    streetNumber: "text",
    contactPerson: "text",
    phone: "text",
    email: "text",
    svetZdravia: "select",
    autoRecruiting: "select",
    representativeId: "select",
    responsiblePersonId: "select",
    laboratoryId: "select",
    tags: "text",
    dataSource: "text",
    createdByCollaboratorId: "text",
    legacyId: "text",
    hasPhone: "select",
    hasEmail: "select",
    hasGps: "select",
  },
  clinic: {
    country: "multiselect",
    status: "select",
    pipeline: "select",
    name: "text",
    doctorName: "text",
    doctorTitle: "text",
    doctorFirstName: "text",
    doctorLastName: "text",
    ico: "text",
    pzsCode: "text",
    pzsName: "text",
    idZz: "text",
    city: "text",
    region: "text",
    district: "text",
    street: "text",
    streetNumber: "text",
    postalCode: "text",
    address: "text",
    phone: "text",
    phone2: "text",
    phone3: "text",
    email: "text",
    email2: "text",
    email3: "text",
    website: "text",
    hasWebsite: "select",
    hasPhone: "select",
    hasEmail: "select",
    hasGps: "select",
    isReferredByDoctor: "select",
    isFromConference: "select",
    conferenceName: "text",
    initialStatus: "select",
    interestCooperation: "select",
    interestContract: "select",
    contractStatus: "select",
    lastCallResult: "text",
    lastCallNote: "text",
    leadSource: "text",
    leadSourceNotes: "text",
    leadSourceDate: "text",
    conferenceDate: "text",
    nextContactDate: "text",
    contractSentDate: "text",
    contractReturnedDate: "text",
    hasFlyers: "select",
    flyersSentDate: "text",
    flyersLocation: "text",
    doctorPositionCategoryId: "text",
    orientationNumber: "text",
    tags: "text",
    notes: "text",
    legacyId: "text",
    representativeId: "select",
  },
};

const COUNTRY_CODES = new Set([
  "SK", "CZ", "AT", "HU", "RO", "IT", "DE", "US", "CH",
]);

const FIXED_SELECT_VALUES: Record<MedicalPartnerEntity, Record<string, Set<string>>> = {
  hospital: {
    country: COUNTRY_CODES,
    status: new Set(["active", "inactive"]),
    personnel: new Set(["with", "without"]),
    svetZdravia: new Set(["true", "false"]),
    autoRecruiting: new Set(["true", "false"]),
    hasPhone: new Set(["true", "false"]),
    hasEmail: new Set(["true", "false"]),
    hasGps: new Set(["true", "false"]),
  },
  clinic: {
    country: COUNTRY_CODES,
    status: new Set(["active", "inactive"]),
    pipeline: new Set([
      "no_status",
      "initial:not_contacted", "initial:former", "initial:active_contract",
      "coop:unknown", "coop:interested", "coop:not_interested",
      "contract_int:unknown", "contract_int:interested", "contract_int:not_interested",
      "contract:none", "contract:active",
    ]),
    hasWebsite: new Set(["true", "false"]),
    hasPhone: new Set(["true", "false"]),
    hasEmail: new Set(["true", "false"]),
    hasGps: new Set(["true", "false"]),
    isReferredByDoctor: new Set(["true", "false"]),
    isFromConference: new Set(["true", "false"]),
    initialStatus: new Set(["not_contacted", "former", "active_contract"]),
    interestCooperation: new Set(["unknown", "interested", "not_interested"]),
    interestContract: new Set(["unknown", "interested", "not_interested"]),
    contractStatus: new Set(["none", "active"]),
    hasFlyers: new Set(["true", "false"]),
  },
};

const VALUE_OPS = new Set<MedicalPartnerFilterOp>([
  "is",
  "isAny",
  "isNot",
  "contains",
]);

function allowedOps(kind: FilterFieldKind): MedicalPartnerFilterOp[] {
  switch (kind) {
    case "multiselect":
      return ["isAny", "isNot", "isEmpty", "isNotEmpty"];
    case "select":
      return ["is", "isAny", "isNot", "isEmpty", "isNotEmpty"];
    case "text":
      return ["contains", "is", "isNot", "isEmpty", "isNotEmpty"];
    case "boolean":
      return ["is", "isNot"];
  }
}

/**
 * Validate the wire format instead of treating an unknown rule as a no-op.
 * This is important for bulk writes: malformed input must never widen the
 * selected set.
 */
export function validateMedicalPartnerRules(
  entity: MedicalPartnerEntity,
  rawRules: unknown,
): MedicalPartnerFilterRule[] {
  if (rawRules === undefined) return [];
  if (!Array.isArray(rawRules)) {
    throw new Error("filterRules must be an array");
  }

  const fields = MEDICAL_PARTNER_FILTER_FIELDS[entity];
  return rawRules.map((raw, index) => {
    if (!raw || typeof raw !== "object") {
      throw new Error(`filterRules[${index}] must be an object`);
    }
    const rule = raw as Record<string, unknown>;
    const field = rule.field;
    const op = rule.op;
    if (typeof field !== "string" || !fields[field]) {
      throw new Error(`filterRules[${index}].field is not supported for ${entity}s`);
    }
    if (typeof op !== "string" || !allowedOps(fields[field]).includes(op as MedicalPartnerFilterOp)) {
      throw new Error(`filterRules[${index}].op is not supported for field ${field}`);
    }
    const conjunction = rule.conjunction === undefined ? "and" : rule.conjunction;
    if (conjunction !== "and" && conjunction !== "or") {
      throw new Error(`filterRules[${index}].conjunction must be "and" or "or"`);
    }

    let value = rule.value;
    if (VALUE_OPS.has(op as MedicalPartnerFilterOp)) {
      const values = Array.isArray(value) ? value : [value];
      if (values.length === 0 || values.some((v) => typeof v !== "string" || !v.trim())) {
        throw new Error(`filterRules[${index}].value is required`);
      }
      if (op === "is" || op === "isNot" || op === "contains") {
        if (Array.isArray(value) && value.length !== 1) {
          throw new Error(`filterRules[${index}].value must be a scalar for ${op}`);
        }
      }
      const fixedValues = FIXED_SELECT_VALUES[entity][field];
      if (fixedValues) {
        const candidateValues = (Array.isArray(value) ? value : [value]) as string[];
        const normalizedValues = candidateValues.map((candidate) =>
          field === "country" ? candidate.toUpperCase() : candidate,
        );
        const invalid = normalizedValues.filter((candidate) => !fixedValues.has(candidate));
        if (invalid.length) {
          throw new Error(
            `filterRules[${index}].value contains unsupported value(s) for ${field}: ${invalid.join(", ")}`,
          );
        }
        if (field === "country") {
          if (Array.isArray(value)) {
            value = normalizedValues;
          } else {
            value = normalizedValues[0];
          }
        }
      }
    } else if (value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0)) {
      throw new Error(`filterRules[${index}].value must be omitted for ${op}`);
    }

    return {
      id: typeof rule.id === "string" ? rule.id : undefined,
      conjunction,
      field,
      op: op as MedicalPartnerFilterOp,
      value: Array.isArray(value) ? [...value] as string[] : typeof value === "string" ? value : undefined,
    };
  });
}

function asText(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function asDateText(value: unknown): string {
  return asText(value).slice(0, 10);
}

function boolValue(value: unknown): string {
  return value ? "true" : "false";
}

/**
 * Return the same display value that the list-page matchers use for a field.
 * `representativeId` and `hasPersonnel` are allowed to be supplied by the
 * server because they are derived from assignment history.
 */
export function medicalPartnerFieldValue(
  entity: MedicalPartnerEntity,
  row: Record<string, any>,
  field: string,
  derived: { representativeId?: string | null; hasPersonnel?: boolean } = {},
): string {
  if (entity === "hospital") {
    switch (field) {
      case "country": return asText(row.countryCode);
      case "status": return row.isActive ? "active" : "inactive";
      case "personnel": return derived.hasPersonnel ? "with" : "without";
      case "name": return asText(row.name);
      case "fullName": return asText(row.fullName || row.name);
      case "city": return asText(row.city);
      case "region": return asText(row.region);
      case "district": return asText(row.district);
      case "postalCode": return asText(row.postalCode);
      case "streetNumber": return asText(row.streetNumber || row.street);
      case "contactPerson": return asText(row.contactPerson);
      case "phone": return asText(row.phone);
      case "email": return asText(row.email);
      case "svetZdravia": return boolValue(row.svetZdravia);
      case "autoRecruiting": return boolValue(row.autoRecruiting);
      case "representativeId": return Object.prototype.hasOwnProperty.call(derived, "representativeId")
        ? asText(derived.representativeId)
        : asText(row.representativeId);
      case "responsiblePersonId": return asText(row.responsiblePersonId);
      case "laboratoryId": return asText(row.laboratoryId);
      case "tags": return Array.isArray(row.tags) ? row.tags.join(",") : asText(row.tags);
      case "dataSource": return asText(row.dataSource);
      case "createdByCollaboratorId": return asText(row.createdByCollaboratorId);
      case "legacyId": return asText(row.legacyId);
      case "hasPhone": return boolValue(row.phone);
      case "hasEmail": return boolValue(row.email);
      case "hasGps": return boolValue(
        (row.gpsLat && row.gpsLng) || (row.latitude && row.longitude),
      );
      default: return "";
    }
  }

  switch (field) {
    case "country": return asText(row.countryCode);
    case "status": return row.isActive ? "active" : "inactive";
    case "pipeline": {
      if (row.contractStatus) return `contract:${row.contractStatus}`;
      if (row.interestContract) return `contract_int:${row.interestContract}`;
      if (row.interestCooperation) return `coop:${row.interestCooperation}`;
      if (row.initialStatus) return `initial:${row.initialStatus}`;
      return "no_status";
    }
    case "name": return asText(row.name);
    case "doctorName": return asText(row.doctorName);
    case "doctorTitle": return asText(row.doctorTitle);
    case "doctorFirstName": return asText(row.doctorFirstName);
    case "doctorLastName": return asText(row.doctorLastName);
    case "ico": return asText(row.ico);
    case "pzsCode": return asText(row.pzsCode);
    case "pzsName": return asText(row.pzsName);
    case "idZz": return asText(row.idZz);
    case "city": return asText(row.city);
    case "region": return asText(row.region);
    case "district": return asText(row.district);
    case "street": return asText(row.street);
    case "streetNumber": return asText(row.streetNumber);
    case "postalCode": return asText(row.postalCode);
    case "address": return [row.street, row.streetNumber, row.city].filter(Boolean).join(" ");
    case "phone": return asText(row.phone);
    case "phone2": return asText(row.phone2);
    case "phone3": return asText(row.phone3);
    case "email": return asText(row.email);
    case "email2": return asText(row.email2);
    case "email3": return asText(row.email3);
    case "website": return asText(row.website);
    case "hasWebsite": return boolValue(row.website);
    case "hasPhone": return boolValue(row.phone || row.phone2 || row.phone3);
    case "hasEmail": return boolValue(row.email || row.email2 || row.email3);
    case "hasGps": return boolValue(
      (row.gpsLat && row.gpsLng) || (row.latitude && row.longitude),
    );
    case "isReferredByDoctor": return boolValue(row.isReferredByDoctor);
    case "isFromConference": return boolValue(row.isFromConference);
    case "conferenceName": return asText(row.conferenceName);
    case "initialStatus": return asText(row.initialStatus);
    case "interestCooperation": return asText(row.interestCooperation);
    case "interestContract": return asText(row.interestContract);
    case "contractStatus": return asText(row.contractStatus);
    case "lastCallResult": return asText(row.lastCallResult);
    case "lastCallNote": return asText(row.lastCallNote);
    case "leadSource": return asText(row.leadSource);
    case "leadSourceNotes": return asText(row.leadSourceNotes);
    case "leadSourceDate": return asDateText(row.leadSourceDate);
    case "conferenceDate": return asDateText(row.conferenceDate);
    case "nextContactDate": return asDateText(row.nextContactDate);
    case "contractSentDate": return asDateText(row.contractSentDate);
    case "contractReturnedDate": return asDateText(row.contractReturnedDate);
    case "hasFlyers": return boolValue(row.hasFlyers);
    case "flyersSentDate": return asDateText(row.flyersSentDate);
    case "flyersLocation": return asText(row.flyersLocation);
    case "doctorPositionCategoryId": return asText(row.doctorPositionCategoryId);
    case "orientationNumber": return asText(row.orientationNumber);
    case "tags": return Array.isArray(row.tags) ? row.tags.join(",") : asText(row.tags);
    case "notes": return asText(row.notes);
    case "legacyId": return asText(row.legacyId);
    case "representativeId": return Object.prototype.hasOwnProperty.call(derived, "representativeId")
      ? asText(derived.representativeId)
      : asText(row.representativeId);
    default: return "";
  }
}

function ruleMatches(
  entity: MedicalPartnerEntity,
  row: Record<string, any>,
  rule: MedicalPartnerFilterRule,
  derived: { representativeId?: string | null; hasPersonnel?: boolean },
): boolean {
  const fieldValue = medicalPartnerFieldValue(entity, row, rule.field, derived);
  const values = Array.isArray(rule.value)
    ? rule.value
    : rule.value === undefined
      ? []
      : [rule.value];
  const isBooleanField =
    ["svetZdravia", "autoRecruiting", "hasWebsite", "hasPhone", "hasEmail", "hasGps",
      "isReferredByDoctor", "isFromConference", "hasFlyers"].includes(rule.field);

  if (rule.op === "isEmpty") return isBooleanField ? fieldValue === "false" : !fieldValue;
  if (rule.op === "isNotEmpty") return isBooleanField ? fieldValue === "true" : !!fieldValue;
  if (rule.op === "contains") {
    return values.some((value) => fieldValue.toLowerCase().includes(value.toLowerCase()));
  }
  if (rule.op === "is" || rule.op === "isAny") {
    return values.some((value) => fieldValue === value);
  }
  if (rule.op === "isNot") {
    return values.every((value) => fieldValue !== value);
  }
  return false;
}

export function matchesMedicalPartnerRules(
  entity: MedicalPartnerEntity,
  row: Record<string, any>,
  rules: MedicalPartnerFilterRule[],
  derived: { representativeId?: string | null; hasPersonnel?: boolean } = {},
): boolean {
  if (rules.length === 0) return true;
  let result = ruleMatches(entity, row, rules[0], derived);
  for (let i = 1; i < rules.length; i += 1) {
    const matched = ruleMatches(entity, row, rules[i], derived);
    result = rules[i].conjunction === "or" ? result || matched : result && matched;
  }
  return result;
}

export function matchesMedicalPartnerSearch(
  entity: MedicalPartnerEntity,
  row: Record<string, any>,
  search: string | undefined,
): boolean {
  const needle = search?.trim().toLowerCase();
  if (!needle) return true;
  const values =
    entity === "clinic"
      ? [row.name, row.doctorName, row.doctorFirstName, row.doctorLastName, row.city, row.phone, row.email, row.address, row.region]
      : [row.name, row.fullName, row.city, row.contactPerson, row.phone, row.email, row.region];
  return values.some((value) => asText(value).toLowerCase().includes(needle));
}

/**
 * Preview IDs are compared as sets, not as paginated/order-dependent arrays.
 * The same helper is used by the confirm path so a reordered response cannot
 * accidentally invalidate (or widen) a preview.
 */
export function previewSelectionMatches(
  previewIds: string[],
  currentIds: string[],
): boolean {
  const preview = [...new Set(previewIds)].sort();
  const current = [...new Set(currentIds)].sort();
  return preview.length === current.length
    && preview.every((id, index) => id === current[index]);
}
