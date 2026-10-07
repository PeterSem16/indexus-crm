import { COUNTRIES } from "@shared/schema";

/** Empty is global; explicit country assignments must be unique operating countries. */
export function validMessageTemplateCountries(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= COUNTRIES.length &&
    value.every(code => typeof code === "string" && COUNTRIES.some(country => country.code === code)) &&
    new Set(value).size === value.length;
}
