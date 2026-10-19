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
export const workflowActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_answer"), target: workflowRefSchema, value: workflowAnswerSchema, mode: z.enum(["if_empty", "replace"]) }).strict(),
  z.object({ type: z.literal("clear_answer"), target: workflowRefSchema }).strict(),
  z.object({ type: z.literal("confirm_step"), target: workflowRefSchema }).strict(),
  z.object({ type: z.literal("unconfirm_step"), target: workflowRefSchema }).strict(),
  z.object({ type: z.literal("add_selection"), target: workflowRefSchema }).strict(),
  z.object({ type: z.literal("remove_selection"), target: workflowRefSchema }).strict(),
  z.object({ type: z.literal("replace_note"), target: workflowRefSchema, text: z.string().trim().min(1).max(4000) }).strict(),
  z.object({ type: z.literal("append_note"), target: workflowRefSchema, text: z.string().trim().min(1).max(4000) }).strict(),
  z.object({ type: z.literal("clear_note"), target: workflowRefSchema }).strict(),
]);
export const isWorkflowNoteAction = (type: WorkflowAction["type"]) => ["replace_note", "append_note", "clear_note"].includes(type);
export function workflowActionSupportsTarget(type: WorkflowAction["type"], item: WorkflowCatalogItem) {
  if (!item.writable) return false;
  if (isWorkflowNoteAction(type) || type === "confirm_step" || type === "unconfirm_step") return item.kind === "item";
  if (type === "clear_answer") return item.kind === "question";
  if (type === "add_selection" || type === "remove_selection") return item.multiSelectable === true;
  return item.kind === "item" || ["checkbox", "radio", "yesno", "yes_no", "text", "string", "textarea", "number", "date", "email", "phone"].includes(item.fieldType.toLowerCase());
}
export const statusListWorkflowSchema = z.object({
  name: z.string().trim().min(1).max(180),
  enabled: z.boolean(),
  source: workflowRefSchema,
  sourceValue: workflowAnswerSchema.optional(),
  trigger: z.enum(["agent_confirmation", "background_transition"]),
  logic: z.enum(["and", "or"]),
  conditions: z.array(workflowConditionSchema).max(20),
  thenActions: z.array(workflowActionSchema).min(1).max(10),
  elseActions: z.array(workflowActionSchema).max(10),
}).strict().superRefine((rule, ctx) => {
  for (const action of [...rule.thenActions, ...rule.elseActions]) {
    if (!isWorkflowNoteAction(action.type) && action.target.kind === rule.source.kind && action.target.id === rule.source.id)
      ctx.addIssue({ code: "custom", message: "Source cannot target itself" });
  }
});
export type WorkflowRef = z.infer<typeof workflowRefSchema>;
export type WorkflowAnswer = z.infer<typeof workflowAnswerSchema>;
export type WorkflowCondition = z.infer<typeof workflowConditionSchema>;
export type WorkflowAction = z.infer<typeof workflowActionSchema>;
export type StatusListWorkflow = z.infer<typeof statusListWorkflowSchema>;
export type SavedStatusListWorkflow = StatusListWorkflow & { id: string; campaignId: string };
/** Remap references, never free-form notes, names or answer values. */
export function remapStatusListWorkflow(rule: StatusListWorkflow, ids: Map<string, string>): StatusListWorkflow {
  const ref = (value: WorkflowRef): WorkflowRef => ({ ...value, id: ids.get(value.id) || value.id });
  return { ...rule, source: ref(rule.source),
    conditions: rule.conditions.map(condition => condition.ref ? { ...condition, ref: ref(condition.ref) } : { ...condition }),
    thenActions: rule.thenActions.map(action => ({ ...action, target: ref(action.target) })),
    elseActions: rule.elseActions.map(action => ({ ...action, target: ref(action.target) })),
  };
}
export type WorkflowCatalogItem = {
  kind: "item" | "question"; id: string; label: string; fieldType: string;
  hidden: boolean; writable: boolean; parentLabel?: string;
  parentId?: string; sortOrder?: number; itemType?: string;
  multiSelectable?: boolean;
  backgroundSource?: "representative_assigned" | "representative_assignment_type";
};
export const workflowSourceConfigSchema = z.object({
  source: z.enum(["representative_assigned", "representative_assignment_type"]),
  hidden: z.boolean(),
}).strict();
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
