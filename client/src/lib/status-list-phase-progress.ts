import { isStatusListInfoHeading } from "../../../shared/status-list-confirmation-kind";
import { isStatusListYesNo } from "../../../shared/status-list-answer-kind";

export type StatusListPhaseKey = "acquisition" | "contract" | "retention";
type Question = {
  id: string; isHidden?: boolean; fieldType?: string | null;
  groupName?: string | null; logicOperator?: string | null;
};
export type PhaseProgressItem = {
  id: string; parentId?: string | null; tab?: string | null; isHidden?: boolean;
  itemType?: string | null; confirmationType?: string | null; sourceManaged?: boolean;
  questionSelectionMode?: string | null; questions?: readonly Question[];
};
export type PhaseProgress = { total: number; confirmed: number; pct: number };

/**
 * Agent-visible completion, not a business outcome or workflow trigger.
 * Question-bearing information headings contribute answers, never a fake
 * confirmation. Exclusive alternatives are one unit; hidden branches, options,
 * technical auto steps and shared/unassigned content do not dilute a phase.
 */
export function statusListPhaseProgress(
  items: readonly PhaseProgressItem[],
  checked: ReadonlySet<string>,
  answers: Readonly<Record<string, unknown>>,
): Record<StatusListPhaseKey, PhaseProgress> {
  const result = {
    acquisition: { total: 0, confirmed: 0, pct: 0 },
    contract: { total: 0, confirmed: 0, pct: 0 },
    retention: { total: 0, confirmed: 0, pct: 0 },
  };
  const children = new Map<string, PhaseProgressItem[]>();
  for (const item of items) {
    if (item.parentId) {
      const key = String(item.parentId);
      children.set(key, [...(children.get(key) || []), item]);
    }
  }
  const visible = (item: PhaseProgressItem) =>
    !item.isHidden && item.itemType !== "option" &&
    item.confirmationType !== "auto";
  const answered = (question: Question) => {
    const value = answers[String(question.id)];
    if (isStatusListYesNo(question.fieldType))
      return value === true || value === false || value === "yes" || value === "no";
    return value != null && value !== false &&
      (typeof value !== "string" || value.trim().length > 0);
  };
  const add = (phase: string | null | undefined, complete: boolean) => {
    if (phase !== "acquisition" && phase !== "contract" && phase !== "retention") return;
    result[phase].total++;
    if (complete) result[phase].confirmed++;
  };
  const visited = new Set<string>();
  const visit = (item: PhaseProgressItem, inheritedPhase?: string | null, choice = false) => {
    const id = String(item.id);
    if (visited.has(id) || !visible(item)) return;
    visited.add(id);
    const phase = item.tab || inheritedPhase;
    const descendants = (children.get(id) || []).filter(visible);
    const questions = (item.questions || []).filter(question => !question.isHidden);
    const single = item.questionSelectionMode === "single";
    // Legacy single-choice headings own selectable child rows, not questions.
    if (single && descendants.length) {
      add(phase, descendants.some(child => checked.has(String(child.id))));
      for (const child of descendants) {
        if (checked.has(String(child.id))) visit(child, phase, true);
      }
    } else {
      if (questions.length) {
        const groups = new Map<string, Question[]>();
        for (const question of questions) {
          const key = question.groupName || "__ungrouped__";
          groups.set(key, [...(groups.get(key) || []), question]);
        }
        if (single) {
          add(phase, questions.some(answered));
        } else {
          for (const group of groups.values()) {
            if (group[0]?.logicOperator === "ONE" || group.every(q => q.fieldType === "radio")) {
              add(phase, group.some(answered));
            } else {
              for (const question of group) add(phase, answered(question));
            }
          }
        }
      } else if (!choice && !isStatusListInfoHeading(item, items)) {
        add(phase, checked.has(id));
      }
      for (const child of descendants) visit(child, phase);
    }
  };
  for (const item of items) {
    if (!item.parentId) visit(item);
    // Orphan rows are not visible in the agent's tree; do not score them.
  }
  for (const phase of Object.values(result))
    phase.pct = phase.total ? Math.round(phase.confirmed / phase.total * 100) : 0;
  return result;
}
