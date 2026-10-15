import { createHash } from "node:crypto";
import type { NormalizedCompany, RegistryPerson, RegistryReference } from "../../shared/healthcare-legal-entity";

export class LegalEntityError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export function normalizeIco(input: unknown): string {
  if (typeof input !== "string") throw new LegalEntityError("ico_invalid");
  const value = input.replace(/\s/g, "");
  if (!/^\d{8}$/.test(value)) throw new LegalEntityError("ico_invalid");
  return value;
}
type Json = Record<string, any>;
const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const rows = (value: unknown): Json[] => Array.isArray(value) ? value.filter(x => x && typeof x === "object") : [];
const current = (value: unknown): Json | undefined => rows(value).find(x => x.current === true) ||
  rows(value).find(x => x.current !== false && x.effectiveToSpecified !== true);
function label(value: any): string | null {
  if (typeof value === "string") return text(value);
  if (!value || typeof value !== "object") return null;
  for (const key of ["name", "label", "value", "itemName", "codelistItemName", "item"]) {
    const result = label(value[key]);
    if (result) return result;
  }
  return null;
}
function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function registryPeopleFromExtract(extract: Json): RegistryPerson[] {
  const company = extract.legalPerson?.corporateBody || {};
  const people: RegistryPerson[] = [];
  for (const kind of ["statutoryBody", "stakeholder", "founder"]) {
    for (const row of rows(company[kind])) {
      const person = row.personData || {};
      const nameData = person.physicalPerson?.personName || {};
      const name = text(nameData.formattedName) || text(nameData.legalName) ||
        text([...(Array.isArray(nameData.givenName) ? nameData.givenName : []),
          ...rows(nameData.familyName).map(item => item.value || item.familyName)].filter(Boolean).join(" ")) ||
        text(person.corporateBody?.corporateBodyFullName);
      if (!name) continue;
      const role = text(row.function) || label(row.statutoryBodyType || row.stakeholderType) || kind;
      const validFrom = text(row.functionCreationDate) || text(row.effectiveFrom);
      const validTo = text(row.functionTerminationDate) || (row.effectiveToSpecified ? text(row.effectiveTo) : null);
      // Source identity, not name matching. Different source people never auto-merge in CRM.
      const key = createHash("sha256").update(canonical({ kind, person, role, validFrom })).digest("hex");
      people.push({ key, name, role, kind, current: row.current === true && !row.functionTerminationDate, validFrom, validTo,
        firstName: text(Array.isArray(nameData.givenName) ? nameData.givenName.join(" ") : null),
        lastName: text(rows(nameData.familyName).map(item => item.value).filter(Boolean).join(" ")),
        isNaturalPerson: Boolean(person.physicalPerson && !person.corporateBody?.corporateBodyFullName) });
    }
  }
  return Array.from(new Map(people.map(person => [person.key, person])).values());
}
export function normalizeOrsrExtract(ico: string, match: Json, extract: Json): NormalizedCompany {
  const source = extract.legalPerson;
  const company = source?.corporateBody;
  if (!company || typeof company !== "object") throw new LegalEntityError("registry_unavailable", 502);
  const name = text(current(company.corporateBodyFullName)?.value) || text(match.corporateBodyFullName);
  if (!name) throw new LegalEntityError("registry_unavailable", 502);
  const ids = rows(source.id).filter(id => id.current === true);
  if (ids.length && !ids.some(id => text(id.identifierValue)?.replace(/\s/g, "") === ico))
    throw new LegalEntityError("registry_identity_conflict", 502);
  const address = current(source.physicalAddress);
  const reference = match.fileReference;
  if (!reference || !/^[A-Za-zšŠ]+$/.test(reference.section || "") ||
      !/^[BSVLRTPN]$/.test(reference.court || "") || !Number.isSafeInteger(reference.insertNumber))
    throw new LegalEntityError("registry_unavailable", 502);
  const terminatedAt = text(company.termination);
  return {
    countryCode: "SK", ico, name,
    legalForm: label(current(company.legalForm)) || (extract.legalForm != null ? String(extract.legalForm) : null),
    registeredAddress: text(address?.addressLine) ||
      (address ? text([address.streetName, address.buildingNumber || address.propertyRegistrationNumber,
        address.buildingIndex ? `/${address.buildingIndex}` : null].filter(Boolean).join(" ")) : null) ||
      text(match.physicalAddressLine1),
    city: label(address?.municipality) || text(match.physicalAddressLine2)?.replace(/^\d{3}\s?\d{2}\s+/, "") || null,
    postalCode: text(address?.deliveryAddress?.postalCode) || text(match.physicalAddressLine2)?.match(/^\d{3}\s?\d{2}/)?.[0] || null,
    status: terminatedAt ? "terminated" : "active",
    registryReference: { section: reference.section, court: reference.court, insertNumber: reference.insertNumber },
    establishedAt: text(company.establishment), terminatedAt,
  };
}
export interface RegistryVerification {
  company: NormalizedCompany; registryPeople: RegistryPerson[];
  rawData: Record<string, unknown>; documents: Json[]; checkedAt: string; sourceUpdatedAt: string | null;
}
export type RegistryLoader = (ico: string) => Promise<RegistryVerification>;

