import { emailActionIssues } from "./automation-email-action";
import { smsRecipientList } from "./automation-sms-policy";
import { taskActionDeadline, validTaskActionRecipients } from "./automation-task-action";
import { updateRecordIssues } from "./automation-update-record";

export const statusListNativeActionTypes = {
  assign_task: "create_task",
  send_email: "send_email",
  update_record: "update_entity",
  notify_role: "notify_user",
  send_email_group: "send_email",
  notify_email: "send_email",
  send_contact_email: "send_email",
  send_sms: "send_sms",
} as const;
export type StatusListNativeActionType = typeof statusListNativeActionTypes[keyof typeof statusListNativeActionTypes];
export function statusListNativeActionType(actionType: string): StatusListNativeActionType | undefined {
  return Object.prototype.hasOwnProperty.call(statusListNativeActionTypes, actionType)
    ? statusListNativeActionTypes[actionType as keyof typeof statusListNativeActionTypes] : undefined;
}

/** Same native payload as general Automations; no client-owned execution context. */
export function statusListNativeActionIssues(actionType: string, config: unknown): string[] {
  if (config == null) return ["send_email", "update_record"].includes(actionType) ? ["Action configuration is required"] : [];
  const type = statusListNativeActionType(actionType);
  if (!type) return ["This action does not support a shared service configuration"];
  if (typeof config !== "object" || Array.isArray(config)) return ["Action configuration must be an object"];
  const c = config as Record<string, any>;
  // Email snapshots include copied attachments (up to 25 MB, base64 encoded).
  if (JSON.stringify(c).length > (type === "send_email" ? 36_000_000 : 1_000_000)) return ["Action configuration is too large"];
  if (type === "update_entity") {
    if (!["clinic", "hospital"].includes(c.target?.entityType)) return ["Choose a clinic or hospital"];
    if (!["event", "selected"].includes(c.target?.mode)) return ["Unsupported record target"];
    return updateRecordIssues(c, c.target.entityType);
  }
  for (const field of ["taskGroupId", "targetRole", "assignedUserId", "assignedDepartmentId", "userId"])
    if (c[field] != null && (typeof c[field] !== "string" || !c[field].trim() || c[field].length > 200))
      return ["Invalid action recipient"];
  if (type === "send_email") {
    if (c.emailActionVersion !== 2) return ["Use the current email editor"];
    return emailActionIssues(c);
  }
  if (type === "send_sms") {
    const issues: string[] = [];
    if (c.smsActionVersion !== 2) issues.push("Use the current SMS editor");
    try { smsRecipientList(c.to); } catch { issues.push("Choose valid international SMS recipients"); }
    if (typeof c.text !== "string" || !c.text.trim()) issues.push("SMS message is required");
    if (c.provider != null && !["default", "bulkgate", "smstools"].includes(c.provider)) issues.push("Invalid SMS gateway");
    if (c.kind != null && !["transactional", "promotional"].includes(c.kind)) issues.push("Invalid SMS kind");
    return issues;
  }
  if (type === "notify_user") {
    const issues: string[] = [];
    if (c.notificationActionVersion !== 2) issues.push("Use the current notification editor");
    if (typeof c.title !== "string" || !c.title.trim()) issues.push("Notification title is required");
    if (c.message != null && typeof c.message !== "string") issues.push("Invalid notification message");
    const grouped = Boolean(c.taskGroupId || c.targetRole);
    const direct = Boolean(c.userId || c.userIds?.length);
    if ((!grouped && !direct) || (grouped && direct) || (c.taskGroupId && c.targetRole)) issues.push("Choose notification recipients");
    if (c.userIds != null && (!Array.isArray(c.userIds) || !c.userIds.length || c.userIds.length > 100 ||
      c.userIds.some((id: unknown) => typeof id !== "string" || !id.trim()))) issues.push("Invalid notification recipients");
    return issues;
  }
  const issues: string[] = [];
  if (typeof c.title !== "string" || !c.title.trim()) issues.push("Task title is required");
  if (c.recipients !== undefined) {
    if (!validTaskActionRecipients(c.recipients)) issues.push("Choose task participants");
    if (c.assignedUserId || c.assignedDepartmentId || c.taskGroupId || c.targetRole) issues.push("Conflicting task participants");
  } else if (![c.assignedUserId, c.assignedDepartmentId, c.taskGroupId, c.targetRole].filter(Boolean).length) {
    issues.push("Choose task participants");
  } else if ([c.assignedUserId, c.assignedDepartmentId, c.taskGroupId, c.targetRole].filter(Boolean).length > 1) {
    issues.push("Conflicting task participants");
  }
  try { taskActionDeadline(c, new Date()); } catch { issues.push("Invalid task deadline"); }
  if (c.priority != null && !["low", "medium", "high", "urgent"].includes(c.priority)) issues.push("Invalid task priority");
  return issues;
}
