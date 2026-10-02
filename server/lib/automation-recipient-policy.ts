/** The shared Back Office queue must have one claimable task, not one per member. */
export function taskOwnersForTarget(target: { userIds: string[]; isBackOffice: boolean }): string[] {
  return target.isBackOffice ? target.userIds.slice(0, 1) : target.userIds;
}

export function isSharedBackOfficeRole(role: { name: string; legacyRole: string | null }): boolean {
  return role.legacyRole === "back_office" || role.name.toLowerCase().replace(/\s+/g, "_") === "back_office";
}