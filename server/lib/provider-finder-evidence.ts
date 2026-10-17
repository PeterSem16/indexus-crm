import type { FinderEvidence } from "../../shared/provider-finder";

// Missing/partial legacy dates are unknown, not proof that a contract is current.
export function agreementDate(day: number | null, month: number | null, year: number | null): string | undefined {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year) || !year || year < 1900 || year > 9999) return;
  const date = new Date(Date.UTC(year, month! - 1, day!));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month! - 1 || date.getUTCDate() !== day) return;
  return date.toISOString().slice(0, 10);
}
export type PersonAgreementEvidence = {
  is_valid: boolean; file_path: string | null;
  valid_from_day: number | null; valid_from_month: number | null; valid_from_year: number | null;
  valid_to_day: number | null; valid_to_month: number | null; valid_to_year: number | null;
};
export function personAgreementEvidence(rows: PersonAgreementEvidence[], today: string): FinderEvidence {
  let current = false, previous = false, uploaded = false, uncertain = false;
  for (const row of rows) {
    const start = agreementDate(row.valid_from_day, row.valid_from_month, row.valid_from_year);
    const end = agreementDate(row.valid_to_day, row.valid_to_month, row.valid_to_year);
    const openEnd = row.valid_to_day == null && row.valid_to_month == null && row.valid_to_year == null;
    if (!start || (!end && !openEnd) || (end && end < start)) { uncertain = true; continue; }
    if (start > today) continue;
    if (row.is_valid && (!end || end >= today)) {
      current = true;
      if (row.file_path?.trim()) uploaded = true;
    } else if (end && end < today) previous = true;
    // Invalid with no known past end is not evidence of a previous valid agreement.
  }
  return {
    currentAgreement: current ? true : uncertain ? undefined : false,
    previousAgreement: previous ? true : uncertain ? undefined : false,
    uploadedContract: uploaded ? true : uncertain ? undefined : false,
  };
}
