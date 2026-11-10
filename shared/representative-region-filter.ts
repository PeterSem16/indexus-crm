import type { MedicalPartnerFilterRule } from "./medical-partner-filter";

/** Appended AND guards keep an existing mixed AND/OR expression inside the chosen country and regions. */
export function applyRepresentativeRegionFilter(
  rules: MedicalPartnerFilterRule[], countryCode: string, regions: string[],
): MedicalPartnerFilterRule[] {
  const values = [...new Set(regions.filter(region => typeof region === "string" && region.trim()))];
  if (!/^[A-Z]{2}$/.test(countryCode) || !values.length) throw new Error("invalid_region_filter");
  return [
    ...rules.filter(rule => rule.field !== "region" && rule.field !== "country"),
    { id: "representative-suggestion-country", conjunction: "and", field: "country", op: "isAny", value: [countryCode] },
    { id: "representative-suggestion-region", conjunction: "and", field: "region", op: "isAny", value: values },
  ];
}
