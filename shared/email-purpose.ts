import { z } from "zod";

/** Stable business identifiers, independent of language, category and subject.
 * None of these purposes confirms a postal shipment or another operational step. */
export const emailPurposes = [
  "unspecified", "cooperation_proposal", "contract_for_signature",
  "information_materials", "reminder",
] as const;
export const emailPurposeSchema = z.enum(emailPurposes);
export type EmailPurpose = z.infer<typeof emailPurposeSchema>;
export const measurableEmailPurposes = emailPurposes.filter(p => p !== "unspecified");
export interface EmailTemplateSnapshot {
  id: string;
  name: string;
  purpose: EmailPurpose;
}
