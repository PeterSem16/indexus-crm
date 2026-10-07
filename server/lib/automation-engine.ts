import { db } from "../db";
import { ensureTaskAiChecklist } from "./task-ai-checklist";
import { taskTemplateContext } from "./task-template-variables";
import { eq, and, gte, inArray, sql } from "drizzle-orm";
import {
  workflowRules,
  workflowEvents,
  workflowRuns,
  workflowActionLog,
  COUNTRIES,
  tasks,
  taskGroupMembers,
  callLogs,
  users,
  taskSubscriptions,
  taskChecklistItems,
  customers,
  hospitals,
  clinics,
  inboundCallLogs,
  queueMembers,
  agentStandingForwards,
  type WorkflowRule,
  type WorkflowEvent,
} from "@shared/schema";
import { setEventDispatcher } from "./event-bus";
import {
  compareOrderedValues, conditionValuesEqual, fieldsForEvent,
  matchesRuleCountryScope, SCHEDULE_MAX_MATCHES, SCHEDULE_MAX_SCAN_ROWS, SCHEDULE_RECORD_MODULES,
  validateRuleCapabilities,
} from "./automation-capabilities";
import { permitsSentimentSource } from "./sentiment-source-guard";
import { taskAssignmentTriggerMatches, taskAutomationListMatches } from "@shared/task-automation";
import { resolveAutomationRecipientTarget } from "./automation-recipient-target";
import { taskOwnersForTarget } from "./automation-recipient-policy";
import { taskActionContent, taskActionDeadline, validTaskActionRecipients } from "@shared/automation-task-action";
import { planTaskActionRecipients, type TaskCreationAssignment } from "./automation-task-plan";
import type { AUTOMATION_ACTION_POLICY } from "./automation-action-policy";
import { sendEmail as sendEmailViaProvider } from "../email";
import { storage } from "../storage";
import { deliverAutomationEmail, planAutomationEmailRecipients } from "./automation-email-delivery";
import { renderEmailAddressConfig } from "./automation-email-policy";
import { assertTaskRecipientAllowed, hasAllowedTaskRecipient, countryAuthorizedTaskRecipientIds } from "./task-assignment-access";
import { userMayAccessTaskCountry } from "./task-contract";
import {
  getValidAccessToken as getMs365ValidToken,
  sendEmail as ms365SendEmail,
} from "./ms365";

const MAX_CAUSATION_DEPTH = 5;

/* ------------------------------------------------------------
 *  Template engine — {{path.to.field}} substitution
 * ------------------------------------------------------------ */
function getPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function renderTemplate(input: any, ctx: any): any {
  if (input == null) return input;
  if (typeof input === "string") {
    return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, p) => {
      const v = getPath(ctx, p);
      return v == null ? "" : String(v);
    });
  }
  if (Array.isArray(input)) return input.map((x) => renderTemplate(x, ctx));
  if (typeof input === "object") {
    const out: any = {};
    for (const k of Object.keys(input)) out[k] = renderTemplate(input[k], ctx);
    return out;
  }
  return input;
}

/* ------------------------------------------------------------
 *  Condition DSL evaluator
 * ------------------------------------------------------------ */
type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond }
  | { field: string; op: string; value?: any };

function evalCondition(cond: Cond | null | undefined, ctx: any): boolean {
  if (!cond) return true;
  if ((cond as any).all) return (cond as any).all.every((c: Cond) => evalCondition(c, ctx));
  if ((cond as any).any) return (cond as any).any.some((c: Cond) => evalCondition(c, ctx));
  if ((cond as any).not) return !evalCondition((cond as any).not, ctx);
  const c = cond as { field: string; op: string; value?: any };
  const v = getPath(ctx, c.field);
  // A field absent from the event must not satisfy negative comparisons.
  if (v === undefined) return false;
  switch (c.op) {
    case "eq": return conditionValuesEqual(v, c.value);
    case "neq": return !conditionValuesEqual(v, c.value);
    case "gt": return compareOrderedValues(v, c.value, "gt");
    case "gte": return compareOrderedValues(v, c.value, "gte");
    case "lt": return compareOrderedValues(v, c.value, "lt");
    case "lte": return compareOrderedValues(v, c.value, "lte");
    case "in": return Array.isArray(v) ? taskAutomationListMatches(v, c.value) : Array.isArray(c.value) && c.value.some((item: unknown) => conditionValuesEqual(v, item));
    case "not_in": return Array.isArray(v) ? Array.isArray(c.value) && !taskAutomationListMatches(v, c.value) : Array.isArray(c.value) && !c.value.some((item: unknown) => conditionValuesEqual(v, item));
    case "contains": return typeof v === "string" && v.includes(String(c.value));
    case "starts_with": return typeof v === "string" && v.startsWith(String(c.value));
    case "is_null": return v == null;
    case "is_not_null": return v != null;
    case "changed": {
      const oldV = getPath(ctx, c.field.replace(/^newValues\./, "oldValues."));
      return oldV !== v;
    }
    case "changed_to": {
      const oldV = getPath(ctx, c.field.replace(/^newValues\./, "oldValues."));
      return !conditionValuesEqual(oldV, v) && conditionValuesEqual(v, c.value);
    }
    case "changed_from": {
      const oldV = getPath(ctx, c.field.replace(/^newValues\./, "oldValues."));
      return !conditionValuesEqual(oldV, v) && conditionValuesEqual(oldV, c.value);
    }
    default:
      console.warn(`[Automation] Unknown operator: ${c.op}`);
      return false;
  }
}

/* ------------------------------------------------------------
 *  Action handlers
 * ------------------------------------------------------------ */
type ActionResult = { ok: boolean; output?: any; error?: string };

// Dynamic inbound recipients must be the agent of a persisted call, never a
// client-supplied template path or an agent from a different queue.
async function verifiedInboundAgentRecipient(raw: unknown, recipientId: string, ctx: any): Promise<boolean> {
  const field = typeof raw === "string"
    ? raw.match(/^\{\{\s*newValues\.(agentId|assignedAgentId)\s*\}\}$/)?.[1]
    : null;
  if (!field) return true;
  if (ctx.event?.module !== "call" || ctx.event?.entityType !== "call" || !recipientId ||
      recipientId !== ctx.newValues?.[field] ||
      !ctx.event?.entityId || ctx.event.entityId !== ctx.newValues?.callId) return false;
  if (field === "agentId" && ctx.event?.source === "storage") {
    if (!["outbound.started", "outbound.answered", "outbound.completed", "outbound.unanswered"]
      .includes(ctx.event.eventType)) return false;
    const [call] = await db.select({
      id: callLogs.id,
      userId: callLogs.userId,
      direction: callLogs.direction,
    }).from(callLogs).where(eq(callLogs.id, ctx.event.entityId)).limit(1);
    if (!call || call.direction !== "outbound" || call.id !== ctx.newValues.callId ||
        call.userId !== recipientId || ctx.newValues.agentId !== recipientId) return false;
    const [user] = await db.select({ id: users.id }).from(users)
      .where(eq(users.id, recipientId)).limit(1);
    return user?.id === recipientId;
  }
  if (ctx.event?.source !== "inbound-call") return false;
  const [call] = await db.select({
    queueId: inboundCallLogs.queueId,
    assignedAgentId: inboundCallLogs.assignedAgentId,
  }).from(inboundCallLogs).where(eq(inboundCallLogs.id, ctx.event.entityId)).limit(1);
  if (!call?.queueId || call.queueId !== ctx.newValues.queueId) return false;
  if (call.assignedAgentId === recipientId || call.assignedAgentId === `standing:${recipientId}`) return true;
  const [member] = await db.select({ id: queueMembers.id }).from(queueMembers).where(and(
    eq(queueMembers.queueId, call.queueId),
    eq(queueMembers.userId, recipientId),
    eq(queueMembers.isActive, true),
  )).limit(1);
  if (member) return true;
  const [forward] = await db.select({ id: agentStandingForwards.id }).from(agentStandingForwards).where(and(
    eq(agentStandingForwards.inboundQueueId, call.queueId),
    eq(agentStandingForwards.userId, recipientId),
  )).limit(1);
  return !!forward;
}

