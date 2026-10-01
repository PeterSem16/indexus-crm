import { eq, inArray, sql } from "drizzle-orm";
import {
  campaignStatusListItems,
  taskGroupMembers,
  taskGroups,
  tasks,
  users,
} from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";
import { notificationService } from "./notification-service";
import { ensureTaskAiChecklist } from "./task-ai-checklist";

export type StatusListTaskActionContext = {
  campaignId: string;
  campaignContactId: string;
  itemId: string;
  userId: string;
  contactCountry: string | null;
  contactId: string | null;
  taskCustomerId: string | null;
  ccRow: any;
  boNotifContext: string;
};

/**
 * Back Office Task Groups are a shared claim queue, so one confirmation creates
 * one task owned by the first member. Ordinary groups keep one task per member.
 */
export function resolveStatusListGroupTaskOwners(
  assignees: string[],
  isBackOffice: boolean | null | undefined,
): string[] {
  return isBackOffice ? [assignees[0]] : assignees;
}

function parseDueDate(str: string | null | undefined): Date {
  const now = new Date();
  if (!str) return new Date(now.getTime() + 86400000);
  const match = str.match(/^\+(\d+)([hd])$/);
  if (!match) return new Date(now.getTime() + 86400000);
  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const ms = unit === "h" ? amount * 3600000 : amount * 86400000;
  return new Date(now.getTime() + ms);
}

/**
 * Execute the existing Status List assign_task action.
 *
 * This is intentionally a behavior-preserving extraction: routing, task
 * metadata, Back Office claim semantics, task-assignment events, and the
 * configured notification channels remain identical to the legacy executor.
 */
