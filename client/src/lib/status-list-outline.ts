import type { StatusListOrganization } from "@shared/status-list-organization";

export type OutlineItem = {
  id: string; parentId: string | null; label: string; stepId: string; tab?: string | null;
  itemType?: string; isHidden?: boolean;
  questions: { id: string; questionText: string; isHidden?: boolean }[];
};
export function itemAncestry(item: OutlineItem, items: OutlineItem[]) {
  const chain: OutlineItem[] = [], seen = new Set<string>();
  let current: OutlineItem | undefined = item;
  while (current && !seen.has(current.id)) {
    seen.add(current.id); chain.push(current);
    current = items.find(parent => parent.id === current!.parentId);
  }
  return chain;
}
export const outlineHidden = (item: OutlineItem, items: OutlineItem[]) => itemAncestry(item, items).some(row => row.isHidden);
export function outlineCategory(id: string, item: OutlineItem, items: OutlineItem[], organization: StatusListOrganization) {
  return organization.assignments[id] || itemAncestry(item, items).map(row => organization.assignments[row.id]).find(Boolean) || "";
}
export function statusListOutline(items: OutlineItem[], phase: string, category: string, search: string, organization: StatusListOrganization) {
  const visibleItems = new Set<string>(), visibleQuestions = new Set<string>(), visiting = new Set<string>();
  const query = search.trim().toLocaleLowerCase();
  const textMatches = (text: string) => text.toLocaleLowerCase().includes(query);
  const visit = (item: OutlineItem): boolean => {
    if (visiting.has(item.id)) return false;
    visiting.add(item.id);
    const chain = itemAncestry(item, items), quick = chain[chain.length - 1]?.itemType === "option";
    const effectivePhase = chain.find(row => row.tab && row.tab !== "both")?.tab;
    const inPhase = phase === "all" || (phase === "quick" ? quick : !quick && (!effectivePhase || effectivePhase === phase));
    const inCategory = (id: string) => !category || outlineCategory(id, item, items, organization) === category;
    const questions = item.questions.filter(question => inPhase && inCategory(question.id) && textMatches(question.questionText));
    questions.forEach(question => visibleQuestions.add(question.id));
    const children = items.filter(child => child.parentId === item.id).map(visit).some(Boolean);
    const visible = (inPhase && inCategory(item.id) && textMatches(`${item.label} ${item.stepId}`)) || questions.length > 0 || children;
    if (visible) visibleItems.add(item.id);
    visiting.delete(item.id);
    return visible;
  };
  items.filter(item => !item.parentId || !items.some(parent => parent.id === item.parentId)).forEach(visit);
  return { visibleItems, visibleQuestions };
}
