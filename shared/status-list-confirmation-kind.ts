export type StatusListConfirmationNode = {
  id: string;
  parentId?: string | null;
  itemType?: string | null;
  confirmationType?: string | null;
  questions?: readonly unknown[];
};

/**
 * Older Status Lists store selectable answers as nested `step/info` rows.
 * Only a leaf below an informational group is such an answer. The group,
 * standalone information and nodes owning questions remain non-confirmable.
 * This interpretation does not rewrite stored rules or callback fingerprints.
 */
export function isStatusListInfoHeading(
  item: StatusListConfirmationNode,
  hierarchy: readonly StatusListConfirmationNode[],
): boolean {
  if (item.confirmationType !== "info") return false;
  if (!item.parentId || !["step", "option"].includes(item.itemType || "")) return true;
  const parent = hierarchy.find(node => node.id === item.parentId);
  if (parent?.confirmationType !== "info") return true;
  return !!item.questions?.length || hierarchy.some(node => node.parentId === item.id);
}