async function actionCreateTask(config: any, ctx: any, runId: string): Promise<ActionResult> {
  try {
    ctx = taskTemplateContext(ctx, config.templateLanguage);
    // New task text must never silently lose unavailable template variables.
    if (config.taskText !== undefined) {
      for (const value of [config.title, config.description, config.taskText]) {
        if (typeof value !== "string") continue;
        for (const match of value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
          if (getPath(ctx, match[1]) == null) throw new Error(`Task variable is unavailable: ${match[1]}`);
        }
      }
    }
    const rendered = renderTemplate(config, ctx);
    const assignedUserId = rendered.assignedUserId || rendered.assignee_user_id || null;
    const assignedDepartmentId = rendered.assignedDepartmentId || rendered.assignee_department_id || null;
    const grouped = rendered.taskGroupId || rendered.targetRole;
    const multiple = rendered.recipients !== undefined;
    if (multiple && (!validTaskActionRecipients(rendered.recipients) ||
        assignedUserId || assignedDepartmentId || grouped)) {
      throw new Error("Choose valid task recipients without conflicting legacy targets");
    }
    if (grouped && (assignedUserId || assignedDepartmentId)) {
      return { ok: false, error: "Choose one task recipient: user, department, group or role" };
    }
    if (!multiple && !assignedUserId && !assignedDepartmentId && !grouped) {
      return { ok: false, error: "create_task requires a user, department, task group or role" };
    }
    if (!(await verifiedInboundAgentRecipient(config.assignedUserId || config.assignee_user_id, assignedUserId, ctx))) {
      return { ok: false, error: "Inbound task recipient is not an authorized call agent" };
    }
    if (ctx.event?.module === "call" && (assignedDepartmentId || grouped ||
        rendered.recipients?.some((recipient: any) => recipient.kind !== "user")) &&
        (!ctx.newValues?.campaignId || !ctx.event?.countryCode)) {
      return { ok: false, error: "Inbound group task requires a verified Mission and queue country" };
    }
    if (ctx.event?.module === "call" && rendered.country && rendered.country !== ctx.event?.countryCode) {
      return { ok: false, error: "Inbound task country must match the persisted call queue" };
    }
    const dueDate = taskActionDeadline(rendered, new Date());
    let target = grouped ? await resolveAutomationRecipientTarget(rendered) : null;
    const taskCountry = ctx.event?.module === "call" ? ctx.event.countryCode || null : rendered.country || ctx.event?.countryCode || null;
    if (target) {
      const recipients = await db.select({ id: users.id, role: users.role, assignedCountries: users.assignedCountries, isActive: users.isActive })
        .from(users).where(inArray(users.id, target.userIds));
      const eligibleIds = recipients.filter(user => user.isActive && user.role
        && userMayAccessTaskCountry(user.role, user.assignedCountries, taskCountry))
        .map(user => user.id)
        .sort();
      if (target.tags.some(tag => tag.startsWith("group_id:")) && !await hasAllowedTaskRecipient(db, eligibleIds)) {
        throw new Error("The task group has no approved active country-authorized recipients");
      }
      target = { ...target, userIds: eligibleIds };
      if (!target.userIds.length) throw new Error("The task target has no approved active country-authorized recipients");
    }
    const multipleAssignments = multiple ? await planTaskActionRecipients(rendered.recipients, async recipient => {
      if (recipient.kind === "user") {
        const raw = config.recipients.find((item: any) => item.kind === "user" &&
          renderTemplate(item.id, ctx) === recipient.id)?.id;
        if (!await verifiedInboundAgentRecipient(raw, recipient.id, ctx))
          throw new Error("Inbound task recipient is not an authorized call agent");
        const ids = await countryAuthorizedTaskRecipientIds(db, [recipient.id], taskCountry);
        if (!ids.length) throw new Error("Task user is unavailable or not authorized");
        return { userIds: ids, tags: [], isBackOffice: false };
      }
      const resolved = await resolveAutomationRecipientTarget(recipient.kind === "group"
        ? { taskGroupId: recipient.id } : { targetRole: recipient.id });
      const ids = await countryAuthorizedTaskRecipientIds(db, resolved.userIds, taskCountry);
      return { ...resolved, userIds: ids };
    }) : null;
    const taskIds = await db.transaction(async tx => {
      let owners = target ? taskOwnersForTarget(target) : [assignedUserId || "system"];
      const groupId = target?.tags.find(tag => tag.startsWith("group_id:"))?.slice("group_id:".length);
      if (groupId && target) {
        const members = await tx.select({ userId: taskGroupMembers.userId }).from(taskGroupMembers)
          .where(eq(taskGroupMembers.groupId, groupId)).for("share");
        const currentMemberIds = await countryAuthorizedTaskRecipientIds(tx, members.map(member => member.userId), taskCountry);
        const eligibleIds = target.userIds.filter(id => currentMemberIds.includes(id));
        if (!eligibleIds.length) throw new Error("The task group has no approved active country-authorized recipients");
        owners = taskOwnersForTarget({ ...target, userIds: eligibleIds });
      }
      const ids: string[] = [];
      const assignments: TaskCreationAssignment[] = multipleAssignments ||
        owners.map(owner => ({ owner, tags: target?.tags || [] }));
      for (const assignment of assignments) {
        let owner = assignment.owner;
        if (assignment.groupId) {
          const members = await tx.select({ userId: taskGroupMembers.userId }).from(taskGroupMembers)
            .where(eq(taskGroupMembers.groupId, assignment.groupId)).for("share");
          const authorized = await countryAuthorizedTaskRecipientIds(tx, members.map(row => row.userId), taskCountry);
          owner = assignment.eligibleIds!.find(id => authorized.includes(id)) || "";
          if (!owner) throw new Error("The task group has no authorized active members");
        }
        await assertTaskRecipientAllowed(tx, owner, taskCountry);
        const [task] = await tx.insert(tasks).values({
        title: String(rendered.title || "Automation task"),
        description: taskActionContent(rendered),
        priority: rendered.priority || "medium",
        status: "pending",
        assignedUserId: owner,
        assignedDepartmentId: assignedDepartmentId || null,
        createdByUserId: rendered.createdByUserId || ctx.event?.actorUserId || "system",
        customerId: ctx.event?.source === "schedule"
          ? (ctx.event?.module === "customer" ? ctx.event.entityId : null)
          : rendered.customerId || (ctx.event?.entityType === "customer" ? ctx.event?.entityId : null),
        relatedEntityType: ctx.event?.source === "schedule"
          ? ctx.event?.entityType || null
          : rendered.relatedEntityType || ctx.event?.entityType || null,
        relatedEntityId: ctx.event?.source === "schedule"
          ? ctx.event?.entityId || null
          : rendered.relatedEntityId || ctx.event?.entityId || null,
        country: taskCountry,
        tags: assignment.tags,
        dueDate,
        sourceRunId: runId,
        }).returning();
        if (!task) throw new Error("Insert returned no row");
        ids.push(task.id);
        if (Array.isArray(rendered.checklist) && rendered.checklist.length) {
          await tx.insert(taskChecklistItems).values(rendered.checklist.map((it: any, idx: number) => ({
            taskId: task.id,
            position: idx,
            label: typeof it === "string" ? it : String(it.label || ""),
            required: typeof it === "object" ? it.required !== false : true,
          })));
        }
        const subs: any[] = [];
        const creatorId = rendered.createdByUserId || ctx.event?.actorUserId;
        if (creatorId) subs.push({ taskId: task.id, userId: creatorId, role: "creator", notifyOn: ["completed", "overdue"] });
        if (owner !== "system" && owner !== creatorId) {
          subs.push({ taskId: task.id, userId: owner, role: "assignee", notifyOn: ["overdue"] });
        }
        if (subs.length) await tx.insert(taskSubscriptions).values(subs);
      }
      return ids;
    });
    // Trigger after transaction commit. Existing automation template steps are
    // detected as preserved by the checklist service and are never replaced.
    for (const taskId of taskIds) void ensureTaskAiChecklist(taskId);
    return { ok: true, output: { taskId: taskIds[0], taskIds, taskCount: taskIds.length } };
  } catch (err: any) {
    return { ok: false, error: err?.message || "create_task failed" };
  }
}

async function actionNotifyUser(config: any, ctx: any): Promise<ActionResult> {
  try {
    const rendered = renderTemplate(config, ctx);
    const grouped = rendered.taskGroupId || rendered.targetRole;
    if (grouped && (rendered.userId || rendered.userIds?.length)) {
      return { ok: false, error: "Choose one notification recipient: user, group or role" };
    }
    if (grouped && ctx.event?.module === "call" &&
        (!ctx.newValues?.campaignId || !ctx.event?.countryCode)) {
      return { ok: false, error: "Inbound group notification requires a verified Mission and queue country" };
    }
    if (ctx.event?.module === "call" && rendered.countryCode && rendered.countryCode !== ctx.event?.countryCode) {
      return { ok: false, error: "Inbound notification country must match the persisted call queue" };
    }
    const userIds: string[] = grouped
      ? (await resolveAutomationRecipientTarget(rendered)).userIds
      : Array.isArray(rendered.userIds)
      ? rendered.userIds
      : rendered.userId
      ? [rendered.userId]
      : [];
    if (!userIds.length) return { ok: false, error: "notify_user requires userId or userIds" };
    const rawRecipients = Array.isArray(config.userIds) ? config.userIds : [config.userId];
    for (let i = 0; !grouped && i < userIds.length; i++) {
      if (!(await verifiedInboundAgentRecipient(rawRecipients[i], userIds[i], ctx))) {
        return { ok: false, error: "Inbound notification recipient is not an authorized call agent" };
      }
    }

    const { notificationService } = await import("./notification-service");
    await notificationService.sendNotificationToUsers(userIds, {
      type: rendered.type || "automation",
      title: String(rendered.title || "Notification"),
      message: rendered.message || "",
      priority: rendered.priority || "normal",
      entityType: ctx.event?.source === "schedule" ? ctx.event?.entityType : rendered.entityType || ctx.event?.entityType,
      entityId: ctx.event?.source === "schedule" ? ctx.event?.entityId : rendered.entityId || ctx.event?.entityId,
      countryCode: ctx.event?.module === "call" ? ctx.event.countryCode : rendered.countryCode || ctx.event?.countryCode,
      metadata: rendered.metadata || {},
    });
    return { ok: true, output: { notifiedUsers: userIds.length } };
  } catch (err: any) {
    return { ok: false, error: err?.message || "notify_user failed" };
  }
}

