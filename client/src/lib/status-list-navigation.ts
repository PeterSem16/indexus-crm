export interface StatusListNavigationItem {
  id: string;
  stepId?: string | null;
  label?: string;
  parentId?: string | null;
  tab?: string | null;
  isHidden?: boolean;
  itemType?: string;
  confirmationType?: string;
  nextStepId?: string | null;
}

/** A multi-change save has one final destination, reviewed before committing. */
export function statusListConfirmationDestinations(
  items: StatusListNavigationItem[],
  changes: Array<{ kind: string; id: string; value: unknown }>,
) {
  const sources = changes.filter(change => change.kind === "item" && change.value === true)
    .map(change => items.find(item => String(item.id) === change.id))
    .filter((item): item is StatusListNavigationItem =>
      !!item?.nextStepId && item.nextStepId !== "—");
  const source = sources.at(-1);
  if (!source?.nextStepId) return [];
  const destination = resolveStatusListDestination(items, source.nextStepId);
  return [{
    sourceLabel: source.label || source.stepId || source.id,
    targetLabel: destination?.target.label || source.nextStepId,
    stepId: source.nextStepId,
    available: !!destination,
  }];
}

/** Navigation never selects an answer or changes the source's ownership. */
export function resolveStatusListDestination(items: StatusListNavigationItem[], stepId: string) {
  const target = items.find(item => item.stepId === stepId);
  if (!target) return null;
  let current = target;
  let tab = target.tab;
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current.id) || current.isHidden || current.itemType === "option" ||
        current.confirmationType === "auto") return null;
    visited.add(current.id);
    if (current.tab) tab = current.tab;
    if (!current.parentId) break;
    const parent = items.find(item => item.id === current.parentId);
    if (!parent) return null;
    current = parent;
  }
  return { target, tab };
}
