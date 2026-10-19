import { outlineHidden, outlinePhase } from "./status-list-outline";

export type RelationshipQuestion = {
  id: string; questionText: string; groupName?: string | null; logicOperator?: string | null; isHidden?: boolean;
};
export type RelationshipItem = {
  id: string; stepId?: string | null; label: string; parentId?: string | null; itemType?: string | null;
  tab?: string | null; isHidden?: boolean; questionSelectionMode?: string | null; questions?: RelationshipQuestion[];
};
export type RelationshipTarget = {
  key: string; kind: "step" | "question"; value: string; itemId: string; questionId?: string;
  label: string; step: string; parentLabel: string; phase: string | null; hidden: boolean;
  self: boolean; quickOption: boolean; ambiguous: boolean; selectable: boolean;
};

/** Stored step links use a code; question links use step:<code> or a question UUID.
 * Keep those encodings unchanged, and retain invalid saved links for explicit review.
 */
export function relationshipTargets(items: RelationshipItem[], currentItemId: string, questionId: string | null): RelationshipTarget[] {
  const codeCounts = new Map<string, number>();
  for (const item of items) if (item.stepId) codeCounts.set(item.stepId, (codeCounts.get(item.stepId) || 0) + 1);
  const outlineItems = items.map(item => ({
    ...item, parentId: item.parentId || null, stepId: item.stepId || "", itemType: item.itemType || undefined, questions: item.questions || [],
  }));
  return outlineItems.flatMap(item => {
    const phase = outlinePhase(item, outlineItems);
    const hidden = outlineHidden(item, outlineItems);
    const quickOption = item.itemType === "option";
    const targets: RelationshipTarget[] = [];
    if (item.stepId) {
      const self = questionId === null && currentItemId === item.id;
      const ambiguous = (codeCounts.get(item.stepId) || 0) > 1;
      targets.push({
        key: `step:${item.id}`, kind: "step", value: questionId === null ? item.stepId : `step:${item.stepId}`,
        itemId: item.id, label: item.label, step: item.stepId, parentLabel: item.label, phase, hidden, self, quickOption, ambiguous,
        selectable: !self && !quickOption && !ambiguous,
      });
    }
    if (questionId !== null) for (const question of item.questions || []) {
      const self = currentItemId === item.id && questionId === question.id;
      targets.push({
        key: `question:${question.id}`, kind: "question", value: question.id, itemId: item.id, questionId: question.id,
        label: question.questionText, step: item.stepId || item.label, parentLabel: item.label, phase, hidden: hidden || !!question.isHidden,
        self, quickOption, ambiguous: false, selectable: !self && !quickOption,
      });
    }
    return targets;
  });
}

export function relationshipSelection(targets: RelationshipTarget[], value: string) {
  const empty = !value || value === "—";
  const matches = empty ? [] : targets.filter(target => target.value === value);
  return { empty, target: matches[0], missing: !empty && matches.length === 0, ambiguous: matches.length > 1 || !!matches[0]?.ambiguous };
}

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export function searchRelationshipTargets(targets: RelationshipTarget[], search: string, kind: "all" | "step" | "question" = "all") {
  const words = fold(search).trim().split(/\s+/).filter(Boolean);
  return targets.filter(target => (kind === "all" || kind === target.kind)
    && words.every(word => fold(`${target.label} ${target.parentLabel} ${target.step} ${target.phase || ""}`).includes(word)));
}

/** Preview only the selected question's draft. Never silently rewrite siblings. */
export function relationshipGroup(item: RelationshipItem, draft: RelationshipQuestion) {
  const key = draft.groupName?.trim() || "";
  const questions = [...(item.questions || []).filter(question => question.id !== draft.id), { ...draft, groupName: key }];
  const members = questions.filter(question => (question.groupName || "") === key);
  return {
    members, names: [...new Set((item.questions || []).map(question => question.groupName).filter((name): name is string => !!name))],
    mixed: new Set(members.map(question => question.logicOperator || "OR")).size > 1,
    stepSingle: item.questionSelectionMode === "single",
    unknownLogic: members.some(question => !["OR", "AND", "ONE"].includes(question.logicOperator || "OR")),
  };
}