/** Load a stored message template by id and merge into config (config wins for non-empty fields). */
async function applyMessageTemplate(
  config: any,
  expectedType: "email" | "sms",
  silent = false,
): Promise<any> {
  const templateId = config?.templateId;
  if (!templateId || typeof templateId !== "string") return config;
  try {
    const tpl = await storage.getMessageTemplate(templateId);
    if (!tpl || tpl.isActive === false) return config;
    if (tpl.type !== expectedType) return config;
    const merged = { ...config };
    if (expectedType === "email") {
      if (!merged.subject && tpl.subject) merged.subject = tpl.subject;
      if (!merged.body) {
        merged.body =
          tpl.format === "html" && tpl.contentHtml ? tpl.contentHtml : tpl.content;
      }
      // Append template attachments (read from disk into base64) when not overridden
      if (!Array.isArray(merged.attachments) && Array.isArray(tpl.attachments) && tpl.attachments.length > 0) {
        const fs = await import("fs");
        const loaded: any[] = [];
        for (const a of tpl.attachments) {
          try {
            if (a?.filePath && fs.existsSync(a.filePath)) {
              const buf = fs.readFileSync(a.filePath);
              loaded.push({
                name: a.fileName || "attachment",
                contentType: a.mimeType || "application/octet-stream",
                contentBase64: buf.toString("base64"),
              });
            }
          } catch (e) {
            if (!silent) console.warn("[Automation] template attachment load failed:", (e as any)?.message);
          }
        }
        if (loaded.length > 0) merged.attachments = loaded;
      }
    } else {
      // sms: use plain content as text
      if (!merged.text && !merged.message) {
        merged.text = tpl.content;
      }
    }
    // Bump usage counter (best-effort)
    storage.incrementMessageTemplateUsage?.(templateId).catch?.(() => {});
    return merged;
  } catch (err) {
    if (!silent) console.warn("[Automation] applyMessageTemplate failed:", (err as any)?.message);
    return config;
  }
}

async function actionSendEmail(config: any, ctx: any): Promise<ActionResult> {
  if (config?.emailActionVersion === 2) return deliverAutomationEmail(config, ctx);
  const scheduled = ctx.event?.source === "schedule";
  try {
    config = await applyMessageTemplate(config, "email", scheduled);
    const rendered = renderTemplate(config, ctx);
    const grouped = rendered.taskGroupId || rendered.targetRole;
    if (grouped && rendered.to) return { ok: false, error: "Choose either an email address or a group/role" };
    if (ctx.event?.module === "call") {
      if (!ctx.newValues?.campaignId || !ctx.event?.countryCode)
        return { ok: false, error: "Inbound email requires a verified Mission and queue country" };
      if (rendered.countryCode && rendered.countryCode !== ctx.event.countryCode)
        return { ok: false, error: "Inbound email country must match the persisted call queue" };
    }
    const toRaw = grouped
      ? (await (async () => {
          const target = await resolveAutomationRecipientTarget(rendered);
          const { users } = await import("@shared/schema");
          const { inArray } = await import("drizzle-orm");
          const rows = await db.select({ email: users.email }).from(users).where(inArray(users.id, target.userIds));
          const emails = [...new Set(rows.map(row => row.email?.trim()).filter((v): v is string => !!v))];
          if (rows.length !== target.userIds.length || rows.some(row => !row.email?.trim()))
            throw new Error("Some group/role members have no email address");
          return emails;
        })())
      : rendered.to;
    if (!toRaw) return { ok: false, error: "send_email requires `to`" };
    const recipients: string[] = Array.isArray(toRaw)
      ? toRaw.map((s) => String(s).trim()).filter(Boolean)
      : String(toRaw)
          .split(/[,;\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);
    if (recipients.length === 0) return { ok: false, error: "send_email: no valid recipients" };

    const parseList = (v: any): string[] => {
      if (!v) return [];
      const arr = Array.isArray(v) ? v : String(v).split(/[,;\s]+/);
      return arr.map((s) => String(s).trim()).filter(Boolean);
    };
    const ccList = parseList(rendered.cc);
    const bccList = parseList(rendered.bcc);

    const subject = String(rendered.subject || "").trim();
    if (!subject) return { ok: false, error: "send_email requires `subject`" };
    const bodyRaw = String(rendered.body || "");
    const isHtml = /<[a-z][\s\S]*>/i.test(bodyRaw);
    const html = isHtml ? bodyRaw : bodyRaw.replace(/\n/g, "<br/>");
    const from = ctx.event?.source === "schedule"
      ? undefined
      : rendered.from ? String(rendered.from).trim() : undefined;

    // ----- Resolve attachments (max 5, max 10MB each, max 25MB total) -----
    const MAX_ATT = 5;
    const MAX_ONE = 10 * 1024 * 1024;
    const MAX_TOTAL = 25 * 1024 * 1024;
    const attRaw: any[] = Array.isArray(rendered.attachments) ? rendered.attachments : [];
    const attachments: Array<{ name: string; contentType: string; contentBase64: string }> = [];
    const attErrors: string[] = [];
    let totalBytes = 0;
    for (const a of attRaw.slice(0, MAX_ATT)) {
      try {
        const name = String(a?.name || "attachment").slice(0, 200);
        // Inline base64
        if (a?.contentBase64) {
          const b64 = String(a.contentBase64).replace(/^data:[^;]+;base64,/, "");
          const size = Math.floor((b64.length * 3) / 4);
          if (size > MAX_ONE) { attErrors.push(`${name}: exceeds 10MB`); continue; }
          if (totalBytes + size > MAX_TOTAL) { attErrors.push(`${name}: total exceeds 25MB`); continue; }
          totalBytes += size;
          attachments.push({
            name,
            contentType: String(a.contentType || "application/octet-stream"),
            contentBase64: b64,
          });
          continue;
        }
        // URL-based
        if (a?.url) {
          const url = String(a.url).trim();
          let parsed: URL;
          try { parsed = new URL(url); } catch { attErrors.push(`${name}: invalid url`); continue; }
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            attErrors.push(`${name}: protocol ${parsed.protocol} not allowed`); continue;
          }
          if (isBlockedWebhookHost(parsed.hostname)) {
            attErrors.push(`${name}: host blocked (private/internal)`); continue;
          }
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 15000);
          try {
            const res = await fetch(url, { signal: controller.signal });
            if (!res.ok) { attErrors.push(`${name}: fetch ${res.status}`); continue; }
            const contentType = a.contentType || res.headers.get("content-type") || "application/octet-stream";
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length > MAX_ONE) { attErrors.push(`${name}: exceeds 10MB`); continue; }
            if (totalBytes + buf.length > MAX_TOTAL) { attErrors.push(`${name}: total exceeds 25MB`); continue; }
            totalBytes += buf.length;
            attachments.push({ name, contentType: String(contentType), contentBase64: buf.toString("base64") });
          } finally {
            clearTimeout(timer);
          }
          continue;
        }
        attErrors.push(`${name}: missing url or contentBase64`);
      } catch (err: any) {
        attErrors.push(`attachment error: ${err?.message || "unknown"}`);
      }
    }

    const sent: string[] = [];
    const failed: string[] = [];
    let provider: "ms365" | "sendgrid" | "log" = "log";

    // Prefer MS365 system mailbox for the event's country (or `cc` config override)
    const countryCode: string | undefined = ctx.event?.source === "schedule"
      ? ctx.event?.countryCode || undefined
      : (ctx.event?.module !== "call" ? rendered.countryCode as string : undefined) ||
        ctx.event?.countryCode || undefined;
    let ms365Conn: any = null;
    if (countryCode) {
      try {
        ms365Conn = await storage.getSystemMs365Connection(countryCode);
      } catch {}
    }

    if (ms365Conn?.accessToken) {
      try {
        // Token refresh logs provider response bodies from the shared MS365
        // helper. Scheduled runs require a currently valid token instead, so
        // their failures never log vendor response data.
        if (scheduled && (!ms365Conn.tokenExpiresAt ||
            new Date(ms365Conn.tokenExpiresAt).getTime() <= Date.now() + 5 * 60 * 1000))
          return { ok: false, error: "Scheduled email requires a working country mailbox" };
        const tokenInfo = scheduled
          ? { accessToken: ms365Conn.accessToken, refreshed: false, refreshToken: undefined, expiresOn: ms365Conn.tokenExpiresAt }
          : await getMs365ValidToken(
            ms365Conn.accessToken,
            ms365Conn.tokenExpiresAt,
            ms365Conn.refreshToken,
          );
        if (tokenInfo?.accessToken) {
          // Persist refreshed token for reuse
          if (tokenInfo.refreshed) {
            try {
              await storage.updateSystemMs365Connection(countryCode!, {
                accessToken: tokenInfo.accessToken,
                refreshToken: tokenInfo.refreshToken || ms365Conn.refreshToken,
                tokenExpiresAt: tokenInfo.expiresOn || undefined,
              } as any);
            } catch {}
          }
          provider = "ms365";
          for (const to of recipients) {
            try {
              await ms365SendEmail(
                tokenInfo.accessToken,
                [to],
                subject,
                html,
                true,
                ccList.length > 0 ? ccList : undefined,
                attachments.length > 0 ? attachments : undefined,
                bccList.length > 0 ? bccList : undefined,
              );
              sent.push(to);
            } catch (err: any) {
              failed.push(`${to} (${err?.message || "ms365 error"})`);
            }
          }
        }
      } catch (err: any) {
        if (scheduled) return { ok: false, error: "Scheduled email requires a working country mailbox" };
        // Fall through to SendGrid below
        console.warn("[Automation] MS365 send failed, falling back:", err?.message);
      }
    }

    if (provider === "log") {
      if (scheduled) return { ok: false, error: "Scheduled email requires a working country mailbox" };
      provider = process.env.SENDGRID_API_KEY ? "sendgrid" : "log";
      for (const to of recipients) {
        const ok = await sendEmailViaProvider({ to, subject, html, from });
        if (ok) sent.push(to);
        else failed.push(to);
      }
    }

    if (grouped && failed.length > 0) {
      return { ok: false, error: `Group email delivery incomplete (${failed.length} of ${recipients.length} failed)`,
        output: { provider, sentCount: sent.length, failedCount: failed.length } };
    }
    if (sent.length === 0) {
      return { ok: false, error: `send_email failed for all recipients: ${failed.join(", ")}` };
    }
    return {
      ok: true,
      output: {
        provider,
        sent,
        failed,
        subject,
        from: from || (provider === "ms365" ? ms365Conn?.email : null),
        countryCode: countryCode || null,
        simulated: provider === "log",
        cc: ccList.length > 0 ? ccList : undefined,
        bcc: bccList.length > 0 ? bccList : undefined,
        attachments: attachments.map((a) => ({ name: a.name, contentType: a.contentType, sizeBytes: Math.floor((a.contentBase64.length * 3) / 4) })),
        attachmentErrors: attErrors.length > 0 ? attErrors : undefined,
      },
    };
  } catch (err: any) {
    return { ok: false, error: ctx.event?.source === "schedule" ? "Scheduled email failed" : err?.message || "send_email failed" };
  }
}

