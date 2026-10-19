import { z } from "zod";

export const workflowRefSchema = z.object({
  kind: z.enum(["item", "question"]),
  id: z.string().min(1).max(100),
});
export const workflowAnswerSchema = z.union([z.boolean(), z.string().max(4000)]);
export const workflowConditionSchema = z.object({
  field: z.enum(["answer", "hospital_id", "clinic_id", "status", "contact_type"]),
  ref: workflowRefSchema.optional(),
  op: z.enum(["equals", "not_equals", "empty", "not_empty"]),
  value: workflowAnswerSchema.optional(),
}).superRefine((value, ctx) => {
  if (value.field === "answer" && !value.ref) ctx.addIssue({ code: "custom", message: "Answer reference required" });
  if (["equals", "not_equals"].includes(value.op) && value.value === undefined)
    ctx.addIssue({ code: "custom", message: "Comparison value required" });
});
export const workflowActionSchema = z.object({
  type: z.literal("set_answer"),
  target: workflowRefSchema,
  value: workflowAnswerSchema,
  mode: z.enum(["if_empty", "replace"]),
});
export const statusListWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(180),
  enabled: z.boolean(),
  source: workflowRefSchema,
  sourceValue: workflowAnswerSchema.optional(),
  // Reserved trigger vocabulary is intentionally not executable in step 1.
  trigger: z.literal("agent_confirmation"),
  logic: z.enum(["and", "or"]),
  conditions: z.array(workflowConditionSchema).max(20),
  thenActions: z.array(workflowActionSchema).min(1).max(10),
  elseActions: z.array(workflowActionSchema).max(10),
}).strict().superRefine((rule, ctx) => {
  for (const action of [...rule.thenActions, ...rule.elseActions]) {
    if (action.target.kind === rule.source.kind && action.target.id === rule.source.id)
      ctx.addIssue({ code: "custom", message: "Source cannot target itself" });
  }
});
export type WorkflowRef = z.infer<typeof workflowRefSchema>;
export type WorkflowAnswer = z.infer<typeof workflowAnswerSchema>;
export type WorkflowCondition = z.infer<typeof workflowConditionSchema>;
export type WorkflowAction = z.infer<typeof workflowActionSchema>;
export type StatusListWorkflow = z.infer<typeof statusListWorkflowSchema>;
export type SavedStatusListWorkflow = StatusListWorkflow & { id: string; campaignId: string };
export type WorkflowCatalogItem = {
  kind: "item" | "question"; id: string; label: string; fieldType: string;
  hidden: boolean; writable: boolean; parentLabel?: string;
};
export function answerIsEmpty(value: unknown) {
  return value === undefined || value === null || value === "";
}
export function workflowConditionMatches(condition: WorkflowCondition, value: unknown) {
  if (condition.op === "empty") return answerIsEmpty(value);
  if (condition.op === "not_empty") return !answerIsEmpty(value);
  if (value === undefined || value === null) return false;
  const matches = value === condition.value;
  return condition.op === "equals" ? matches : !matches;
}
