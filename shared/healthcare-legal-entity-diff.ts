import type { NormalizedCompany, RegistryPerson, RegistryComparison, RegistryChangeField, SnapshotSummary } from "./healthcare-legal-entity";

export interface RegistrySnapshot {
  summary: SnapshotSummary;
  company: NormalizedCompany;
  people: RegistryPerson[];
}
export function hasRegistryChanges(comparison: RegistryComparison): boolean {
  return !!comparison.previous && (comparison.fields.length > 0 || comparison.roles.removed.length > 0 || comparison.roles.added.length > 0);
}
export function registryReviewStatus(comparison: RegistryComparison) {
  return !comparison.previous ? "baseline" as const : !hasRegistryChanges(comparison) ? "unchanged" as const
    : comparison.current.review ? "reviewed" as const : "pending" as const;
}
const fields: RegistryChangeField[] = ["name", "registeredAddress", "city", "postalCode", "legalForm", "status", "vatRegistered", "taxInactive"];
const text = (value: string | null | undefined) => value?.normalize("NFC").replace(/\s+/g, " ").trim() || null;
function companyValue(company: NormalizedCompany, field: RegistryChangeField) {
  if (field === "vatRegistered" || field === "taxInactive") {
    const value = company.taxStatus?.[field === "vatRegistered" ? "vatRegistered" : "inactive"];
    return typeof value === "boolean" ? String(value) : null;
  }
  return text(company[field]);
}

// Registry hashes include private source fields. Compare only the public role
// facts we actually display, independently of ordering and source-only changes.
function roleSignature(person: RegistryPerson) {
  return JSON.stringify([text(person.name), text(person.role), text(person.kind),
    person.current, text(person.validFrom), text(person.validTo)]);
}
// Bump when the public diff semantics change; persisted keys are rebuilt lazily.
export const REGISTRY_COMPARISON_KEY_VERSION = 2;
/** Exact (not hashed) canonical public facts, preserving duplicate role counts. */
export function registryComparisonKey(company: NormalizedCompany, people: RegistryPerson[]) {
  return JSON.stringify([fields.map(field => companyValue(company, field)), people.map(roleSignature).sort()]);
}
function rolesAbsentFrom(source: RegistryPerson[], other: RegistryPerson[]) {
  const counts = new Map<string, number>();
  for (const role of other) {
    const key = roleSignature(role);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return source.filter(role => {
    const key = roleSignature(role);
    const count = counts.get(key) || 0;
    if (!count) return true;
    counts.set(key, count - 1);
    return false;
  }).sort((a, b) => roleSignature(a).localeCompare(roleSignature(b)));
}
export function compareRegistrySnapshots(previous: RegistrySnapshot | null, current: RegistrySnapshot): RegistryComparison {
  return {
    previous: previous?.summary || null,
    current: current.summary,
    fields: previous ? fields.flatMap(field => {
      const before = companyValue(previous.company, field);
      const after = companyValue(current.company, field);
      return before === after ? [] : [{ field, before, after }];
    }) : [],
    roles: previous ? {
      removed: rolesAbsentFrom(previous.people, current.people),
      added: rolesAbsentFrom(current.people, previous.people),
    } : { removed: [], added: [] },
  };
}
