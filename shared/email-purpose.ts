import { z } from "zod";
import { funnelSteps, type FunnelStep } from "./mission-funnel-steps";

/** Stable business identifiers, independent of language, category and subject.
 * None of these purposes confirms a postal shipment or another operational step. */
export const emailPurposes = [
  "unspecified", "cooperation_proposal", "contract_for_signature",
  "information_materials", "reminder",
] as const;
export const emailPurposeSchema = z.enum(emailPurposes);
export type EmailPurpose = z.infer<typeof emailPurposeSchema>;
export const emailFunnelStepsSchema = z.array(z.enum(funnelSteps)).max(funnelSteps.length)
  .refine(values => new Set(values).size === values.length);
export function validEmailFunnelStepsForType(value: unknown, type: unknown): boolean {
  return value === undefined || value === null ||
    emailFunnelStepsSchema.safeParse(value).success && (type === "email" || (value as unknown[]).length === 0);
}
export const measurableEmailPurposes = emailPurposes.filter(p => p !== "unspecified");
export interface EmailTemplateSnapshot {
  id: string;
  name: string;
  purpose: EmailPurpose;
  funnelSteps?: FunnelStep[];
}