async function actionSendSms(config: any, ctx: any): Promise<ActionResult> {
  try {
    config = await applyMessageTemplate(config, "sms", ctx.event?.source === "schedule");
    const rendered = renderTemplate(config, ctx);
    const to: string = String(rendered.to || "").trim();
    const text: string = String(rendered.text || rendered.message || "").trim();
    if (!to) return { ok: false, error: "send_sms requires `to` (phone number)" };
    if (!text) return { ok: false, error: "send_sms requires `text`" };

    const promotional = rendered.kind === "promotional" || rendered.promotional === true;
    const country: string | undefined = ctx.event?.source === "schedule"
      ? ctx.event?.countryCode || undefined
      : rendered.country || ctx.event?.countryCode || undefined;
    // Mission identity must come from the server-emitted event, never from the
    // editable SMS action config. Campaign-contact events include campaignId in
    // newValues (or oldValues for delete-style events).
    const campaignId: string | undefined =
      ctx.newValues?.campaignId ||
      ctx.oldValues?.campaignId ||
      ctx.event?.newValues?.campaignId ||
      ctx.event?.oldValues?.campaignId ||
      undefined;

    const communication = await storage.createCommunicationMessage({
      customerId: ctx.customer?.id || (ctx.contact?.type === "customer" ? ctx.contact?.id : null)
        || (ctx.event?.entityType === "customer" ? ctx.event?.entityId : null) || ctx.event?.customerId || null,
      campaignId: campaignId || undefined,
      entityType: ctx.contact?.type || ctx.customer?.type || ctx.event?.entityType
        || (ctx.customer || ctx.event?.customerId ? "customer" : undefined),
      entityId: ctx.contact?.id || ctx.customer?.id || ctx.event?.entityId || ctx.event?.customerId || undefined,
      userId: ctx.user?.id || ctx.actor?.id || ctx.event?.userId || null,
      type: "sms",
      direction: "outbound",
      content: text,
      recipientPhone: to,
      status: "pending",
      metadata: JSON.stringify({
        source: "automation_engine",
        ruleId: ctx.rule?.id || ctx.event?.ruleId || null,
        campaignId: campaignId || null,
      }),
    });
    const { sendSmsViaProvider } = await import("./sms-provider");
    const result = await sendSmsViaProvider({
      number: to,
      text,
      country,
      // A Mission's configured provider is authoritative. Ignore stale
      // action-level provider fields rather than allowing a switch.
      provider: undefined,
      campaignId,
      // The campaign provider is authoritative; an action must not switch it.
      campaignProviderMode: "reject-conflict",
      promotional,
      unicode: rendered.unicode === true,
      tag: communication.id,
    });

    try {
      await storage.updateCommunicationMessage(communication.id, {
        status: result.success ? "sent" : "failed",
        provider: result.provider,
        externalId: result.smsId,
        errorMessage: result.success ? undefined : result.error,
        sentAt: result.success ? new Date() : undefined,
        metadata: JSON.stringify({
          batchId: result.batchId || null,
          source: "automation_engine",
          ruleId: ctx.rule?.id || ctx.event?.ruleId || null,
          campaignId: campaignId || null,
        }),
      });
    } catch (historyError) {
      console.error("[Automation] SMS communication history write failed:", historyError);
    }

    if (!result.success) {
      return { ok: false, error: result.error || "send_sms failed", output: { errorCode: result.errorCode } };
    }
    return {
      ok: true,
      output: {
        smsId: result.smsId,
        batchId: result.batchId,
        provider: result.provider,
        number: result.number,
        kind: promotional ? "promotional" : "transactional",
      },
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "send_sms failed" };
  }
}

function isBlockedWebhookHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") return true;
  if (h.endsWith(".local") || h.endsWith(".internal")) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 127) return true;
  }
  if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  return false;
}

async function actionWebhook(config: any, ctx: any): Promise<ActionResult> {
  try {
    const rendered = renderTemplate(config, ctx);
    const url: string = String(rendered.url || "").trim();
    if (!url) return { ok: false, error: "webhook requires `url`" };

    let parsed: URL;
    try { parsed = new URL(url); } catch { return { ok: false, error: "webhook url is not a valid URL" }; }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: `webhook protocol ${parsed.protocol} not allowed` };
    }
    if (isBlockedWebhookHost(parsed.hostname)) {
      return { ok: false, error: `webhook host ${parsed.hostname} is blocked (private/internal address)` };
    }

    const method = String(rendered.method || "POST").toUpperCase();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(rendered.headers && typeof rendered.headers === "object" ? rendered.headers : {}),
    };
    const bodyValue =
      rendered.body !== undefined ? rendered.body : { event: ctx.event, newValues: ctx.newValues, oldValues: ctx.oldValues };

    const controller = new AbortController();
    const timeoutMs = Number(rendered.timeoutMs) > 0 ? Math.min(Number(rendered.timeoutMs), 30000) : 10000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const init: RequestInit = { method, headers, signal: controller.signal };
    if (method !== "GET" && method !== "HEAD") {
      init.body = typeof bodyValue === "string" ? bodyValue : JSON.stringify(bodyValue);
    }
    try {
      const res = await fetch(url, init);
      const text = await res.text().catch(() => "");
      if (!res.ok) {
        return { ok: false, error: `webhook ${res.status}`, output: { status: res.status, body: text.slice(0, 500) } };
      }
      return { ok: true, output: { status: res.status, body: text.slice(0, 500) } };
    } finally {
      clearTimeout(timer);
    }
  } catch (err: any) {
    if (err?.name === "AbortError") return { ok: false, error: "webhook timed out" };
    return { ok: false, error: err?.message || "webhook failed" };
  }
}

/* Allow-list of entity types updateable via update_entity action.
 * Each entry maps to the corresponding storage method and allowed fields. */
const UPDATE_ENTITY_MAP: Record<
  string,
  { method: string; allowedFields: string[] }
> = {
  task: {
    method: "updateTask",
    allowedFields: [
      "status", "priority", "assignedUserId", "assignedDepartmentId",
      "dueDate", "title", "description", "resolution", "resolvedByUserId", "resolvedAt",
    ],
  },
  customer: {
    method: "updateCustomer",
    allowedFields: [
      "status", "clientStatus", "leadStatus", "leadScore",
      "assignedUserId", "notes", "country",
    ],
  },
  hospital: {
    method: "updateHospital",
    allowedFields: ["isActive", "autoRecruiting", "responsiblePersonId", "representativeId"],
  },
  clinic: {
    method: "updateClinic",
    allowedFields: [
      "isActive", "notes", "initialStatus", "contractStatus",
      "lastCallResult", "lastCallNote", "nextContactDate",
    ],
  },
  invoice: {
    method: "updateInvoice",
    allowedFields: ["status", "note", "sendDate", "dueDate", "paidAmount"],
  },
};

