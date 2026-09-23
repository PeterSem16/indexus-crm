import type { PriorityContact } from "./priority-builder";

export type PrioritySearchField = "all" | "name" | "phone" | "email" | "city";
export type PrioritySearchMatchField =
  | "name"
  | "personnel"
  | "organization"
  | "specialty"
  | "phone"
  | "email"
  | "city";

export interface PriorityContactSearchDetails {
  name: string;
  personnel: Array<{ name: string; phones: string[]; emails: string[] }>;
  organization: string;
  specialty: string;
  phones: string[];
  emails: string[];
  city: string;
}

export interface PriorityTextMatchRange {
  start: number;
  end: number;
}

export interface PriorityContactSearchMatch {
  field: PrioritySearchMatchField;
  value: string;
  ranges: PriorityTextMatchRange[];
}

interface SearchCustomer {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  phone?: string | null;
  mobile?: string | null;
  mobile2?: string | null;
  otherContact?: string | null;
  email?: string | null;
  email2?: string | null;
  city?: string | null;
  companyName?: string | null;
}

interface SearchHospital {
  name?: string | null;
  fullName?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
}

interface SearchClinic {
  name?: string | null;
  doctorName?: string | null;
  doctorTitle?: string | null;
  doctorFirstName?: string | null;
  doctorLastName?: string | null;
  phone?: string | null;
  phone2?: string | null;
  phone3?: string | null;
  email?: string | null;
  email2?: string | null;
  email3?: string | null;
  city?: string | null;
}

interface SearchCollaborator {
  titleBefore?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  titleAfter?: string | null;
  workplaceName?: string | null;
  phone?: string | null;
  mobile?: string | null;
  mobile2?: string | null;
  otherContact?: string | null;
  email?: string | null;
  city?: string | null;
}

interface SearchablePriorityContact {
  contactType?: string | null;
  customer?: SearchCustomer | null;
  hospital?: SearchHospital | null;
  clinic?: SearchClinic | null;
  collaborator?: SearchCollaborator | null;
  priorityCity?: string | null;
}

type SearchEntity = SearchCustomer | SearchHospital | SearchClinic | SearchCollaborator;

const contactTypes = ["customer", "hospital", "clinic", "collaborator"] as const;
type PriorityContactType = (typeof contactTypes)[number];

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nonEmpty(value: unknown): string {
  const result = text(value);
  return result.trim() ? result : "";
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const result = nonEmpty(value);
    if (result) return result;
  }
  return "";
}

function joinedName(values: unknown[]): string {
  return values
    .map(value => nonEmpty(value))
    .filter(Boolean)
    .join(" ");
}

function values(...items: unknown[]): string[] {
  return Array.from(new Set(items.map(nonEmpty).filter(Boolean)));
}

type OtherContactKind = "email" | "phone";

function legitimateOtherContactKind(value: unknown): OtherContactKind | null {
  const candidate = nonEmpty(value);
  if (!candidate) return null;
  // `otherContact` is also used for arbitrary notes. Only promote values that
  // are recognizably reachable as an email address or phone number.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) return "email";
  if (!/^[\d\s+().\-\/]+$/.test(candidate)) return null;
  return (candidate.match(/\d/g) || []).length >= 6 ? "phone" : null;
}

function hasSearchableEntityData(entity: SearchEntity): boolean {
  if ("doctorName" in entity) {
    return Boolean(
      entity.name || entity.doctorName || entity.doctorTitle ||
      entity.doctorFirstName || entity.doctorLastName || entity.phone ||
      entity.phone2 || entity.phone3 ||
      entity.email || entity.email2 || entity.email3 || entity.city,
    );
  }
  if ("contactPerson" in entity) {
    return Boolean(entity.name || entity.fullName || entity.contactPerson || entity.phone || entity.email || entity.city);
  }
  if ("workplaceName" in entity) {
    return Boolean(
      entity.titleBefore || entity.firstName || entity.middleName || entity.lastName ||
      entity.titleAfter || entity.workplaceName || entity.phone || entity.mobile ||
      entity.mobile2 || entity.otherContact || entity.email || entity.city,
    );
  }
  const customer = entity as SearchCustomer;
  return Boolean(
    customer.firstName || customer.lastName || customer.name || customer.phone ||
    customer.mobile || customer.mobile2 || customer.otherContact || customer.email ||
    customer.email2 || customer.city || customer.companyName,
  );
}

