export type TaskReassignPayload =
  | { newAssignedUserId: string; newTaskGroupId?: never }
  | { newTaskGroupId: string; newAssignedUserId?: never };

export type ReassignUser = {
  id: string;
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

export type ReassignGroup = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  memberCount?: number;
};

export type ReassignTargets = { users: ReassignUser[]; groups: ReassignGroup[] };

export function normalizeReassignSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().trim();
}

export function matchesReassignSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = normalizeReassignSearch(query).split(/\s+/).filter(Boolean);
  const text = normalizeReassignSearch(fields.filter(Boolean).join(" "));
  return words.every(word => text.includes(word));
}

export function reassignPayload(kind: "user" | "group", id: string): TaskReassignPayload | null {
  if (!id.trim()) return null;
  return kind === "user" ? { newAssignedUserId: id } : { newTaskGroupId: id };
}