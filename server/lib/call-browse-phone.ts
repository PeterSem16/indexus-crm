export type CallBrowsePhoneOwnerType = "customer" | "clinic" | "hospital";

export interface CallBrowsePhoneOwner {
  id: string;
  type: CallBrowsePhoneOwnerType;
  name: string;
  countryCode: string | null | undefined;
  phones: Array<string | null | undefined>;
}

export interface CallBrowsePhoneIdentity {
  id: string;
  type: CallBrowsePhoneOwnerType;
  name: string;
}

const PHONE_COUNTRY_DIAL_CODES: Record<string, string> = {
  AT: "43",
  BE: "32",
  CH: "41",
  CZ: "420",
  DE: "49",
  ES: "34",
  FR: "33",
  GB: "44",
  HU: "36",
  IT: "39",
  NL: "31",
  PL: "48",
  RO: "40",
  SK: "421",
  US: "1",
};

const COUNTRIES_BY_DIAL_CODE = Object.entries(PHONE_COUNTRY_DIAL_CODES)
  .sort((left, right) => right[1].length - left[1].length);

function cleanPhoneDigits(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

function removeNationalTrunkPrefix(digits: string, countryCode: string): string {
  // Italy retains the leading zero as part of some fixed-line numbers.
  if (countryCode !== "IT" && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

function resolveCountryAndNationalDigits(
  phone: string,
  countryCode?: string | null,
): { countryCode: string; nationalDigits: string } | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const explicitInternational = trimmed.startsWith("+") || trimmed.startsWith("00");
  let digits = cleanPhoneDigits(trimmed);

  if (trimmed.startsWith("00")) digits = digits.slice(2);
  const possibleInternational = explicitInternational || COUNTRIES_BY_DIAL_CODE.some(
    ([, dialCode]) => digits.startsWith(dialCode) && digits.length >= dialCode.length + 7,
  );
  if (possibleInternational) {
    const match = COUNTRIES_BY_DIAL_CODE.find(([, dialCode]) =>
      digits.startsWith(dialCode) && digits.length >= dialCode.length + 7,
    );
    if (!match) return null;
    const [matchedCountry, dialCode] = match;
    const nationalDigits = removeNationalTrunkPrefix(digits.slice(dialCode.length), matchedCountry);
    return nationalDigits ? { countryCode: matchedCountry, nationalDigits } : null;
  }

  const normalizedCountry = countryCode?.trim().toUpperCase();
  if (!normalizedCountry || !PHONE_COUNTRY_DIAL_CODES[normalizedCountry]) return null;
  const nationalDigits = removeNationalTrunkPrefix(digits, normalizedCountry);
  return nationalDigits ? { countryCode: normalizedCountry, nationalDigits } : null;
}

export function normalizeCallBrowsePhone(
  phone: string | null | undefined,
  countryCode?: string | null,
): string | null {
  if (!phone) return null;
  const resolved = resolveCountryAndNationalDigits(phone, countryCode);
  // Short extensions and internal dial codes are not reliable person identities.
  return resolved && resolved.nationalDigits.length >= 7
    ? `${resolved.countryCode}:${resolved.nationalDigits}` : null;
}

/**
 * Return the national-digit suffixes SQL can use to prefilter raw phone fields.
 * The country is part of the key and is kept separate by callers; JS
 * normalization remains authoritative after the candidate rows are fetched.
 */
export function getCallBrowsePhoneCandidateSuffixes(
  normalizedKeys: string[],
  countryCode: string,
): string[] {
  const prefix = `${countryCode.trim().toUpperCase()}:`;
  return [...new Set(normalizedKeys
    .filter(key => key.startsWith(prefix))
    .map(key => key.slice(prefix.length))
    .filter(digits => /^\d+$/.test(digits)))];
}

/**
 * Build an exact, country-aware phone index. A number is attributed only when
 * exactly one record in that country's indexed contact subset owns it.
 */
export function buildUnambiguousCallBrowsePhoneIndex(
  owners: CallBrowsePhoneOwner[],
): Map<string, CallBrowsePhoneIdentity> {
  const matches = new Map<string, Map<string, CallBrowsePhoneIdentity>>();

  for (const owner of owners) {
    const identity = { id: owner.id, type: owner.type, name: owner.name };
    for (const phone of owner.phones) {
      const normalizedPhone = normalizeCallBrowsePhone(phone, owner.countryCode);
      if (!normalizedPhone) continue;
      const key = `${owner.type}:${owner.id}`;
      let phoneOwners = matches.get(normalizedPhone);
      if (!phoneOwners) {
        phoneOwners = new Map();
        matches.set(normalizedPhone, phoneOwners);
      }
      phoneOwners.set(key, identity);
    }
  }

  const unambiguous = new Map<string, CallBrowsePhoneIdentity>();
  for (const [phone, ownersForPhone] of matches) {
    if (ownersForPhone.size === 1) {
      unambiguous.set(phone, [...ownersForPhone.values()][0]);
    }
  }
  return unambiguous;
}