/**
 * Select the one entity represented by a campaign contact. A declared type is
 * authoritative: an accidentally populated sibling entity must not leak into
 * search. Only old payloads with no contactType can use the single-entity
 * fallback.
 */
function getSearchEntity(contact: PriorityContact): { type: PriorityContactType; entity: SearchEntity } | null {
  const source = contact as unknown as SearchablePriorityContact;
  const declaredType = source.contactType;
  if (contactTypes.includes(declaredType as PriorityContactType)) {
    const entity = source[declaredType as PriorityContactType];
    return entity ? { type: declaredType as PriorityContactType, entity } : null;
  }
  if (declaredType != null && declaredType !== "") return null;

  const populated = contactTypes
    .map(type => ({ type, entity: source[type] }))
    .filter((item): item is { type: PriorityContactType; entity: SearchEntity } =>
      Boolean(item.entity && hasSearchableEntityData(item.entity)),
    );
  return populated.length === 1 ? populated[0] : null;
}

export function getPriorityContactSearchDetails(contact: PriorityContact): PriorityContactSearchDetails {
  const source = getSearchEntity(contact);
  if (!source) {
    return { name: "", personnel: [], organization: "", specialty: "", phones: [], emails: [], city: "" };
  }

  const personnel = source.type === "clinic" || source.type === "hospital"
    ? (contact.personnelSearch || []).filter(person => Boolean(nonEmpty(person.name))).map(person => ({
        name: nonEmpty(person.name),
        phones: values(person.phone, person.mobile, person.mobile2),
        emails: values(person.email),
      }))
    : [];
  switch (source.type) {
    case "clinic": {
      const clinic = source.entity as SearchClinic;
      const doctor = firstNonEmpty(
        clinic.doctorName,
        joinedName([clinic.doctorTitle, clinic.doctorFirstName, clinic.doctorLastName]),
      );
      return {
        name: doctor,
        personnel,
        organization: nonEmpty(clinic.name),
        specialty: "",
        phones: values(clinic.phone, clinic.phone2, clinic.phone3),
        emails: values(clinic.email, clinic.email2, clinic.email3),
        city: nonEmpty(clinic.city),
      };
    }
    case "hospital": {
      const hospital = source.entity as SearchHospital;
      const organization = firstNonEmpty(hospital.name, hospital.fullName);
      return {
        name: nonEmpty(hospital.contactPerson),
        personnel,
        organization,
        specialty: "",
        phones: values(hospital.phone),
        emails: values(hospital.email),
        city: nonEmpty(hospital.city),
      };
    }
    case "collaborator": {
      const collaborator = source.entity as SearchCollaborator;
      return {
        name: joinedName([
          collaborator.titleBefore,
          collaborator.firstName,
          collaborator.middleName,
          collaborator.lastName,
          collaborator.titleAfter,
        ]),
        personnel,
        organization: nonEmpty(collaborator.workplaceName),
        specialty: "",
        phones: values(
          collaborator.phone,
          collaborator.mobile,
          collaborator.mobile2,
          legitimateOtherContactKind(collaborator.otherContact) === "phone" ? collaborator.otherContact : "",
        ),
        emails: values(
          collaborator.email,
          legitimateOtherContactKind(collaborator.otherContact) === "email" ? collaborator.otherContact : "",
        ),
        city: firstNonEmpty(source.type === "collaborator" ? (contact as unknown as SearchablePriorityContact).priorityCity : "", collaborator.city),
      };
    }
    case "customer": {
      const customer = source.entity as SearchCustomer;
      return {
        name: joinedName([customer.firstName, customer.lastName]),
        personnel,
        organization: nonEmpty(customer.companyName),
        specialty: "",
        phones: values(
          customer.phone,
          customer.mobile,
          customer.mobile2,
          legitimateOtherContactKind(customer.otherContact) === "phone" ? customer.otherContact : "",
        ),
        emails: values(
          customer.email,
          customer.email2,
          legitimateOtherContactKind(customer.otherContact) === "email" ? customer.otherContact : "",
        ),
        city: nonEmpty(customer.city),
      };
    }
  }
}

interface NormalizedText {
  tokens: string[];
  starts: number[];
  ends: number[];
}

const unicodeMark = new RegExp("^\\p{M}$", "u");
function isMark(value: string): boolean {
  return unicodeMark.test(value);
}

