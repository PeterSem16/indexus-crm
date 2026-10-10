export type ChatAssignment = { userId: string; chatUserIds: string[] | null };
export type ChatPolicy = Map<string, Set<string>>;

/** Unconfigured assignments inherit the existing unrestricted directory.
 * Once any assignment is configured, only the union of explicit lists applies.
 */
export function buildChatPolicy(assignments: ChatAssignment[]): ChatPolicy {
  const result: ChatPolicy = new Map();
  for (const assignment of assignments) {
    if (assignment.chatUserIds === null) continue;
    const ids = result.get(assignment.userId) || new Set<string>();
    assignment.chatUserIds.forEach(id => ids.add(id));
    result.set(assignment.userId, ids);
  }
  return result;
}

export function chatPairAllowed(policy: ChatPolicy, viewerId: string, targetId: string): boolean {
  if (!viewerId || !targetId || viewerId === targetId) return false;
  return (!policy.has(viewerId) || policy.get(viewerId)!.has(targetId))
    && (!policy.has(targetId) || policy.get(targetId)!.has(viewerId));
}

export function validateChatSelections(
  value: unknown, agentIds: string[], activeUserIds: Set<string>,
): Record<string, string[] | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid chat selections");
  const result: Record<string, string[] | null> = Object.create(null);
  for (const [agentId, selection] of Object.entries(value)) {
    if (!agentIds.includes(agentId)) throw new Error("Chat settings must belong to selected agents");
    if (selection === null) { result[agentId] = null; continue; }
    if (!Array.isArray(selection) || selection.length > 1000
      || selection.some(id => typeof id !== "string" || !activeUserIds.has(id) || id === agentId)) {
      throw new Error("Chat colleagues must be active users other than the agent");
    }
    result[agentId] = [...new Set(selection)];
  }
  return result;
}