async function actionUpdateEntity(config: any, ctx: any): Promise<ActionResult> {
  try {
    const rendered = renderTemplate(config, ctx);
    const entityType: string = String(rendered.entityType || ctx.event?.entityType || "").trim();
    const entityId: string = String(rendered.entityId || ctx.event?.entityId || "").trim();
    const fields = rendered.fields && typeof rendered.fields === "object" ? rendered.fields : null;

    const cfg = UPDATE_ENTITY_MAP[entityType];
    if (!cfg) return { ok: false, error: `update_entity: unsupported entityType "${entityType}"` };
    if (!entityId) return { ok: false, error: "update_entity requires entityId" };
    if (!fields || Object.keys(fields).length === 0) return { ok: false, error: "update_entity requires non-empty fields" };

    // Filter to allow-listed fields only
    const safe: Record<string, any> = {};
    for (const k of Object.keys(fields)) {
      if (cfg.allowedFields.includes(k)) safe[k] = fields[k];
    }
    if (Object.keys(safe).length === 0) {
      return { ok: false, error: `update_entity: no allowed fields. Allowed for ${entityType}: ${cfg.allowedFields.join(", ")}` };
    }

    // Coerce dueDate / completedAt / paidDate strings to Date objects when present
    for (const dateField of ["dueDate", "resolvedAt", "sendDate", "nextContactDate"]) {
      if (safe[dateField] && typeof safe[dateField] === "string") {
        const d = new Date(safe[dateField]);
        if (!isNaN(d.getTime())) safe[dateField] = d;
      }
    }

    const { storage } = await import("../storage");
    const fn = (storage as any)[cfg.method];
    if (typeof fn !== "function") {
      return { ok: false, error: `update_entity: storage.${cfg.method} not available` };
    }
    const updated = await fn.call(storage, entityId, safe);
    if (!updated) return { ok: false, error: `update_entity: ${entityType} ${entityId} not found` };

    return { ok: true, output: { entityType, entityId, updatedFields: Object.keys(safe) } };
  } catch (err: any) {
    return { ok: false, error: err?.message || "update_entity failed" };
  }
}

/* ------------------------------------------------------------
 *  assign_user — auto-assign owner using round-robin / least-loaded / random / specific
 * ------------------------------------------------------------ */
const ASSIGN_RR_CURSOR: Map<string, number> = new Map();

const ASSIGN_TARGET_MAP: Record<string, { method: string; field: string }> = {
  task: { method: "updateTask", field: "assignedUserId" },
  customer: { method: "updateCustomer", field: "assignedUserId" },
  hospital: { method: "updateHospital", field: "responsiblePersonId" },
  clinic: { method: "updateClinic", field: "responsiblePersonId" },
};

async function actionAssignUser(config: any, ctx: any, runId: string): Promise<ActionResult> {
  try {
    const rendered = renderTemplate(config, ctx);
    const entityType: string = String(rendered.entityType || ctx.event?.entityType || "").trim();
    const entityId: string = String(rendered.entityId || ctx.event?.entityId || "").trim();
    const strategy: string = String(rendered.strategy || "round_robin").trim();

    const target = ASSIGN_TARGET_MAP[entityType];
    if (!target) return { ok: false, error: `assign_user: unsupported entityType "${entityType}" (allowed: ${Object.keys(ASSIGN_TARGET_MAP).join(", ")})` };
    if (!entityId) return { ok: false, error: "assign_user requires entityId" };

    const { storage } = await import("../storage");

    // Resolve candidate users
    let candidates: string[] = [];
    if (strategy === "specific") {
      const uid = String(rendered.userId || "").trim();
      if (!uid) return { ok: false, error: "assign_user(specific) requires userId" };
      candidates = [uid];
    } else {
      const explicit = Array.isArray(rendered.userIds)
        ? rendered.userIds.map((x: any) => String(x).trim()).filter(Boolean)
        : (typeof rendered.userIds === "string"
            ? rendered.userIds.split(",").map((s: string) => s.trim()).filter(Boolean)
            : []);
      if (explicit.length > 0) {
        candidates = explicit;
      } else {
        // Fallback: load all active users, optionally filter by role / country
        const allUsers: any[] = await (storage as any).getAllUsers();
        const roleFilter = rendered.roleFilter ? String(rendered.roleFilter).trim() : null;
        const countryFilter = rendered.countryFilter
          ? (Array.isArray(rendered.countryFilter)
              ? rendered.countryFilter.map((c: any) => String(c).trim().toUpperCase())
              : String(rendered.countryFilter).split(",").map((c: string) => c.trim().toUpperCase()).filter(Boolean))
          : null;
        candidates = allUsers
          .filter(u => u.isActive !== false)
          .filter(u => !roleFilter || u.role === roleFilter)
          .filter(u => {
            if (!countryFilter || countryFilter.length === 0) return true;
            const uc = Array.isArray(u.countries) ? u.countries : (u.country ? [u.country] : []);
            return uc.some((c: string) => countryFilter.includes(String(c).toUpperCase()));
          })
          .map(u => u.id);
      }
    }

    if (candidates.length === 0) {
      return { ok: false, error: "assign_user: no eligible users found" };
    }

    // Pick one
    let chosen: string;
    if (strategy === "specific" || candidates.length === 1) {
      chosen = candidates[0];
    } else if (strategy === "random") {
      chosen = candidates[Math.floor(Math.random() * candidates.length)];
    } else if (strategy === "least_loaded") {
      // Count open tasks per candidate (tasks where status not in completed/cancelled)
      const counts = await Promise.all(candidates.map(async (uid) => {
        try {
          const tasks: any[] = await (storage as any).getTasksByUser(uid);
          const open = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled").length;
          return { uid, open };
        } catch {
          return { uid, open: Number.MAX_SAFE_INTEGER };
        }
      }));
      counts.sort((a, b) => a.open - b.open);
      chosen = counts[0].uid;
    } else {
      // round_robin (default) — in-memory cursor keyed by ruleId + sorted candidates
      const key = `${ctx.rule?.id || "global"}:${[...candidates].sort().join(",")}`;
      const idx = (ASSIGN_RR_CURSOR.get(key) ?? -1) + 1;
      const next = idx % candidates.length;
      ASSIGN_RR_CURSOR.set(key, next);
      chosen = candidates[next];
    }

    // Apply update
    const fn = (storage as any)[target.method];
    if (typeof fn !== "function") {
      return { ok: false, error: `assign_user: storage.${target.method} not available` };
    }
    const updated = await fn.call(storage, entityId, { [target.field]: chosen });
    if (!updated) return { ok: false, error: `assign_user: ${entityType} ${entityId} not found` };

    return { ok: true, output: { entityType, entityId, strategy, assignedTo: chosen, candidatePool: candidates.length } };
  } catch (err: any) {
    return { ok: false, error: err?.message || "assign_user failed" };
  }
}

/* ------------------------------------------------------------
 *  add_tag / remove_tag — manipulate the tags[] column on supported entities
 * ------------------------------------------------------------ */
const TAG_TARGET_MAP: Record<string, { table: string }> = {
  task: { table: "tasks" },
  customer: { table: "customers" },
  hospital: { table: "hospitals" },
  clinic: { table: "clinics" },
};

