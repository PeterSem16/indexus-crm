/**
 * Canonicalizes a city/country pair for priority-builder ranking.
 *
 * City names remain readable in the returned value.  Only the persistence key
 * is folded for case, accents, whitespace, and punctuation.  A country is
 * always part of that key so identically named cities in different countries
 * cannot be merged accidentally.
 */

export interface NormalizedCityLocation {
  key: string;
  city: string;
  countryCode: string;
}

const COUNTRY_ALIASES: Record<string, string> = {
  // Slovakia and nearby countries (the application's primary locales).
  SK: "SK",
  SVK: "SK",
  SLOVAKIA: "SK",
  "SLOVAK REPUBLIC": "SK",
  SLOVENSKO: "SK",
  "SLOVENSKÁ REPUBLIKA": "SK",
  CZ: "CZ",
  CZE: "CZ",
  CZECHIA: "CZ",
  "CZECH REPUBLIC": "CZ",
  ČESKO: "CZ",
  "ČESKÁ REPUBLIKA": "CZ",
  DE: "DE",
  DEU: "DE",
  GERMANY: "DE",
  DEUTSCHLAND: "DE",
  NEMECKO: "DE",
  AT: "AT",
  AUT: "AT",
  AUSTRIA: "AT",
  ÖSTERREICH: "AT",
  RAKÚSKO: "AT",
  HU: "HU",
  HUN: "HU",
  HUNGARY: "HU",
  MAGYARORSZÁG: "HU",
  MAĎARSKO: "HU",
  PL: "PL",
  POL: "PL",
  POLAND: "PL",
  POLSKA: "PL",
  POĽSKO: "PL",
  RO: "RO",
  ROU: "RO",
  ROMANIA: "RO",
  ROMÂNIA: "RO",
  RUMUNSKO: "RO",
  UA: "UA",
  UKR: "UA",
  UKRAINE: "UA",
  UKRAJINA: "UA",
  // Other common European locations.
  IT: "IT",
  ITA: "IT",
  ITALY: "IT",
  ITALIA: "IT",
  TALIANSKO: "IT",
  FR: "FR",
  FRA: "FR",
  FRANCE: "FR",
  FRANCÚZSKO: "FR",
  ES: "ES",
  ESP: "ES",
  SPAIN: "ES",
  ESPAÑA: "ES",
  ŠPANIELSKO: "ES",
  PT: "PT",
  PRT: "PT",
  PORTUGAL: "PT",
  CH: "CH",
  CHE: "CH",
  SWITZERLAND: "CH",
  SCHWEIZ: "CH",
  ŠVAJČIARSKO: "CH",
  NL: "NL",
  NLD: "NL",
  NETHERLANDS: "NL",
  HOLLAND: "NL",
  NEDERLAND: "NL",
  BE: "BE",
  BEL: "BE",
  BELGIUM: "BE",
  BELGIË: "BE",
  DK: "DK",
  DNK: "DK",
  DENMARK: "DK",
  DANSKO: "DK",
  SE: "SE",
  SWE: "SE",
  SWEDEN: "SE",
  ŠVÉDSKO: "SE",
  NO: "NO",
  NOR: "NO",
  NORWAY: "NO",
  NORSKO: "NO",
  FI: "FI",
  FIN: "FI",
  FINLAND: "FI",
  FINSKO: "FI",
  IE: "IE",
  IRL: "IE",
  IRELAND: "IE",
  ÍRSKO: "IE",
  GR: "GR",
  GRC: "GR",
  GREECE: "GR",
  ΕΛΛΑΔΑ: "GR",
  GB: "GB",
  GBR: "GB",
  UK: "GB",
  "UNITED KINGDOM": "GB",
  "GREAT BRITAIN": "GB",
  // Other common countries and standard abbreviations.
  US: "US",
  USA: "US",
  "UNITED STATES": "US",
  "UNITED STATES OF AMERICA": "US",
  AMERICA: "US",
  CA: "CA",
  CAN: "CA",
  CANADA: "CA",
  MX: "MX",
  MEX: "MX",
  MEXICO: "MX",
  BR: "BR",
  BRA: "BR",
  BRAZIL: "BR",
  AR: "AR",
  ARG: "AR",
  ARGENTINA: "AR",
  AU: "AU",
  AUS: "AU",
  AUSTRALIA: "AU",
  NZ: "NZ",
  NZL: "NZ",
  "NEW ZEALAND": "NZ",
  IN: "IN",
  IND: "IN",
  INDIA: "IN",
  CN: "CN",
  CHN: "CN",
  CHINA: "CN",
  JP: "JP",
  JPN: "JP",
  JAPAN: "JP",
  KR: "KR",
  KOR: "KR",
  "SOUTH KOREA": "KR",
  "REPUBLIC OF KOREA": "KR",
  TR: "TR",
  TUR: "TR",
  TURKEY: "TR",
  TÜRKİYE: "TR",
  RU: "RU",
  RUS: "RU",
  RUSSIA: "RU",
  "RUSSIAN FEDERATION": "RU",
  IL: "IL",
  ISR: "IL",
  ISRAEL: "IL",
  AE: "AE",
  ARE: "AE",
  UAE: "AE",
  "UNITED ARAB EMIRATES": "AE",
  ZA: "ZA",
  ZAF: "ZA",
  "SOUTH AFRICA": "ZA",
};

