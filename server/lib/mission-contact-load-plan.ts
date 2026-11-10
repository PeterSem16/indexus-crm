import { createHash } from "node:crypto";

export const contactKinds = ["customer", "clinic", "hospital", "collaborator"] as const;
export type ContactKind = typeof contactKinds[number];
export const entityTables = { customer: "customers", clinic: "clinics", hospital: "hospitals", collaborator: "collaborators" } as const;
export const entityColumns = { customer: "customer_id", clinic: "clinic_id", hospital: "hospital_id", collaborator: "collaborator_id" } as const;
export type Candidate = { type: ContactKind; id?: string; name: string; country: string; data?: Record<string, unknown>; row: number; error?: string };
export type PlanItem = Candidate & { disposition: "new" | "existing" | "invalid"; reason?: string; sourceHash?: string };
function canonical(value: any): any {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
export const normalized = (value: unknown) => String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
const phone = (value: unknown) => String(value ?? "").replace(/[^\d+]/g, "");
export function entityName(type: ContactKind, row: any) {
  return type === "customer" || type === "collaborator"
    ? `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() : String(row.name ?? "");
}
export function membershipHash(rows: any[]) {
  return digest(rows.map(r => [r.id, r.contact_type, r.customer_id, r.clinic_id, r.hospital_id, r.collaborator_id]).sort((a,b) => String(a[0]).localeCompare(String(b[0]))));
}
export function planContacts(candidates: Candidate[], existing: any[], directory: Record<ContactKind, any[]>, countries: string[]): PlanItem[] {
  const enrolled = new Set(existing.map(r => `${r.contact_type}:${r[entityColumns[r.contact_type as ContactKind]]}`));
  const seen = new Set<string>();
  const newProfiles = new Map<string, string>();
  return candidates.map(candidate => {
    const item: PlanItem = { ...candidate, disposition: "new" };
    const invalid = (reason: string) => ({ ...item, disposition: "invalid" as const, reason });
    if (candidate.error) return invalid(candidate.error);
    if (!countries.includes(candidate.country) || !candidate.name.trim()) return invalid("invalid_identity_or_country");
    const source = directory[candidate.type];
    if (candidate.id) {
      const found = source.find(r => r.id === candidate.id);
      if (!found || (found.country_code ?? found.country) !== candidate.country) return invalid("source_changed");
      item.sourceHash = digest(found);
    } else {
      const data = candidate.data ?? {};
      const matches = source.filter(r => (r.country_code ?? r.country) === candidate.country && (
        normalized(entityName(candidate.type, r)) === normalized(candidate.name) ||
        data.email && normalized(r.email) === normalized(data.email) ||
        data.phone && [r.phone, r.mobile, r.mobile_2].some(p => p && phone(p) === phone(data.phone))
      ));
      if (matches.length > 1) return invalid("ambiguous_identity");
      if (matches.length === 1) {
        const match = matches[0];
        const sameName = normalized(entityName(candidate.type, match)) === normalized(candidate.name);
        const sameChannel = data.email && normalized(match.email) === normalized(data.email) ||
          data.phone && [match.phone, match.mobile, match.mobile_2].some(p => p && phone(p) === phone(data.phone));
        if (!sameName || !sameChannel) return invalid("ambiguous_identity");
        item.id = match.id;
        item.sourceHash = digest(match);
      }
    }
    const identity = item.id ? `${item.type}:${item.id}` : `${item.type}:${item.country}:${normalized(item.name)}`;
    if (!item.id) {
      const fingerprint = digest(item.data);
      if (newProfiles.has(identity) && newProfiles.get(identity) !== fingerprint) return invalid("ambiguous_identity");
      newProfiles.set(identity, fingerprint);
    }
    if (seen.has(identity) || enrolled.has(identity)) return { ...item, disposition: "existing", reason: "duplicate" };
    seen.add(identity);
    return item;
  });
}
export const planCounts = (items: PlanItem[]) => items.reduce((counts, row) => {
  counts[row.disposition]++; return counts;
}, { new: 0, existing: 0, invalid: 0 });
