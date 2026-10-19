import { workflowConditionMatches, type SavedStatusListWorkflow, type WorkflowAnswer } from "@shared/status-list-workflow";

/** Pure hypothetical evaluation: no database, timers, dispatch or side effects. */
export function dryRunStatusListRule(rule: SavedStatusListWorkflow, sourceValue: WorkflowAnswer | undefined, values: (WorkflowAnswer | undefined)[]) {
  const triggered = rule.enabled && sourceValue !== undefined &&
    (rule.sourceValue === undefined || sourceValue === rule.sourceValue);
  const conditions = rule.conditions.map((condition, index) => workflowConditionMatches(condition, values[index]));
  const passed = !conditions.length || (rule.logic === "and" ? conditions.every(Boolean) : conditions.some(Boolean));
  const branch = triggered ? passed ? "then" : "else" : "none";
  return { triggered, conditions, branch, actions: branch === "then" ? rule.thenActions : branch === "else" ? rule.elseActions : [] };
}
