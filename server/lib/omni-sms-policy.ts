import { OMNI_SMS_COUNTRIES, OMNI_SMS_PROVIDERS, type OmniSmsAccess } from "@shared/omni-sms";

export const countrySupported = (country: unknown): country is string =>
  typeof country === "string" && (OMNI_SMS_COUNTRIES as readonly string[]).includes(country);
export const providerSupported = (provider: unknown): provider is "bulkgate" | "smstools" =>
  typeof provider === "string" && (OMNI_SMS_PROVIDERS as readonly string[]).includes(provider);
export const providerCountryAllowed = (provider: string, country: string) =>
  providerSupported(provider) && countrySupported(country) && (provider !== "smstools" || country === "SK");

export function mayViewOmniSms(access: Pick<OmniSmsAccess, "isAdmin" | "countries" | "grants">,
  country: string | null, provider: string | null): boolean {
  if (access.isAdmin) return true;
  return !!country && !!provider && access.countries.includes(country) &&
    providerCountryAllowed(provider, country) &&
    access.grants.some(g => g.countryCode === country && g.provider === provider);
}

export function validateOmniSmsGrant(country: unknown, providers: unknown, assignedCountries: string[]) {
  if (!countrySupported(country) || !assignedCountries.includes(country) || !Array.isArray(providers) ||
      providers.length > OMNI_SMS_PROVIDERS.length ||
      providers.some(p => typeof p !== "string" || !providerCountryAllowed(p, country)) ||
      new Set(providers).size !== providers.length) {
    throw new Error("invalid_sms_permissions");
  }
  return { countryCode: country, providers: providers as ("bulkgate" | "smstools")[] };
}
