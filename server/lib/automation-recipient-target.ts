import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { roles, taskGroups, taskGroupMembers, users } from "@shared/schema";
import { isSharedBackOfficeRole } from "./automation-recipient-policy";
import { isTaskAssignmentUserAllowed } from "./task-assignment-access";

export type AutomationRecipientTarget = {
  userIds: string[];
  tags: string[];
  isBackOffice: boolean;
};

/** Same Task Groups and Roles as Status List, without its legacy agent fallback. */
export async function resolveAutomationRecipientTarget(config: {
  taskGroupId?: string;
  targetRole?: string;
}, options: { purpose?: "task" | "email" } = {}): Promise<AutomationRecipientTarget> {
  if (config.taskGroupId && config.targetRole) throw new Error("Choose either a task group or a role");
  if (config.taskGroupId) {
    const [group] = await db.select().from(taskGroups).where(eq(taskGroups.id, config.taskGroupId)).limit(1);
    if (!group) throw new Error("Task group no longer exists");
    const members = await db.select({ id: users.id }).from(taskGroupMembers)
      .innerJoin(users, eq(users.id, taskGroupMembers.userId))
      .where(and(eq(taskGroupMembers.groupId, group.id), eq(users.isActive, true)));
    const selected = await Promise.all(members.map(async member =>
      options.purpose === "email" || await isTaskAssignmentUserAllowed(db, member.id) ? member.id : null
    ));
    const userIds = [...new Set(selected.filter((id): id is string => !!id))].sort();
    if (!userIds.length) throw new Error("Task group has no active members");
    if (userIds.length > 100) throw new Error("Task group exceeds the 100-member automation limit");
    return {
      userIds,
      tags: [`group:${group.name}`, `group_id:${group.id}`, ...(group.isBackOffice ? ["back_office"] : [])],
      isBackOffice: !!group.isBackOffice,
    };
  }
  if (config.targetRole) {
    const roleName = config.targetRole.replace(/^role:/, "").trim();
    if (!roleName || roleName.length > 100) throw new Error("Invalid role");
    const [role] = await db.select({
      id: roles.id, name: roles.name, legacyRole: roles.legacyRole,
    }).from(roles).where(and(eq(roles.isActive, true), sql`(
      ${roles.id} = ${roleName} OR lower(${roles.name}) = lower(${roleName}) OR ${roles.legacyRole} = ${roleName}
    )`)).limit(1);
    if (!role) throw new Error("Role no longer exists or is inactive");
    // Match both new Roles assignments and legacy users.role, as Status List does.
    const result = await db.execute<{ id: string }>(sql`
      SELECT DISTINCT u.id FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE u.is_active = true AND (
        ur.role_id = ${role.id}
        OR u.role_id = ${role.id}
        OR u.role = ${role.name}
        OR (${role.legacyRole || ""} <> '' AND u.role = ${role.legacyRole || ""})
      )
      ORDER BY u.id LIMIT 101
    `);
    const selected = await Promise.all(result.rows.map(async row =>
      options.purpose === "email" || await isTaskAssignmentUserAllowed(db, row.id) ? row.id : null
    ));
    const userIds = selected.filter((id): id is string => !!id);
    if (!userIds.length) throw new Error("Role has no active members");
    if (userIds.length > 100) throw new Error("Role exceeds the 100-member automation limit");
    const isBackOffice = isSharedBackOfficeRole(role);
    return { userIds, tags: [role.name, ...(isBackOffice ? ["back_office"] : [])], isBackOffice };
  }
  throw new Error("Choose a task group or role");
}