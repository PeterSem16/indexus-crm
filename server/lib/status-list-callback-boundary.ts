import { isWorkflowNoteAction, statusListWorkflowSchema } from "../../shared/status-list-workflow";

type Item = { id: string; parent_id?: string | null };
type Question = { id: string; item_id: string };
export type CallbackDependencies = {
  rules: { definition: unknown }[];
  sources: { question_id: string }[];
  option_sources: { group_id: string }[];
};

/** Reads of reviewed answers are safe. Writes to their item/group hierarchy,
 * including ELSE branches and question targets, are not independent.
 * Unknown enabled definitions/references fail closed; disabled drafts do not run. */
export function callbackDependencyBlockers(
  reviewedItems: string[], items: Item[], questions: Question[], dependencies: CallbackDependencies,
): string[] {
  const protectedItems = new Set(reviewedItems);
  const descendants = new Set(reviewedItems);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of items) {
      if (item.parent_id && descendants.has(item.parent_id) && !descendants.has(item.id)) {
        descendants.add(item.id);
        changed = true;
      }
    }
  }
  for (const id of descendants) protectedItems.add(id);
  changed = true;
  while (changed) {
    changed = false;
    for (const item of items) {
      if (protectedItems.has(item.id) && item.parent_id && !protectedItems.has(item.parent_id)) {
        protectedItems.add(item.parent_id);
        changed = true;
      }
    }
  }
  const itemIds = new Set(items.map(item => item.id));
  const questionParents = new Map(questions.map(question => [question.id, question.item_id]));
  const resolves = (ref: { kind: string; id: string }) =>
    ref.kind === "item" ? itemIds.has(ref.id) : questionParents.has(ref.id);
  const protectedRef = (ref: { kind: string; id: string }) =>
    protectedItems.has(ref.kind === "item" ? ref.id : questionParents.get(ref.id) || "");
  const unsafeRule = dependencies.rules.some(({ definition }) => {
    if (definition && typeof definition === "object" && "enabled" in definition && definition.enabled === false)
      return false;
    const parsed = statusListWorkflowSchema.safeParse(definition);
    if (!parsed.success) return true;
    const rule = parsed.data;
    return !resolves(rule.source) ||
      rule.conditions.some(condition => condition.ref && !resolves(condition.ref)) ||
      [...rule.thenActions, ...rule.elseActions].some(action =>
        !resolves(action.target) || (!isWorkflowNoteAction(action.type) && protectedRef(action.target)));
  });
  const unsafeBackground = dependencies.sources.some(source =>
    !questionParents.has(source.question_id) || protectedItems.has(questionParents.get(source.question_id)!)) ||
    dependencies.option_sources.some(source => !itemIds.has(source.group_id) || protectedItems.has(source.group_id));
  return [
    ...(unsafeRule ? ["internal_workflow_dependency"] : []),
    ...(unsafeBackground ? ["background_dependency"] : []),
  ];
}