function normalizeTagList(input: any): string[] {
  if (Array.isArray(input)) {
    return input.map(t => String(t).trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input.split(",").map(t => t.trim()).filter(Boolean);
  }
  return [];
}

async function actionTagMutation(
  config: any,
  ctx: any,
  mode: "add" | "remove",
): Promise<ActionResult> {
  try {
    const rendered = renderTemplate(config, ctx);
    const entityType: string = String(rendered.entityType || ctx.event?.entityType || "").trim();
    const entityId: string = String(rendered.entityId || ctx.event?.entityId || "").trim();
    const tags = normalizeTagList(rendered.tags ?? rendered.tag);

    const target = TAG_TARGET_MAP[entityType];
    if (!target) return { ok: false, error: `${mode}_tag: unsupported entityType "${entityType}" (allowed: ${Object.keys(TAG_TARGET_MAP).join(", ")})` };
    if (!entityId) return { ok: false, error: `${mode}_tag requires entityId` };
    if (tags.length === 0) return { ok: false, error: `${mode}_tag requires at least one tag` };

    const { pool } = await import("../db");
    const sqlText = mode === "add"
      ? `UPDATE ${target.table}
         SET tags = (
           SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(tags, ARRAY[]::text[]) || $2::text[]))
         )
         WHERE id = $1
         RETURNING tags`
      : `UPDATE ${target.table}
         SET tags = COALESCE(
           ARRAY(SELECT t FROM unnest(COALESCE(tags, ARRAY[]::text[])) AS t WHERE t <> ALL($2::text[])),
           ARRAY[]::text[]
         )
         WHERE id = $1
         RETURNING tags`;
    const result = await pool.query(sqlText, [entityId, tags]);
    if (result.rowCount === 0) {
      return { ok: false, error: `${mode}_tag: ${entityType} ${entityId} not found` };
    }
    return {
      ok: true,
      output: { entityType, entityId, mode, requested: tags, currentTags: result.rows[0].tags },
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || `${mode}_tag failed` };
  }
}

// Keep the public action policy in sync with the handlers that can actually run.
const ACTION_HANDLERS: Record<keyof typeof AUTOMATION_ACTION_POLICY, (cfg: any, ctx: any, runId: string) => Promise<ActionResult>> = {
  create_task: actionCreateTask,
  notify_user: actionNotifyUser,
  send_email: actionSendEmail,
  send_sms: actionSendSms,
  webhook: actionWebhook,
  update_entity: actionUpdateEntity,
  assign_user: actionAssignUser,
  add_tag: (cfg, ctx) => actionTagMutation(cfg, ctx, "add"),
  remove_tag: (cfg, ctx) => actionTagMutation(cfg, ctx, "remove"),
};

/* ------------------------------------------------------------
 *  Engine
 * ------------------------------------------------------------ */
async function findMatchingRules(event: WorkflowEvent, onlyRuleIds?: readonly string[]): Promise<WorkflowRule[]> {
  if (onlyRuleIds && onlyRuleIds.length === 0) return [];
  const all = await db
    .select()
    .from(workflowRules)
    .where(and(
      eq(workflowRules.enabled, true),
      eq(workflowRules.module, event.module),
      ...(onlyRuleIds ? [inArray(workflowRules.id, [...onlyRuleIds])] : []),
    ));
  return all.filter((rule) => {
    const t: any = rule.trigger || {};
    if (t.type === "event") {
      if (t.entityType && t.entityType !== event.entityType) return false;
      if (t.eventType && t.eventType !== event.eventType) return false;
      // Inbound services must fail closed on unknown queue country. Keep the
      // legacy matching behavior of unrelated modules unchanged.
      // A country-scoped rule must not run on an event without a verified country.
      if (!matchesRuleCountryScope(rule.countryCodes, rule.countryCode, event.countryCode)) return false;
      return true;
    }
    return false;
  });
}

type ScheduledCandidate = { id: string; countryCode: string; newValues: Record<string, unknown> };

function scheduleRuleError(rule: WorkflowRule): string | null {
  const issues = validateRuleCapabilities(rule);
  return issues.length ? issues[0].message : null;
}

const SCHEDULE_SCAN_PAGE_SIZE = 1000;
const SCHEDULE_MAX_DELIVERIES = 100;

function scheduleRecipients(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
  return typeof value === "string" ? value.split(/[,;\s]+/).map(item => item.trim()).filter(Boolean) : [];
}

function hasUnresolvedTemplate(value: unknown): boolean {
  if (typeof value === "string") return /\{\{\s*[^{}]+?\s*\}\}/.test(value);
  if (Array.isArray(value)) return value.some(hasUnresolvedTemplate);
  return !!value && typeof value === "object" && Object.values(value).some(hasUnresolvedTemplate);
}

function scheduledEvent(rule: WorkflowRule, candidate?: ScheduledCandidate, countryCode?: string): any {
  return {
    id: `schedule-${rule.id}-${candidate?.id || "once"}-${Date.now()}`,
    source: "schedule",
    module: rule.module,
    entityType: candidate ? rule.module : "schedule",
    entityId: candidate?.id ?? null,
    eventType: "schedule.tick",
    oldValues: null,
    newValues: candidate?.newValues || {},
    changedFields: null,
    actorUserId: null,
    countryCode: candidate?.countryCode || countryCode || null,
    causationRunId: null,
    createdAt: new Date(),
  };
}

/**
 * Resolve all recipient fanout before any action runs. Unknown/template-derived
 * fanout is rejected rather than allowing a partially delivered batch.
 */
async function countScheduledDeliveries(rule: WorkflowRule, candidates: ScheduledCandidate[], onceCountry?: string): Promise<number> {
  let total = 0;
  for (const candidate of candidates) {
    const event = scheduledEvent(rule, candidate, onceCountry);
    const ctx = {
      rule,
      event,
      newValues: event.newValues || {},
      oldValues: {},
      entityId: event.entityId,
      countryCode: event.countryCode,
      actorUserId: null,
    };
    for (const action of (rule.actions as any[]) || []) {
      if (!["send_email", "send_sms"].includes(action?.type)) continue;
      const config = action.config || {};
      const rendered = action.type === "send_email" && config.emailActionVersion === 2
        ? renderEmailAddressConfig(config, taskTemplateContext(ctx, config.templateLanguage))
        : renderTemplate(config, ctx);
      if (action.type === "send_sms") {
        const recipients = scheduleRecipients(rendered.to);
        if (recipients.length !== 1 || hasUnresolvedTemplate(recipients))
          throw new Error("Scheduled SMS recipient fanout cannot be safely determined");
        total++;
      } else {
        if (rendered.emailActionVersion === 2) {
          const resolved = await planAutomationEmailRecipients(rendered);
          total += resolved.count;
          if (total > SCHEDULE_MAX_DELIVERIES)
            throw new Error("Scheduled email exceeds the delivery safety limit; no actions were run");
          continue;
        }
        const grouped = rendered.taskGroupId || rendered.targetRole;
        let recipients: string[];
        if (grouped) {
          if (rendered.to) throw new Error("Scheduled email has conflicting recipients");
          const target = await resolveAutomationRecipientTarget(rendered);
          const rows = target.userIds.length
            ? await db.select({ email: users.email }).from(users).where(inArray(users.id, target.userIds))
            : [];
          if (rows.length !== target.userIds.length || rows.some(row => !row.email?.trim()))
            throw new Error("Scheduled email group membership cannot be safely resolved");
          recipients = [...new Set(rows.map(row => row.email!.trim()))];
        } else {
          recipients = scheduleRecipients(rendered.to);
          if (!recipients.length || hasUnresolvedTemplate(recipients))
            throw new Error("Scheduled email recipient fanout cannot be safely determined");
        }
        if (!recipients.length) throw new Error("Scheduled email has no recipients");
        const cc = scheduleRecipients(rendered.cc);
        const bcc = scheduleRecipients(rendered.bcc);
        if (hasUnresolvedTemplate(cc) || hasUnresolvedTemplate(bcc))
          throw new Error("Scheduled email recipient fanout cannot be safely determined");
        total += recipients.length * (1 + cc.length + bcc.length);
      }
      if (total > SCHEDULE_MAX_DELIVERIES)
        throw new Error(`Scheduled external deliveries exceed the ${SCHEDULE_MAX_DELIVERIES} delivery safety limit; no actions were run`);
    }
  }
  return total;
}

async function fetchScheduleRecords(module: string, offset: number): Promise<Array<{ id: string; countryCode: string | null; values: Record<string, unknown> }>> {
  // These projections deliberately enumerate only persisted, non-identity
  // fields. The limit is a hard scan bound: never execute against a partial
  // table scan when the bound is exceeded.
  if (module === "customer") {
    const rows = await db.select({
      id: customers.id, country: customers.country, status: customers.status,
      clientStatus: customers.clientStatus, leadScore: customers.leadScore, leadStatus: customers.leadStatus,
      registrationSource: customers.registrationSource,
      registrationDate: customers.registrationDate, createdAt: customers.createdAt,
    }).from(customers).orderBy(customers.id).limit(SCHEDULE_SCAN_PAGE_SIZE).offset(offset);
    return rows.map(({ id, country, ...values }) => ({ id, countryCode: country, values }));
  }
  if (module === "task") {
    const rows = await db.select({
      id: tasks.id, country: tasks.country, status: tasks.status, priority: tasks.priority,
      dueDate: tasks.dueDate, boState: tasks.boState, createdAt: tasks.createdAt, updatedAt: tasks.updatedAt,
    }).from(tasks).orderBy(tasks.id).limit(SCHEDULE_SCAN_PAGE_SIZE).offset(offset);
    return rows.map(({ id, country, ...values }) => ({ id, countryCode: country, values }));
  }
  if (module === "hospital") {
    const rows = await db.select({
      id: hospitals.id, countryCode: hospitals.countryCode, isActive: hospitals.isActive,
      region: hospitals.region, district: hospitals.district, autoRecruiting: hospitals.autoRecruiting,
      svetZdravia: hospitals.svetZdravia,
    }).from(hospitals).orderBy(hospitals.id).limit(SCHEDULE_SCAN_PAGE_SIZE).offset(offset);
    return rows.map(({ id, countryCode, ...values }) => ({ id, countryCode, values }));
  }
  if (module === "clinic") {
    const rows = await db.select({
      id: clinics.id, countryCode: clinics.countryCode, isActive: clinics.isActive,
      contractStatus: clinics.contractStatus, leadSource: clinics.leadSource,
      leadSourceDate: clinics.leadSourceDate, conferenceDate: clinics.conferenceDate,
      isReferredByDoctor: clinics.isReferredByDoctor, isFromConference: clinics.isFromConference,
      initialStatus: clinics.initialStatus, interestCooperation: clinics.interestCooperation,
      interestContract: clinics.interestContract, hasFlyers: clinics.hasFlyers,
      flyersSentDate: clinics.flyersSentDate,
    }).from(clinics).orderBy(clinics.id).limit(SCHEDULE_SCAN_PAGE_SIZE).offset(offset);
    return rows.map(({ id, countryCode, ...values }) => ({ id, countryCode, values }));
  }
  throw new Error(`No verified schedule record source for module: ${module}`);
}

/**
 * The shared, bounded matcher used by runtime execution and schedule-preview.
 * It scans every candidate up to a hard row ceiling before reporting matches;
 * if that ceiling is crossed, callers fail closed rather than acting on a
 * potentially incomplete result.
 */
export async function scanScheduledRule(rule: WorkflowRule): Promise<{
  candidates: ScheduledCandidate[];
  matchedCount: number;
  overLimit: boolean;
  maxMatches: number;
}> {
  const invalid = scheduleRuleError(rule);
  if (invalid) throw new Error(invalid);
  const trigger = rule.trigger as any;
  const mode = trigger?.mode ?? "once";
  if (mode === "once") {
    return { candidates: [], matchedCount: 1, overLimit: false, maxMatches: SCHEDULE_MAX_MATCHES };
  }
  if (mode !== "per_record" || !SCHEDULE_RECORD_MODULES.includes(rule.module as any))
    throw new Error("No verified schedule record source for module");

  const candidates: ScheduledCandidate[] = [];
  let matchedCount = 0;
  const countryCodes = new Set<string>(COUNTRIES.map(country => country.code));
  const allowedFields = fieldsForEvent(rule.module, "schedule.tick");
  for (let offset = 0; offset <= SCHEDULE_MAX_SCAN_ROWS; offset += SCHEDULE_SCAN_PAGE_SIZE) {
    const records = await fetchScheduleRecords(rule.module, offset);
    if (offset + records.length > SCHEDULE_MAX_SCAN_ROWS)
      throw new Error(`Schedule scan exceeds the ${SCHEDULE_MAX_SCAN_ROWS} record safety limit`);
    for (const record of records) {
      const countryCode = typeof record.countryCode === "string" ? record.countryCode.toUpperCase() : "";
      // Schedule runs always require an unambiguous persisted operating country,
      // including globally scoped rules.
      if (!countryCodes.has(countryCode) || !matchesRuleCountryScope(
        rule.countryCodes, rule.countryCode, countryCode,
      )) continue;
      const newValues: Record<string, unknown> = {};
      for (const field of allowedFields) {
        const key = field.value.replace(/^newValues\./, "");
        if (key === "country" || key === "countryCode") newValues[key] = countryCode;
        else if (Object.hasOwn(record.values, key)) newValues[key] = record.values[key];
      }
      const event = {
        id: `schedule-preview-${rule.id}-${record.id}`,
        source: "schedule",
        module: rule.module,
        entityType: rule.module,
        entityId: record.id,
        eventType: "schedule.tick",
        oldValues: null,
        newValues,
        changedFields: null,
        actorUserId: null,
        countryCode,
        causationRunId: null,
        createdAt: new Date(),
      } as any;
      const ctx = { event, newValues, oldValues: {}, entityId: record.id, countryCode, actorUserId: null };
      if (!evalCondition(rule.conditions as any, ctx)) continue;
      matchedCount++;
      if (candidates.length < SCHEDULE_MAX_MATCHES + 1)
        candidates.push({ id: record.id, countryCode, newValues });
    }
    if (records.length < SCHEDULE_SCAN_PAGE_SIZE) break;
  }
  return {
    candidates,
    matchedCount: Math.min(matchedCount, SCHEDULE_MAX_MATCHES),
    overLimit: matchedCount > SCHEDULE_MAX_MATCHES,
    maxMatches: SCHEDULE_MAX_MATCHES,
  };
}

function oneShotCountry(rule: WorkflowRule): string | null {
  const selected = rule.countryCodes != null
    ? rule.countryCodes
    : rule.countryCode ? [rule.countryCode] : [];
  return selected.length === 1 ? selected[0] : null;
}

/** Used by the cron driver after the durable interval claim has been acquired. */
export async function runScheduledRule(rule: WorkflowRule): Promise<void> {
  try {
    const [current] = await db.select().from(workflowRules).where(eq(workflowRules.id, rule.id));
    if (!current?.enabled || (current.trigger as any)?.type !== "schedule" ||
        !(await scheduleRuleVersionMatches(rule, current.updatedAt))) return;
    rule = Object.assign(current, { _scheduleVersion: (rule as any)._scheduleVersion });
    const mode = ((rule.trigger as any)?.mode ?? "once") as string;
    const scan = await scanScheduledRule(rule);
    if (scan.overLimit) throw new Error(`Schedule has more than ${SCHEDULE_MAX_MATCHES} matches; no actions were run`);
    if (mode === "once") {
      const countryCode = oneShotCountry(rule);
      const providerAction = ((rule.actions as any[]) || []).some(action =>
        ["send_email", "send_sms"].includes(action?.type));
      if (providerAction && !countryCode)
        throw new Error("One-shot email/SMS schedules require exactly one selected country");
      await countScheduledDeliveries(rule, [{ id: "", countryCode: countryCode || "", newValues: {} }], countryCode || undefined);
      const [beforeRun] = await db.select().from(workflowRules).where(eq(workflowRules.id, rule.id));
      if (!beforeRun?.enabled || !(await scheduleRuleVersionMatches(rule, beforeRun.updatedAt))) return;
      const event = scheduledEvent(rule, undefined, countryCode || undefined);
      await runRule(rule, event, []);
      return;
    }
    await countScheduledDeliveries(rule, scan.candidates);
    // scanScheduledRule completed the entire bounded scan before this loop.
    for (const candidate of scan.candidates) {
      const [latest] = await db.select().from(workflowRules).where(eq(workflowRules.id, rule.id));
      if (!latest?.enabled || (latest.trigger as any)?.type !== "schedule" ||
          !(await scheduleRuleVersionMatches(rule, latest.updatedAt))) break;
      const event = scheduledEvent(rule, candidate);
      await runRule(rule, event, []);
    }
  } catch (err) {
    console.error(`[Automation] Scheduled rule execution failed rule=${rule.id}`);
    // A claimed interval is deliberately not retried after an ambiguous
    // failure. Surface the failure in run history without storing recipients,
    // record values, or vendor error text.
    await db.insert(workflowRuns).values({
      ruleId: rule.id,
      status: "failed",
      error: "Scheduled execution did not complete. Check the rule preview, recipient limit, and country mailbox.",
      payload: { source: "schedule", interval: (rule.trigger as any)?.interval },
      finishedAt: new Date(),
    }).catch(() => console.error(`[Automation] Could not record scheduled failure rule=${rule.id}`));
  }
}

export async function getEnabledScheduleRules(): Promise<WorkflowRule[]> {
  const all = await db.select().from(workflowRules).where(eq(workflowRules.enabled, true));
  const schedules = all.filter((r) => {
    const t: any = r.trigger || {};
    return t.type === "schedule";
  });
  return Promise.all(schedules.map(async rule => Object.assign(rule, {
    _scheduleVersion: await getExactScheduleVersion(rule.id),
  })));
}

async function getExactScheduleVersion(id: string): Promise<string | null> {
  const [row] = await db.select({
    version: sql<string>`to_char(${workflowRules.updatedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US')`,
  }).from(workflowRules).where(eq(workflowRules.id, id));
  return row?.version || null;
}

async function scheduleRuleVersionMatches(rule: WorkflowRule, updatedAt: Date): Promise<boolean> {
  const expected = (rule as any)._scheduleVersion as string | undefined;
  if (expected) return expected === await getExactScheduleVersion(rule.id);
  // Compatibility for direct callers/tests that pass a rule without the
  // precision-preserving version fetched by getEnabledScheduleRules().
  return new Date(updatedAt).getTime() === new Date(rule.updatedAt).getTime();
}

/**
 * Durably claim one due schedule interval. The first observation (including
 * after a restart) only establishes next_due_at; a later tick can claim it.
 * The claim advances the due time atomically before side effects start, so a
 * crashed/ambiguous execution is not automatically retried.
 */
export async function claimScheduledRuleDue(rule: WorkflowRule, intervalMs: number): Promise<boolean> {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) return false;
  const interval = String((rule.trigger as any)?.interval ?? "");
  const scheduleVersion = (rule as any)._scheduleVersion as string | undefined;
  const versionPredicate = scheduleVersion
    ? sql`to_char(${workflowRules.updatedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') = ${scheduleVersion}`
    : sql`date_trunc('milliseconds', ${workflowRules.updatedAt}) = date_trunc('milliseconds', ${rule.updatedAt}::timestamptz)`;

  // Initialize on first observation, interval edits, and re-enable. Use the
  // database clock so workers with skewed host clocks agree on due-ness.
  await db
    .update(workflowRules)
    .set({
      scheduleInterval: interval,
      scheduleNextDueAt: sql`clock_timestamp() + (${intervalMs} * interval '1 millisecond')`,
    })
    .where(sql`
      ${workflowRules.id} = ${rule.id}
      AND ${workflowRules.enabled} = true
      AND ${workflowRules.trigger}->>'type' = 'schedule'
      AND ${workflowRules.trigger}->>'interval' = ${interval}
      AND ${versionPredicate}
      AND (
        ${workflowRules.scheduleInterval} IS DISTINCT FROM ${interval}
        OR ${workflowRules.scheduleNextDueAt} IS NULL
      )
    `);

  const claimed = await db
    .update(workflowRules)
    .set({
      scheduleNextDueAt: sql`clock_timestamp() + (${intervalMs} * interval '1 millisecond')`,
    })
    .where(sql`
      ${workflowRules.id} = ${rule.id}
      AND ${workflowRules.enabled} = true
      AND ${workflowRules.trigger}->>'type' = 'schedule'
      AND ${workflowRules.trigger}->>'interval' = ${interval}
      AND ${versionPredicate}
      AND ${workflowRules.scheduleInterval} = ${interval}
      AND ${workflowRules.scheduleNextDueAt} <= clock_timestamp()
    `)
    .returning({ id: workflowRules.id });
  return claimed.length > 0;
}

