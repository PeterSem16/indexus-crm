import { parsePhoneNumberFromString, isValidPhoneNumber, CountryCode } from "libphonenumber-js";

export type PhoneEntry = { value: string; type: "mobile" | "landline" | "fax" | "unknown"; raw?: string };

const SK_MOBILE_PREFIXES = ["903", "904", "905", "907", "908", "910", "911", "912", "914", "915", "916", "917", "918", "919", "940", "944", "948", "949", "950", "951", "902", "905", "907", "908", "909"];

export function normalizePhone(raw: string, country: CountryCode = "SK"): PhoneEntry | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.length < 7) return null;
  try {
    const parsed = parsePhoneNumberFromString(cleaned, country);
    if (!parsed || !parsed.isValid()) return null;
    const e164 = parsed.format("E.164");
    const national = parsed.nationalNumber.toString();
    let type: PhoneEntry["type"] = "unknown";
    if (parsed.country === "SK") {
      if (SK_MOBILE_PREFIXES.some(p => national.startsWith(p))) type = "mobile";
      else type = "landline";
    } else {
      const t = parsed.getType();
      if (t === "MOBILE") type = "mobile";
      else if (t === "FIXED_LINE") type = "landline";
      else if (t === "FIXED_LINE_OR_MOBILE") type = "landline";
    }
    return { value: e164, type, raw };
  } catch {
    return null;
  }
}

export function normalizePhones(raws: string[], country: CountryCode = "SK"): PhoneEntry[] {
  const seen = new Set<string>();
  const out: PhoneEntry[] = [];
  for (const r of raws) {
    const n = normalizePhone(r, country);
    if (n && !seen.has(n.value)) {
      seen.add(n.value);
      out.push(n);
    }
  }
  return out;
}

export function normalizeEmail(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(trimmed)) return null;
  if (trimmed.endsWith(".png") || trimmed.endsWith(".jpg") || trimmed.endsWith(".gif")) return null;
  return trimmed;
}

export function normalizeEmails(raws: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raws) {
    const n = normalizeEmail(r);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

export function normalizeIco(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  return digits;
}

const SK_REGIONS_BY_DISTRICT: Record<string, { region: string; district: string }> = {};
// Simplified mapping — extend as needed
const SK_REGION_KEYWORDS: Record<string, string> = {
  "bratislav": "Bratislavský kraj",
  "trnav": "Trnavský kraj",
  "trenčí": "Trenčiansky kraj",
  "trenci": "Trenčiansky kraj",
  "nitr": "Nitriansky kraj",
  "žilin": "Žilinský kraj",
  "zilin": "Žilinský kraj",
  "bansk": "Banskobystrický kraj",
  "prešov": "Prešovský kraj",
  "presov": "Prešovský kraj",
  "košic": "Košický kraj",
  "kosic": "Košický kraj",
};

export function inferRegion(city?: string | null, address?: string | null): string | null {
  const haystack = `${city || ""} ${address || ""}`.toLowerCase();
  for (const [kw, region] of Object.entries(SK_REGION_KEYWORDS)) {
    if (haystack.includes(kw)) return region;
  }
  return null;
}

export function dedupeKey(c: { ico?: string | null; name?: string | null; city?: string | null }): string {
  if (c.ico) return `ico:${c.ico}`;
  const n = (c.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const ci = (c.city || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `nc:${n}|${ci}`;
}
