import { z } from "zod";

export const AGREEMENT_MAX_BYTES = 20 * 1024 * 1024;
const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + "T12:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const optionalDate = z.preprocess(value => value === "" ? null : value, calendarDate.nullable());
const optionalText = z.preprocess(value => value === "" ? null : value, z.string().trim().max(100).nullable());
export const agreementPatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  contractNumber: optionalText.optional(),
  validFrom: optionalDate.optional(),
  validTo: optionalDate.optional(),
  active: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0);
export const agreementCreateSchema = agreementPatchSchema.innerType().extend({
  title: z.string().trim().min(1).max(200),
}).strict();

export function agreementDatesValid(from: string | null | undefined, to: string | null | undefined) {
  return !from || !to || from <= to;
}
export function agreementFilename(name: string) {
  return name.replace(/\\/g, "/").split("/").pop()!.replace(/[\x00-\x1f\x7f]/g, "").slice(0, 180) || "agreement";
}
export function agreementFileExtension(type: string, bytes: Buffer): string | null {
  if (type === "application/pdf" && bytes.subarray(0, 5).toString() === "%PDF-") return ".pdf";
  if (type === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return ".png";
  if (type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return ".jpg";
  if (type === "application/msword" && bytes.subarray(0, 8).equals(Buffer.from([208,207,17,224,161,177,26,225]))) return ".doc";
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
      bytes.subarray(0, 4).equals(Buffer.from([80,75,3,4])) &&
      bytes.includes(Buffer.from("word/document.xml")) && bytes.includes(Buffer.from("[Content_Types].xml"))) return ".docx";
  return null;
}

export const CLINIC_AGREEMENTS_MIGRATION = `
CREATE TABLE IF NOT EXISTS clinic_agreements (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id varchar NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  title text NOT NULL,
  contract_number text,
  valid_from date,
  valid_to date,
  active boolean NOT NULL DEFAULT true,
  ended_at timestamp,
  file_name text NOT NULL,
  storage_key text NOT NULL UNIQUE,
  content_type text NOT NULL,
  file_size integer NOT NULL,
  created_by varchar NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT clinic_agreement_dates CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to)
);
CREATE INDEX IF NOT EXISTS idx_clinic_agreements_clinic ON clinic_agreements(clinic_id);
`;