async function rateLimitOk(rule: WorkflowRule): Promise<boolean> {
  if (!rule.rateLimitPerHour || rule.rateLimitPerHour <= 0) return true;
  const since = new Date(Date.now() - 3600_000);
  const rows = await db
    .select({ id: workflowRuns.id })
    .from(workflowRuns)
    .where(and(eq(workflowRuns.ruleId, rule.id), gte(workflowRuns.startedAt, since)));
  return rows.length < rule.rateLimitPerHour;
}

export async function runRule(
  rule: WorkflowRule,
  event: WorkflowEvent,
  causationChain: string[]
): Promise<void> {
  const scheduled = event.source === "schedule";
  const ctx = {
    rule,
    event,
    newValues: event.newValues || {},
    oldValues: event.oldValues || {},
    entityId: event.entityId,
    countryCode: event.countryCode,
    actorUserId: event.actorUserId,
  };

  // Skip if conditions not met
  if (!taskAssignmentTriggerMatches(rule.trigger, ctx.newValues) || !permitsSentimentSource(rule.conditions, event) || !evalCondition(rule.conditions as any, ctx)) {
    await db.insert(workflowRuns).values({
      ruleId: rule.id,
      eventId: event.id,
      status: "skipped",
      skippedReason: "condition_false",
      payload: scheduled ? { source: "schedule", module: event.module, entityType: event.entityType,
        entityId: event.entityId, eventType: event.eventType, newValues: event.newValues, countryCode: event.countryCode } : ctx,
      causationChain,
      finishedAt: new Date(),
    });
    return;
  }

  // Loop guard
  if (causationChain.length >= MAX_CAUSATION_DEPTH) {
    await db.insert(workflowRuns).values({
      ruleId: rule.id,
      eventId: event.id,
      status: "skipped",
      skippedReason: "loop_guard",
      payload: scheduled ? { source: "schedule", module: event.module, entityType: event.entityType,
        entityId: event.entityId, eventType: event.eventType, newValues: event.newValues, countryCode: event.countryCode } : ctx,
      causationChain,
      finishedAt: new Date(),
    });
    return;
  }

  // Rate limit
  if (!(await rateLimitOk(rule))) {
    await db.insert(workflowRuns).values({
      ruleId: rule.id,
      eventId: event.id,
      status: "skipped",
      skippedReason: "rate_limit",
      payload: scheduled ? { source: "schedule", module: event.module, entityType: event.entityType,
        entityId: event.entityId, eventType: event.eventType, newValues: event.newValues, countryCode: event.countryCode } : ctx,
      causationChain,
      finishedAt: new Date(),
    });
    return;
  }

  const [run] = await db
    .insert(workflowRuns)
    .values({
      ruleId: rule.id, eventId: scheduled ? null : event.id, status: "running",
      payload: scheduled ? { source: "schedule", module: event.module, entityType: event.entityType,
        entityId: event.entityId, eventType: event.eventType, newValues: event.newValues, countryCode: event.countryCode } : ctx,
      causationChain,
    })
    .returning();
  if (!run) return;

  const actions = (rule.actions as any[]) || [];
  const results: any[] = [];
  let overallOk = true;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const handler = ACTION_HANDLERS[action.type];
    if (!handler) {
      const res = { ok: false, error: `Unknown action type: ${action.type}` };
      results.push({ index: i, type: action.type, ...res });
      await db.insert(workflowActionLog).values({
        runId: run.id,
        actionIndex: i,
        actionType: action.type,
        status: "failed",
        error: res.error,
      });
      overallOk = false;
      continue;
    }
    try {
      const r = await handler(action.config || {}, ctx, run.id);
      results.push(scheduled
        ? { index: i, type: action.type, ok: r.ok }
        : { index: i, type: action.type, ...r });
      await db.insert(workflowActionLog).values({
        runId: run.id,
        actionIndex: i,
        actionType: action.type,
        status: r.ok ? "success" : "failed",
        output: scheduled ? null : r.output ?? null,
        error: scheduled ? (r.ok ? null : "Scheduled action failed") : r.error ?? null,
      });
      if (!r.ok) overallOk = false;
    } catch (err: any) {
      results.push(scheduled
        ? { index: i, type: action.type, ok: false, error: "Scheduled action failed" }
        : { index: i, type: action.type, ok: false, error: err?.message });
      await db.insert(workflowActionLog).values({
        runId: run.id,
        actionIndex: i,
        actionType: action.type,
        status: "failed",
        error: scheduled ? "Scheduled action failed" : err?.message || "Handler threw",
      });
      overallOk = false;
    }
  }

  await db
    .update(workflowRuns)
    .set({
      status: overallOk ? "success" : "failed",
      actionResults: results,
      finishedAt: new Date(),
    })
    .where(eq(workflowRuns.id, run.id));

  // Track consecutive errors → auto-disable when threshold reached.
  // Use atomic SQL increment + RETURNING to be safe against concurrent runs of the same rule.
  try {
    if (overallOk) {
      // Reset counter only if it's not already 0 (cheap fast path keeps row untouched).
      if ((rule as any).consecutiveErrorCount && (rule as any).consecutiveErrorCount > 0) {
        await db
          .update(workflowRules)
          .set({
            consecutiveErrorCount: 0,
            lastErrorMessage: null,
            ...(scheduled ? {} : { updatedAt: new Date() }),
          })
          .where(eq(workflowRules.id, rule.id));
      }
    } else {
      const firstError =
        results.find((r) => r.error)?.error ||
        results.find((r) => !r.ok)?.error ||
        "Unknown error";
      const truncated = String(firstError).slice(0, 1000);

      // Atomic increment: postgres adds 1 even if other workers already bumped the counter.
      const [updated] = await db
        .update(workflowRules)
        .set({
          consecutiveErrorCount: sql`${workflowRules.consecutiveErrorCount} + 1`,
          lastErrorAt: new Date(),
          lastErrorMessage: truncated,
          ...(scheduled ? {} : { updatedAt: new Date() }),
        })
        .where(eq(workflowRules.id, rule.id))
        .returning({
          newCount: workflowRules.consecutiveErrorCount,
          enabled: workflowRules.enabled,
          threshold: workflowRules.autoDisableThreshold,
        });

      if (
        updated &&
        updated.enabled &&
        updated.threshold > 0 &&
        updated.newCount >= updated.threshold
      ) {
        await db
          .update(workflowRules)
          .set({
            enabled: false,
            disabledReason: `Auto-disabled po ${updated.newCount} po sebe idúcich chybách. Posledná: ${String(firstError).slice(0, 200)}`,
            scheduleNextDueAt: null,
            updatedAt: new Date(),
          })
          .where(and(eq(workflowRules.id, rule.id), eq(workflowRules.enabled, true)));
        console.warn(
          `[Automation] Rule ${rule.id} (${rule.name}) AUTO-DISABLED after ${updated.newCount} consecutive failures`,
        );
      }
    }
  } catch (err) {
    console.error(`[Automation] error tracking update failed for rule=${rule.id}:`, err);
  }
}