/**
 * Normalize one visible string while retaining UTF-16 offsets into the
 * original. A combining sequence is represented by one token whose range
 * includes its marks, so a rich-result highlight never splits a grapheme.
 */
function normalizeText(value: string): NormalizedText {
  const tokens: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;

  while (offset < value.length) {
    const codePoint = String.fromCodePoint(value.codePointAt(offset)!);
    const start = offset;
    offset += codePoint.length;
    let cluster = codePoint;
    while (offset < value.length) {
      const next = String.fromCodePoint(value.codePointAt(offset)!);
      if (!isMark(next)) break;
      cluster += next;
      offset += next.length;
    }
    const normalized = cluster.normalize("NFD").toLocaleLowerCase();
    for (const normalizedCodePoint of normalized) {
      if (isMark(normalizedCodePoint)) continue;
      tokens.push(normalizedCodePoint);
      starts.push(start);
      ends.push(offset);
    }
  }
  return { tokens, starts, ends };
}

function phoneMatchRanges(value: string, query: string): PriorityTextMatchRange[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery || /[^\d\s+().\-\/]/.test(trimmedQuery)) return [];
  const queryDigits = Array.from(trimmedQuery).filter(character => /\d/.test(character)).join("");
  if (!queryDigits) return [];

  const sourceDigits: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const codePoint of value) {
    const start = offset;
    offset += codePoint.length;
    if (!/\d/.test(codePoint)) continue;
    sourceDigits.push(codePoint);
    starts.push(start);
    ends.push(offset);
  }

  const ranges: PriorityTextMatchRange[] = [];
  for (let index = 0; index <= sourceDigits.length - queryDigits.length;) {
    if (sourceDigits.slice(index, index + queryDigits.length).join("") !== queryDigits) {
      index++;
      continue;
    }
    ranges.push({ start: starts[index], end: ends[index + queryDigits.length - 1] });
    index += queryDigits.length;
  }
  return ranges;
}

export function getPriorityTextMatchRanges(
  value: string,
  query: string,
  phone = false,
): PriorityTextMatchRange[] {
  if (!value || !query.trim()) return [];
  if (phone) return phoneMatchRanges(value, query);

  const source = normalizeText(value);
  const needle = normalizeText(query.trim()).tokens;
  if (!needle.length || needle.length > source.tokens.length) return [];
  const ranges: PriorityTextMatchRange[] = [];
  for (let index = 0; index <= source.tokens.length - needle.length;) {
    let matches = true;
    for (let needleIndex = 0; needleIndex < needle.length; needleIndex++) {
      if (source.tokens[index + needleIndex] !== needle[needleIndex]) {
        matches = false;
        break;
      }
    }
    if (!matches) {
      index++;
      continue;
    }
    ranges.push({
      start: source.starts[index],
      end: source.ends[index + needle.length - 1],
    });
    index += needle.length;
  }
  return ranges;
}

function addMatch(
  matches: PriorityContactSearchMatch[],
  field: PrioritySearchMatchField,
  value: string,
  query: string,
  phone = false,
): void {
  if (!value) return;
  const ranges = getPriorityTextMatchRanges(value, query, phone);
  if (ranges.length) matches.push({ field, value, ranges });
}

export function getPriorityContactSearchMatches(
  contact: PriorityContact,
  query: string,
  field: PrioritySearchField,
): PriorityContactSearchMatch[] {
  if (!query.trim()) return [];
  const details = getPriorityContactSearchDetails(contact);
  const matches: PriorityContactSearchMatch[] = [];
  const include = (candidate: PrioritySearchField): boolean => field === "all" || field === candidate;

  if (include("name")) addMatch(matches, "name", details.name, query);
  if (field === "all" || field === "name" || field === "phone" || field === "email") {
    for (const person of details.personnel) {
      if (include("name")) addMatch(matches, "personnel", person.name, query);
      if (include("phone")) for (const phone of person.phones) addMatch(matches, "personnel", phone, query, true);
      if (include("email")) for (const email of person.emails) addMatch(matches, "personnel", email, query);
    }
  }
  if (field === "all") {
    addMatch(matches, "organization", details.organization, query);
    addMatch(matches, "specialty", details.specialty, query);
  }
  if (include("phone")) {
    for (const phone of details.phones) addMatch(matches, "phone", phone, query, true);
  }
  if (include("email")) {
    for (const email of details.emails) addMatch(matches, "email", email, query);
  }
  if (include("city")) addMatch(matches, "city", details.city, query);
  return matches;
}