export const RECORD_ENTRY_TYPES = ["customer", "clinic", "hospital", "collaborator"] as const;
export type RecordEntryType = typeof RECORD_ENTRY_TYPES[number];
export type RecordEntryConfig = {
  recordEntryVersion: 1;
  targetType: RecordEntryType | "auto";
  lookup: "sender" | "recipient" | "configured";
  email?: string;
  phone?: string;
  mode: "history" | "invoice";
  title: string;
  note?: string;
  onAmbiguous?: { taskGroupId: string };
};
export function recordEntryIssues(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["Invalid record entry"];
  const c = value as RecordEntryConfig;
  const issues: string[] = [];
  if (c.recordEntryVersion !== 1 || !["auto", ...RECORD_ENTRY_TYPES].includes(c.targetType)) issues.push("Choose record type");
  if (!["sender", "recipient", "configured"].includes(c.lookup)) issues.push("Choose contact lookup");
  if (!["history", "invoice"].includes(c.mode)) issues.push("Choose history or invoice");
  if (typeof c.title !== "string" || !c.title.trim() || c.title.length > 500) issues.push("Enter a bounded title");
  if (c.note !== undefined && (typeof c.note !== "string" || c.note.length > 6000)) issues.push("Invalid history note");
  if (c.lookup === "configured" && !(typeof c.email === "string" && c.email.trim()) && !(typeof c.phone === "string" && c.phone.trim()))
    issues.push("Enter email or phone");
  if (c.email !== undefined && (typeof c.email !== "string" || c.email.length > 254 ||
    (!!c.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)))) issues.push("Invalid email");
  if (c.phone !== undefined && (typeof c.phone !== "string" || c.phone.length > 40 ||
    (!!c.phone.trim() && !/^(?:\+|00)?[\d ()-]{7,40}$/.test(c.phone)))) issues.push("Invalid phone");
  if (["email", "phone"].some(key => typeof (c as any)[key] === "string" && /[{}]/.test((c as any)[key]))) issues.push("Use literal contact identifiers");
  if (c.onAmbiguous !== undefined && (!c.onAmbiguous || typeof c.onAmbiguous !== "object" ||
    typeof c.onAmbiguous.taskGroupId !== "string" || !c.onAmbiguous.taskGroupId.trim() ||
    c.onAmbiguous.taskGroupId.length > 200 || /[{}\r\n]/.test(c.onAmbiguous.taskGroupId) ||
    Object.keys(c.onAmbiguous).some(key => key !== "taskGroupId"))) issues.push("Choose a Back Office group");
  if (Object.keys(c).some(key => !["recordEntryVersion", "targetType", "lookup", "email", "phone", "mode", "title", "note", "onAmbiguous"].includes(key)))
    issues.push("Unknown record entry fields");
  return issues;
}
export const PHONE_COUNTRY_CODES: Record<string, string> = { SK: "421", CZ: "420", CS: "420", HU: "36", RO: "40", IT: "39", DE: "49", AT: "43", US: "1" };
/** Full identity, including a trusted country when a national format is used. Never match last digits. */
export function recordPhoneKey(value: string, country: string | null): string | null {
  const raw = value.trim(), digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 17) return null;
  if (raw.startsWith("+") || raw.startsWith("00")) return `e164:${raw.startsWith("00") ? digits.slice(2) : digits}`;
  const code = country && PHONE_COUNTRY_CODES[country];
  const national = country === "IT" ? digits : digits.replace(/^0/, "");
  return code ? `e164:${code}${national}` : country ? `local:${country}:${digits}` : null;
}
export function uniqueRecordMatch<T>(matches: T[], truncated = false): T {
  if (truncated || matches.length > 1) throw new Error("record_entry_ambiguous");
  if (!matches.length) throw new Error("record_entry_not_found");
  return matches[0];
}
