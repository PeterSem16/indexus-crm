import type { TaskActionRecipient } from "@shared/automation-task-action";
import { validTaskActionRecipients } from "@shared/automation-task-action";

export type TaskCreationTarget = {
  userIds: string[];
  tags: string[];
  isBackOffice: boolean;
};
export type TaskCreationAssignment = { owner: string; tags: string[]; groupId?: string; eligibleIds?: string[] };

/**
 * Preflight the entire selection before writes. Explicit groups are shared;
 * person/role overlaps produce only one personal task.
 */
export async function planTaskActionRecipients(
  recipients: TaskActionRecipient[],
  resolve: (recipient: TaskActionRecipient) => Promise<TaskCreationTarget>,
): Promise<TaskCreationAssignment[]> {
  if (!validTaskActionRecipients(recipients)) throw new Error("Choose valid task recipients");
  const assignments: TaskCreationAssignment[] = [];
  const personal = new Map<string, TaskCreationAssignment>();
  for (const recipient of recipients) {
    const target = await resolve(recipient);
    const ids = [...new Set(target.userIds)].sort();
    if (!ids.length) throw new Error("Task recipient has no authorized active users");
    if (recipient.kind === "group") {
      assignments.push({ owner: ids[0], tags: target.tags, groupId: recipient.id, eligibleIds: ids });
    } else {
      for (const owner of ids) {
        const tags = recipient.kind === "role" ? target.tags.filter(tag => tag !== "back_office") : [];
        const prior = personal.get(owner);
        personal.set(owner, { owner, tags: [...new Set([...(prior?.tags || []), ...tags])] });
      }
    }
    if (assignments.length + personal.size > 100) throw new Error("Task action exceeds the 100-task limit");
  }
  return [...assignments, ...personal.values()];
}
