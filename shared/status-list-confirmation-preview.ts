import { z } from "zod";
import { workflowRefSchema, workflowAnswerSchema } from "./status-list-workflow";

export const confirmationPreviewSchema = z.object({
  changes: z.array(workflowRefSchema.extend({ value: workflowAnswerSchema.nullable() }).strict()).min(1).max(200),
  manualActionIds: z.array(z.string().min(1).max(100)).max(100).default([]),
}).strict();
export type ConfirmationChange = z.infer<typeof confirmationPreviewSchema>["changes"][number];
export type ConfirmationPreviewAction = {
  id: string; sourceLabel: string; actionType: string; targetLabel?: string;
  condition: "matched" | "not_matched" | "unknown" | "blocked";
  branch?: "then" | "else"; value?: string | boolean | null;
};
export type ConfirmationPreview = {
  readOnly: true; mode: "batch" | "immediate"; actions: ConfirmationPreviewAction[];
};