export async function executeStatusListTaskAction(
  automation: any,
  context: StatusListTaskActionContext,
): Promise<void> {
  const {
    campaignId, campaignContactId, itemId, userId, contactCountry,
    contactId, taskCustomerId, ccRow, boNotifContext,
  } = context;
  const dueDate = parseDueDate(automation.taskDeadlineOffset);

  const [slItem] = await db.select()
    .from(campaignStatusListItems)
    .where(eq(campaignStatusListItems.id, itemId))
    .limit(1);
  const taskTitle = slItem
    ? `SL: ${slItem.label}`
    : `Status List Task (${itemId})`;

  let resolvedDescription = automation.taskDescription || `Automaticky vytvorená úloha zo Status Listu. Kampaň ${campaignId}, kontakt ${campaignContactId}.`;
  if (resolvedDescription.includes("{{")) {
    try {
      let contact: any = null;
      let pc: any = null;
      if (taskCustomerId) {
        const contactRes: any = await db.execute<any>(
          sql`SELECT first_name, last_name, email, phone FROM customers WHERE id = ${taskCustomerId} LIMIT 1`
        );
        contact = contactRes?.rows?.[0] as any;
        const pcRes: any = await db.execute<any>(
          sql`SELECT h.name AS hospital_name, c.name AS clinic_name FROM potential_cases pc LEFT JOIN hospitals h ON h.id = pc.hospital_id LEFT JOIN clinics c ON c.id = pc.clinic_id WHERE pc.customer_id = ${taskCustomerId} ORDER BY pc.created_at DESC LIMIT 1`
        );
        pc = pcRes?.rows?.[0] as any;
      }
      let directClinicName = "";
      let directHospitalName = "";
      if (ccRow?.contactType === "clinic" && ccRow.clinicId) {
        const clRes: any = await db.execute<any>(
          sql`SELECT name FROM clinics WHERE id = ${ccRow.clinicId} LIMIT 1`
        );
        directClinicName = clRes?.rows?.[0]?.name || "";
      } else if (ccRow?.contactType === "hospital" && ccRow.hospitalId) {
        const hoRes: any = await db.execute<any>(
          sql`SELECT name FROM hospitals WHERE id = ${ccRow.hospitalId} LIMIT 1`
        );
        directHospitalName = hoRes?.rows?.[0]?.name || "";
      }
      const campaignRes: any = await db.execute<any>(
        sql`SELECT name FROM campaigns WHERE id = ${campaignId} LIMIT 1`
      );
      const campaign = campaignRes?.rows?.[0] as any;
      const agentRes: any = await db.execute<any>(
        sql`SELECT full_name, username FROM users WHERE id = ${userId} LIMIT 1`
      );
      const agent = agentRes?.rows?.[0] as any;
      resolvedDescription = resolvedDescription
        .replace(/\{\{customer\.name\}\}/g, contact ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim() : "")
        .replace(/\{\{customer\.id\}\}/g, taskCustomerId ?? "")
        .replace(/\{\{customer\.phone\}\}/g, contact?.phone || "")
        .replace(/\{\{customer\.email\}\}/g, contact?.email || "")
        .replace(/\{\{campaign\.name\}\}/g, campaign?.name || "")
        .replace(/\{\{agent\.name\}\}/g, agent ? (agent.full_name || agent.username || "") : "")
        .replace(/\{\{clinic\.name\}\}/g, directClinicName || pc?.clinic_name || "")
        .replace(/\{\{hospital\.name\}\}/g, directHospitalName || pc?.hospital_name || "")
        .replace(/\{\{(reason|status\.label)\}\}/g, slItem?.label || "");
    } catch (varErr) {
      console.error("[assign_task] Variable resolution error:", varErr);
    }
  }

  const groupId = automation.taskGroupId;
  const targetRole: string = automation.targetRole || "";
  const taskTags = ["status_list"];
  // Keep the status-list item relation for automations, but also preserve the
  // actual card that caused the task (customerId is null for many institutions).
  const sourceType = ccRow?.contactType;
  const sourceId = sourceType === "clinic" ? ccRow?.clinicId
    : sourceType === "hospital" ? ccRow?.hospitalId
    : sourceType === "collaborator" ? ccRow?.collaboratorId
    : sourceType === "customer" ? ccRow?.customerId : null;
  if (sourceId && ["customer", "clinic", "hospital", "collaborator"].includes(sourceType)) {
    taskTags.push(`source_entity:${sourceType}:${sourceId}`);
  }
  const roleName = targetRole.startsWith("role:") ? targetRole.slice(5) : targetRole;
  let notifyAssignees: string[] = [];
  let wasGroupPath = false;
  let groupNameForNotif: string | null = null;
  let isBackOfficeTask = false;

  const createAssignedStatusTask = async (taskValues: any) => {
    const [createdTask] = await db.insert(tasks).values(taskValues).returning();
    if (createdTask) {
      // This insert commits independently; task creation is never coupled to AI.
      void ensureTaskAiChecklist(createdTask.id);
      try {
        const { emitTaskAssigned } = await import("./event-bus");
        await emitTaskAssigned(createdTask, undefined, userId);
      } catch (err) { console.error("[EventBus] status-list task assignment emit error:", err); }
    }
    return createdTask;
  };

  if (groupId) {
    const groupMembersRows = await db.select().from(taskGroupMembers)
      .where(eq(taskGroupMembers.groupId, groupId));
    const [groupRow] = await db.select().from(taskGroups)
      .where(eq(taskGroups.id, groupId)).limit(1);
    if (groupRow) taskTags.push(`group:${groupRow.name}`);
    taskTags.push(`group_id:${groupId}`);
    if (groupRow?.isBackOffice) taskTags.push("back_office");
    isBackOfficeTask = !!groupRow?.isBackOffice;
    const assignees = groupMembersRows.length > 0 ? groupMembersRows.map(m => m.userId) : [userId];
    const taskOwners = resolveStatusListGroupTaskOwners(assignees, groupRow?.isBackOffice);
    for (const assigneeId of taskOwners) {
      await createAssignedStatusTask({
        title: taskTitle,
        description: resolvedDescription,
        dueDate,
        priority: (automation.taskPriority as any) || "medium",
        status: "pending",
        assignedUserId: assigneeId,
        createdByUserId: userId,
        tags: taskTags,
        customerId: taskCustomerId,
        relatedEntityType: "status_list_item",
        relatedEntityId: itemId,
        country: contactCountry ?? null,
      });
    }
    notifyAssignees = assignees;
    wasGroupPath = true;
    groupNameForNotif = groupRow?.name ?? groupId;
  } else if (roleName) {
    const roleUsers = await db.execute<any>(sql`
      WITH matching_roles AS (
        SELECT id, legacy_role FROM roles
        WHERE lower(name) = lower(${roleName}) OR legacy_role = ${roleName}
      )
      SELECT DISTINCT u.id
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE u.is_active = true AND (
        ur.role_id IN (SELECT id FROM matching_roles)
        OR u.role_id IN (SELECT id FROM matching_roles)
        OR u.role = ${roleName}
        OR u.role IN (SELECT legacy_role FROM matching_roles WHERE legacy_role IS NOT NULL)
      )
      LIMIT 20
    `);
    const roleRows: any[] = (roleUsers as any)?.rows ?? (Array.isArray(roleUsers) ? roleUsers : []);
    const roleUserIds: string[] = roleRows.length > 0
      ? roleRows.map((u: any) => u.id)
      : [userId];
    const legacyTags = [...taskTags, roleName === "back_office" ? "back_office" : roleName];
    isBackOfficeTask = roleName === "back_office";
    for (const assigneeId of roleUserIds) {
      await createAssignedStatusTask({
        title: taskTitle,
        description: resolvedDescription,
        dueDate,
        priority: (automation.taskPriority as any) || "medium",
        status: "pending",
        assignedUserId: assigneeId,
        createdByUserId: userId,
        tags: legacyTags,
        customerId: taskCustomerId,
        relatedEntityType: "status_list_item",
        relatedEntityId: itemId,
        country: contactCountry ?? null,
      });
    }
    notifyAssignees = roleUserIds;
  } else {
    await createAssignedStatusTask({
      title: taskTitle,
      description: resolvedDescription,
      dueDate,
      priority: (automation.taskPriority as any) || "medium",
      status: "pending",
      assignedUserId: userId,
      createdByUserId: userId,
      tags: [...taskTags, "back_office"],
      customerId: taskCustomerId,
      relatedEntityType: "status_list_item",
      relatedEntityId: itemId,
      country: contactCountry ?? null,
    });
    notifyAssignees = [userId];
    isBackOfficeTask = true;
  }

  try {
    const uniqueAssignees = Array.from(new Set(notifyAssignees)).filter(Boolean);
    let channels: string[] = [];
    if (automation.assignNotify) {
      channels = (automation.assignNotifyChannels && automation.assignNotifyChannels.length > 0)
        ? automation.assignNotifyChannels
        : ["push"];
    } else if (wasGroupPath) {
      channels = ["push"];
    }

    if (uniqueAssignees.length > 0 && channels.length > 0) {
      const wantPush = channels.includes("push");
      const wantEmail = channels.includes("email");
      const wantSms = channels.includes("sms");
      let assigneeRows: { id: string; email: string | null; phone: string | null }[] = [];
      if (wantEmail || wantSms) {
        assigneeRows = await db.select({ id: users.id, email: users.email, phone: users.phone })
          .from(users).where(inArray(users.id, uniqueAssignees));
      }

      if (wantPush) {
        try {
          await notificationService.sendNotificationToUsers(uniqueAssignees, {
            type: wasGroupPath ? "group_task_assigned" : "task_assigned",
            title: `Nová úloha: ${taskTitle}`,
            message: wasGroupPath && groupNameForNotif
              ? `Skupina: ${groupNameForNotif}`
              : "Bola vám pridelená nová úloha.",
            priority: "normal",
            entityType: "task",
            metadata: { taskTitle, ...(wasGroupPath ? { groupName: groupNameForNotif } : {}), ...(isBackOfficeTask ? { isBackOffice: true } : {}) },
          });
        } catch (e) { console.error("[assign_task] push notification failed:", e); }
      }

      if (wantEmail) {
        try {
          const ms365Connection = await storage.getUserMs365Connection(userId);
          if (ms365Connection && ms365Connection.isConnected) {
            const { decryptTokenSafe } = await import("./token-crypto");
            const { getValidAccessToken, sendEmail } = await import("./ms365");
            const accessTok = decryptTokenSafe(ms365Connection.accessToken);
            const refreshTok = ms365Connection.refreshToken ? decryptTokenSafe(ms365Connection.refreshToken) : null;
            const tokenResult = await getValidAccessToken(accessTok, ms365Connection.tokenExpiresAt, refreshTok);
            if (tokenResult) {
              const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
              const recipients = assigneeRows.filter(r => !!r.email);
              const ctxHtml = boNotifContext
                ? `<p>${boNotifContext.split(" · ").map(esc).join("<br/>")}</p>`
                : "";
              const bodyHtml = `<p>Bola vám pridelená nová úloha v INDEXUS CRM.</p>`
                + `<p><strong>${esc(taskTitle)}</strong></p>`
                + ctxHtml
                + `<p>Detaily nájdete v aplikácii INDEXUS CRM.</p>`;
              for (const r of recipients) {
                try {
                  await sendEmail(tokenResult.accessToken, [r.email!], `Nová úloha: ${taskTitle}`, bodyHtml, true);
                } catch (e) { console.error("[assign_task] email send failed for user", r.id, e instanceof Error ? e.message : String(e)); }
              }
            } else {
              console.warn("[assign_task] email channel skipped: MS365 token invalid for triggering user");
            }
          } else {
            console.warn("[assign_task] email channel skipped: triggering user has no MS365 connection");
          }
        } catch (e) { console.error("[assign_task] email channel error:", e); }
      }

      if (wantSms) {
        try {
          const { sendSmsViaProvider } = await import("./sms-provider");
          const smsRecipients = assigneeRows.filter(r => !!r.phone);
          const smsCtx = boNotifContext ? ` (${boNotifContext})` : "";
          for (const r of smsRecipients) {
            try {
              const notificationText = `INDEXUS: Nová úloha - ${taskTitle}${smsCtx}`;
              const communication = await storage.createCommunicationMessage({
                campaignId: campaignId || undefined,
                entityType: ccRow?.contactType || undefined,
                entityId: contactId || undefined,
                userId,
                type: "sms",
                direction: "outbound",
                content: notificationText,
                recipientPhone: r.phone!,
                status: "pending",
                metadata: JSON.stringify({
                  purpose: "task_notification",
                  campaignId: campaignId || null,
                  entityId: contactId || null,
                }),
              });
              const result = await sendSmsViaProvider({
                number: r.phone!,
                text: notificationText,
                country: contactCountry ?? undefined,
                campaignId: campaignId || undefined,
                tag: communication.id,
              });
              await storage.updateCommunicationMessage(communication.id, {
                status: result.success ? "sent" : "failed",
                provider: result.provider,
                externalId: result.smsId,
                errorMessage: result.success ? undefined : result.error,
                sentAt: result.success ? new Date() : undefined,
                metadata: JSON.stringify({ batchId: result.batchId || null, purpose: "task_notification", campaignId: campaignId || null, entityId: contactId || null }),
              });
            } catch (e) { console.error("[assign_task] sms send failed for user", r.id, e instanceof Error ? e.message : String(e)); }
          }
          if (smsRecipients.length === 0) {
            console.warn("[assign_task] sms channel skipped: no recipient phone");
          }
        } catch (e) { console.error("[assign_task] sms channel error:", e); }
      }
    }
  } catch (notifyErr) {
    console.error("[assign_task] notification dispatch error:", notifyErr);
  }
}