export async function processEvent(eventId: string, onlyRuleIds?: readonly string[]): Promise<void> {
  const [event] = await db.select().from(workflowEvents).where(eq(workflowEvents.id, eventId));
  if (!event) return;
  if (event.source === "status-list" || event.module === "status_list") return;
  const rules = await findMatchingRules(event, onlyRuleIds);
  if (!rules.length) return;
  const baseChain = event.causationRunId ? [event.causationRunId] : [];
  for (const rule of rules) {
    try {
      await runRule(rule, event, baseChain);
    } catch (err) {
      console.error(`[Automation] runRule error rule=${rule.id} event=${event.id}:`, err);
    }
  }
}

export function initAutomationEngine() {
  setEventDispatcher(async (eventId: string) => {
    await processEvent(eventId);
  });
  console.log("[Automation] Engine initialized");
}

/** Manual / dry-run helper used by API */
export async function dryRunRule(rule: WorkflowRule, sampleEvent: Partial<WorkflowEvent>) {
  const event = {
    id: "dry-run",
    source: "manual",
    module: rule.module,
    entityType: (sampleEvent.entityType as string) || rule.module,
    entityId: sampleEvent.entityId || null,
    eventType: sampleEvent.eventType || "updated",
    oldValues: sampleEvent.oldValues || null,
    newValues: sampleEvent.newValues || null,
    changedFields: null,
    actorUserId: sampleEvent.actorUserId || null,
    countryCode: sampleEvent.countryCode || null,
    causationRunId: null,
    createdAt: new Date(),
  } as any;
  const ctx = {
    event,
    newValues: event.newValues || {},
    oldValues: event.oldValues || {},
    entityId: event.entityId,
    countryCode: event.countryCode,
    actorUserId: event.actorUserId,
  };
  const conditionMet = taskAssignmentTriggerMatches(rule.trigger, ctx.newValues) && evalCondition(rule.conditions as any, ctx);
  const renderedActions = (rule.actions as any[]).map((a) => ({
    type: a.type,
    rendered: renderTemplate(a.config || {}, ctx),
  }));
  return { conditionMet, ctx, actions: renderedActions };
}