/** Fixed official host only: no browser-supplied URL, credentials, or scraping. */
export async function fetchOrsrJson(path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(path, "https://sluzby.orsr.sk");
  if (url.origin !== "https://sluzby.orsr.sk" || !path.startsWith("/api/legal-person"))
    throw new LegalEntityError("invalid");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" }, signal: AbortSignal.timeout(25_000), redirect: "error",
    });
    if (!response.ok || !response.body) throw new Error("registry");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 12 * 1024 * 1024) { await reader.cancel(); throw new Error("registry"); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { throw new LegalEntityError("registry_unavailable", 502); }
}
export async function loadOrsrCompany(input: string, read = fetchOrsrJson): Promise<RegistryVerification> {
  const ico = normalizeIco(input);
  const activeSearch = await read("/api/legal-person", {
    "Filter.CorporateBodyFullNameOrRegistrationNumber": ico, "Filter.IncludeTerminated": "false", Take: "100",
  });
  if (!activeSearch || !Array.isArray(activeSearch.data)) throw new LegalEntityError("registry_unavailable", 502);
  // An IČO can occur in several historical court files. Prefer the unique
  // current entry; only search terminated entries when no current match exists.
  const activeMatches = activeSearch.data.filter((match: Json) => text(match.registrationNumber)?.replace(/\s/g, "") === ico);
  const search = activeMatches.length ? activeSearch : await read("/api/legal-person", {
    "Filter.CorporateBodyFullNameOrRegistrationNumber": ico, "Filter.IncludeTerminated": "true", Take: "100",
  });
  if (!search || !Array.isArray(search.data)) throw new LegalEntityError("registry_unavailable", 502);
  const matches = search.data.filter((match: Json) => text(match.registrationNumber)?.replace(/\s/g, "") === ico);
  if (!matches.length) throw new LegalEntityError("not_found", 404);
  if (matches.length !== 1 || search.filteredCount > 100) throw new LegalEntityError("ambiguous_match", 409);
  const match = matches[0];
  const ref: RegistryReference = match.fileReference;
  if (!ref || !Number.isSafeInteger(ref.insertNumber) || ref.insertNumber < 1 ||
      !/^[A-Za-zšŠ]+$/.test(ref.section || "") || !/^[BSVLRTPN]$/.test(ref.court || ""))
    throw new LegalEntityError("registry_unavailable", 502);
  const params = { oddiel: ref.section, vlozka: String(ref.insertNumber), sud: ref.court };
  const [extract, fullExtract, documents] = await Promise.all([
    read("/api/legal-person/extract", params),
    read("/api/legal-person/extract-full", params),
    read("/api/legal-person/documents", params),
  ]);
  if (!Array.isArray(documents) || !fullExtract?.legalPerson?.corporateBody)
    throw new LegalEntityError("registry_unavailable", 502);
  const company = normalizeOrsrExtract(ico, match, extract);
  // Validate all retained extracts belong to the selected registered subject.
  normalizeOrsrExtract(ico, match, fullExtract);
  return {
    company, registryPeople: registryPeopleFromExtract(fullExtract), documents,
    rawData: { search, activeSearch, extract, fullExtract, documents, source: "https://sluzby.orsr.sk", version: 1 },
    checkedAt: new Date().toISOString(), sourceUpdatedAt: text(extract.dataSyncDate),
  };
}
