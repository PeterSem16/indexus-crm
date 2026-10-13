/** Stored in the existing trigger JSON; no migration or default rewrite. */
export type AutomationBranchAction = { type: string; config: Record<string, any> };

export function automationElseActions(trigger: any): AutomationBranchAction[] {
  return Array.isArray(trigger?.noMatchActions) ? trigger.noMatchActions : [];
}

export function automationExecutableActions(rule: { trigger?: any; actions?: unknown }): AutomationBranchAction[] {
  return [...(Array.isArray(rule.actions) ? rule.actions : []), ...automationElseActions(rule.trigger)];
}

export function automationBranchIssue(trigger: any): string | null {
  if (trigger?.noMatchActions === undefined) return null;
  if (trigger.type !== "event") return "ELSE actions require an event rule";
  if (!Array.isArray(trigger.noMatchActions) || !trigger.noMatchActions.length)
    return "ELSE requires at least one action";
  if (trigger.noMatchRuleId) return "Choose either ELSE actions or a linked rule";
  return null;
}

/** Eligibility and unknown/error results are never a false-condition branch. */
export function automationBranch(trigger: any, eligible: boolean, matched: boolean | null) {
  if (!eligible || matched === null) return { branch: "stop" as const, actions: [], ruleId: null };
  if (matched) return { branch: "then" as const, actions: [], ruleId: null };
  const actions = automationElseActions(trigger);
  if (actions.length) return { branch: "else" as const, actions, ruleId: null };
  return { branch: "stop" as const, actions: [], ruleId: trigger?.noMatchRuleId || null };
}

/** Failed/absent analysis fields must not be silently interpreted as FALSE. */
export function automationAnalysisUnknown(node: any, analysis: any): boolean {
  if (!node || typeof node !== "object") return false;
  if (typeof node.field === "string" && node.field.startsWith("analysis.")) {
    if (["is_null", "is_not_null", "exists", "not_exists", "is_empty", "not_empty"].includes(node.op)) return false;
    const value = node.field.slice("analysis.".length).split(".").reduce((value: any, key: string) => value?.[key], analysis);
    return value == null;
  }
  return automationAnalysisUnknown(node.not, analysis) ||
    [...(Array.isArray(node.all) ? node.all : []), ...(Array.isArray(node.any) ? node.any : [])]
      .some(child => automationAnalysisUnknown(child, analysis));
}
