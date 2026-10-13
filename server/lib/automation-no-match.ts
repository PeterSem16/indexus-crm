type LinkRule = {
  id?: string; module: string; createdByUserId?: string | null;
  trigger: any; enabled?: boolean;
};
/** Restrict handoff to the same authorized rule owner; the target still evaluates its own scope and IF. */
export function noMatchRoutingIssue(source: LinkRule, rules: LinkRule[]): string | null {
  const id = source.trigger?.noMatchRuleId;
  if (id == null || id === "") return null;
  if (typeof id !== "string" || !id.trim()) return "Invalid no-match rule";
  if (source.module !== "communication" || source.trigger?.type !== "event" || !source.trigger.analysis)
    return "No-match routing requires a communication analysis event rule";
  const visited = new Set(source.id ? [source.id] : []);
  let next: unknown = id;
  for (let depth = 0; next; depth++) {
    if (typeof next !== "string" || visited.has(next) || depth >= 4) return "No-match route contains a cycle or exceeds four links";
    visited.add(next);
    const target = rules.find(rule => rule.id === next);
    if (!target || target.module !== source.module || !source.createdByUserId ||
        target.createdByUserId !== source.createdByUserId || target.trigger?.type !== "event" ||
        !target.trigger.analysis) return "No-match target must be an analysis rule owned by the same user";
    next = target.trigger.noMatchRuleId;
  }
  return null;
}

export type RuleEvaluationPass = { visited: Set<string>; path: string[] };
export function enterRuleEvaluation(id: string, pass: RuleEvaluationPass): boolean {
  if (pass.visited.has(id) || pass.path.length >= 5) return false;
  pass.visited.add(id);
  return true;
}
