import { z } from "zod";
import type { ConfirmationPreview } from "./status-list-confirmation-preview";
import type { StatusListRepresentativeInformation } from "./status-list-representative-information";

export const representativeCheckSchema = z.object({
  enabled: z.boolean(),
  trigger: z.enum(["pulse_open", "card_open", "background_change"]),
  behavior: z.enum(["information", "confirm", "automatic"]),
  assignedActions: z.boolean().optional(),
}).strict();
export type RepresentativeCheckConfig = z.infer<typeof representativeCheckSchema>;
export const defaultRepresentativeCheck: RepresentativeCheckConfig = {
  enabled: true, trigger: "pulse_open", behavior: "confirm",
};
export type RepresentativeCheckReview = {
  questionId: string; fingerprint: string; preview: ConfirmationPreview;
};
export type RepresentativeCheckResult = {
  information: StatusListRepresentativeInformation[];
  reviews: RepresentativeCheckReview[];
};