function collapseWhitespace(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}

function stripAccents(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    // A few frequently encountered Latin letters do not decompose under
    // Unicode NFKD but are still safe to fold for a comparison key.
    .replace(/[Łł]/gu, "l")
    .replace(/[Đđ]/gu, "d")
    .replace(/[Ðð]/gu, "d")
    .replace(/[Øø]/gu, "o")
    .replace(/[Ææ]/gu, "ae")
    .replace(/ß/gu, "ss");
}

function countryLookupValue(value: string): string {
  // Keep the original Unicode letters for aliases such as Ελληνάδα, while
  // making punctuation and spacing consistent.
  return collapseWhitespace(value)
    .toLocaleUpperCase("en-US")
    .replace(/[.,/()[\]{}-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function countryFallback(value: string): string {
  const hasNonLatinLetters = [...value].some((character) =>
    /\p{L}/u.test(character) && !/[A-Za-z]/u.test(character));
  const ascii = stripAccents(value)
    .toLocaleUpperCase("en-US")
    .replace(/[^A-Z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 32);
  if (ascii && !hasNonLatinLetters) return ascii;

  // Do not turn an unsupported non-Latin country into ??; that would merge
  // unrelated countries.  Keep a bounded, normalized Unicode marker instead.
  const unicode = collapseWhitespace(value)
    .normalize("NFKC")
    .toLocaleUpperCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 32);
  return unicode ? `U_${unicode}` : "??";
}

function normalizeCountryCode(country: unknown): string {
  if (typeof country !== "string") return "??";
  const trimmed = collapseWhitespace(country);
  if (!trimmed) return "??";

  const lookup = countryLookupValue(trimmed);
  if (["??", "UNKNOWN", "N_A", "NA", "NONE", "NULL", "UNSPECIFIED"].includes(lookup)) {
    return "??";
  }

  const foldedLookup = stripAccents(lookup).toLocaleUpperCase("en-US");
  const aliased = COUNTRY_ALIASES[lookup]
    ?? COUNTRY_ALIASES[foldedLookup]
    ?? Object.entries(COUNTRY_ALIASES)
      .find(([alias]) => stripAccents(alias).toLocaleUpperCase("en-US") === foldedLookup)?.[1];
  if (aliased) return aliased;

  // Accept an already supplied ISO-style alpha-2 code even when this
  // particular country is not in the common alias table.
  if (/^[A-Z]{2}$/u.test(lookup)) return lookup;
  return countryFallback(trimmed);
}

function normalizeCityKey(city: string): string {
  return stripAccents(city)
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Returns a stable, country-aware city location or null when the city is
 * missing.  Country is deliberately never inferred from the city name.
 */
export function normalizeCityLocation(
  country: unknown,
  city: unknown,
): NormalizedCityLocation | null {
  if (typeof city !== "string") return null;
  const readableCity = collapseWhitespace(city);
  if (!readableCity) return null;

  const normalizedCity = normalizeCityKey(readableCity);
  if (!normalizedCity) return null;

  const countryCode = normalizeCountryCode(country);
  return {
    key: `${countryCode}:${normalizedCity}`,
    city: readableCity,
    countryCode,
  };
}