import { getRegistryCopy } from "@/i18n/healthcare-legal-entity-translations";

export type RegistryCountry = "SK" | "CZ" | "RO";

export function supportedRegistryCountry(value?: string | null): RegistryCountry {
  return value === "CZ" || value === "RO" ? value : "SK";
}

export function registrySourceLabel(country: string | null | undefined): string {
  return getRegistryCopy({ registrySourceTime: "", registryReference: "", ico: "" }, country).sourceLabel;
}

export function registrySourceCode(country: string | null | undefined): "ORSR" | "ARES" | "ANAF" {
  switch (country) {
    case "CZ": return "ARES";
    case "RO": return "ANAF";
    default: return "ORSR";
  }
}

export function registryIdLabel(country: string | null | undefined, copy: { ico: string }): string {
  return getRegistryCopy({ registrySourceTime: "", registryReference: "", ico: copy.ico }, country).identifierLabel;
}

export function registryReferenceLabel(country: string | null | undefined, genericLabel: string): string {
  return getRegistryCopy({ registrySourceTime: "", registryReference: genericLabel, ico: "" }, country).referenceLabel;
}
