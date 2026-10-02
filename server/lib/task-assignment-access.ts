import { and, eq, inArray } from "drizzle-orm";
import { taskAssignmentAccess, users } from "@shared/schema";
import { userMayAccessTaskCountry } from "./task-contract";

export class TaskAssignmentAccessError extends Error {
  readonly code = "task_assignment_not_allowed";
  constructor(message = "This user is not allowed to receive or resolve tasks") {
    super(message);
  }
}

export function taskAssignmentAllowed(
  userId: string,
  isActive: boolean,
  configured: boolean,
  allowedUserIds: string[],
): boolean {
  return isActive && (!configured || allowedUserIds.includes(userId));
}

export function taskAssignmentPolicyVersionMatches(expectedUpdatedAt: string | null, actualUpdatedAt: Date | null): boolean {
  return (actualUpdatedAt?.toISOString() ?? null) === expectedUpdatedAt;
}

export async function taskAssignmentAllowlist(executor: any): Promise<{ configured: boolean; allowedUserIds: string[]; updatedAt: Date | null }> {
  const [settings] = await executor.select().from(taskAssignmentAccess)
    .where(eq(taskAssignmentAccess.id, 1)).for("share").limit(1);
  return {
    configured: settings?.allowedUserIds !== null && settings?.allowedUserIds !== undefined,
    allowedUserIds: settings?.allowedUserIds ?? [],
    updatedAt: settings?.updatedAt ?? null,
  };
}

export async function isTaskAssignmentUserAllowed(executor: any, userId: string): Promise<boolean> {
  const [user] = await executor.select({ id: users.id, isActive: users.isActive })
    .from(users).where(eq(users.id, userId)).for("share").limit(1);
  const allowlist = await taskAssignmentAllowlist(executor);
  return taskAssignmentAllowed(userId, !!user?.isActive, allowlist.configured, allowlist.allowedUserIds);
}

export async function assertTaskRecipientAllowed(executor: any, userId: string, country?: string | null): Promise<void> {
  const [user] = await executor.select({
    id: users.id, isActive: users.isActive, role: users.role, assignedCountries: users.assignedCountries,
  }).from(users).where(eq(users.id, userId)).for("share").limit(1);
  const allowlist = await taskAssignmentAllowlist(executor);
  if (!taskAssignmentAllowed(userId, !!user?.isActive, allowlist.configured, allowlist.allowedUserIds)) {
    throw new TaskAssignmentAccessError("The selected active user is not approved to receive tasks");
  }
  if (country && (!user?.role || !userMayAccessTaskCountry(user.role, user.assignedCountries, country))) {
    throw new TaskAssignmentAccessError("The selected user is not authorized for this task country");
  }
}

export async function assertTaskResolverAllowed(executor: any, userId: string): Promise<void> {
  if (!await isTaskAssignmentUserAllowed(executor, userId)) {
    throw new TaskAssignmentAccessError("You are not approved to resolve tasks");
  }
}

export async function hasAllowedTaskRecipient(executor: any, userIds: string[]): Promise<boolean> {
  if (!userIds.length) return false;
  const active = await executor.select({ id: users.id }).from(users)
    .where(and(eq(users.isActive, true), inArray(users.id, userIds))).for("share");
  const activeIds = new Set(active.map((user: { id: string }) => user.id));
  const allowlist = await taskAssignmentAllowlist(executor);
  if (!allowlist.configured) {
    return userIds.some(id => activeIds.has(id));
  }
  const selected = new Set(allowlist.allowedUserIds);
  return userIds.some(id => selected.has(id) && activeIds.has(id));
}

export async function hasCountryAuthorizedTaskRecipient(executor: any, userIds: string[], country: string | null | undefined): Promise<boolean> {
  return (await countryAuthorizedTaskRecipientIds(executor, userIds, country)).length > 0;
}

export async function countryAuthorizedTaskRecipientIds(executor: any, userIds: string[], country: string | null | undefined): Promise<string[]> {
  if (!userIds.length) return [];
  const candidates = await executor.select({
    id: users.id, role: users.role, assignedCountries: users.assignedCountries, isActive: users.isActive,
  }).from(users).where(and(eq(users.isActive, true), inArray(users.id, userIds))).for("share");
  const eligibleIds = candidates.filter((user: any) =>
    userIds.includes(user.id) && user.role
    && userMayAccessTaskCountry(user.role, user.assignedCountries, country),
  ).map((user: { id: string }) => user.id);
  const policy = await taskAssignmentAllowlist(executor);
  const eligible = new Set(eligibleIds.filter((id: string) => !policy.configured || policy.allowedUserIds.includes(id)));
  return Array.from(new Set(userIds)).filter(id => eligible.has(id));
}