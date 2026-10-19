/** Both persisted representations are supported; never convert the user's rows. */
export type SourceGroupNode = { kind?: string; itemType?: string | null; confirmationType?: string | null };
export function isStatusListSourceGroup(parent: SourceGroupNode | undefined, children: SourceGroupNode[]) {
  if (!parent || parent.kind === "question" || parent.confirmationType === "auto" || children.length < 2) return false;
  if (children.some(child => child.kind === "question" || child.confirmationType === "auto")) return false;
  return children.every(child => child.itemType === "option") ||
    children.every(child => child.itemType === "step" && child.confirmationType === "radio");
}
