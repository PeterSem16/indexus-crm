import { db } from "../db";
import { eq, and, gte, sql } from "drizzle-orm";
import {
  workflowRules,
  workflowEvents,
  workflowRuns,
  workflowActionLog,
  tasks,
  taskSubscriptions,
  taskChecklistItems,
  type WorkflowRule,
  type WorkflowEvent,
} from "@shared/schema";
import { setEventDispatcher } from "./event-bus";
import { sendEmail as sendEmailViaProvider } from "../email";
import { storage } from "../storage";
import {
  getValidAccessToken as getMs365ValidToken,
  sendEmail as ms365SendEmail,
} from "./ms365";

const MAX_CAUSATION_DEPTH = 5;

/* ============================================================
 *  Template engine — {{path.to.field}} substitution
 * ============================================================ */
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

/* ============================================================
 *  Condition DSL evaluator
 * ============================================================ */
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
  switch (c.op) {
    case "eq": return v === c.value;
    case "neq": return v !== c.value;
    case "gt": return Number(v) > Number(c.value);
    case "gte": return Number(v) >= Number(c.value);
    case "lt": return Number(v) < Number(c.value);
    case "lte": return Number(v) <= Number(c.value);
    case "in": return Array.isArray(c.value) && c.value.includes(v);
    case "not_in": return Array.isArray(c.value) && !c.value.includes(v);
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
      return oldV !== v && v === c.value;
    }
    case "changed_from": {
      const oldV = getPath(ctx, c.field.replace(/^newValues\./, "oldValues."));
      return oldV !== v && oldV === c.value;
    }
    default:
      console.warn(`[Automation] Unknown operator: ${c.op}`);
      return false;
  }
}

/* ============================================================
 *  Action handlers
 * ============================================================ */
type ActionResult = { ok: boolean; output?: any; error?: string };

async function actionCreateTask(config: any, ctx: any, runId: string): Promise<ActionResult> {
  try {
    const rendered = renderTemplate(config, ctx);
    const assignedUserId = rendered.assignedUserId || rendered.assignee_user_id || null;
    const assignedDepartmentId = rendered.assignedDepartmentId || rendered.assignee_department_id || null;
    if (!assignedUserId && !assignedDepartmentId) {
      return { ok: false, error: "create_task requires assignedUserId or assignedDepartmentId" };
    }
    const dueInHours = Number(rendered.dueInHours || 0);
    const dueDate = dueInHours > 0 ? new Date(Date.now() + dueInHours * 3600_000) : null;

    const [task] = await db
      .insert(tasks)
      .values({
        title: String(rendered.title || "Automation task"),
        description: rendered.description || null,
        priority: rendered.priority || "medium",
        status: "pending",
        assignedUserId: assignedUserId || rendered.assignee_user_id || "system",
        assignedDepartmentId: assignedDepartmentId || null,
        createdByUserId: rendered.createdByUserId || ctx.event?.actorUserId || "system",
        customerId: rendered.customerId || ctx.event?.entityType === "customer" ? ctx.event?.entityId : null,
        relatedEntityType: rendered.relatedEntityType || ctx.event?.entityType || null,
        relatedEntityId: rendered.relatedEntityId || ctx.event?.entityId || null,
        country: rendered.country || ctx.event?.countryCode || null,
        dueDate,
        sourceRunId: runId,
      })
      .returning();
    if (!task) return { ok: false, error: "Insert returned no row" };

    // Checklist
    if (Array.isArray(rendered.checklist) && rendered.checklist.length) {
      const items = rendered.checklist.map((it: any, idx: number) => ({
        taskId: task.id,
        position: idx,
        label: typeof it === "string" ? it : String(it.label || ""),
        required: typeof it === "object" ? it.required !== false : true,
      }));
      await db.insert(taskChecklistItems).values(items);
    }

    // Subscriptions: creator + assignee
    const subs: any[] = [];
    const creatorId = rendered.createdByUserId || ctx.event?.actorUserId;
    if (creatorId) subs.push({ taskId: task.id, userId: creatorId, role: "creator", notifyOn: ["completed", "overdue"] });
    if (assignedUserId && assignedUserId !== creatorId) {
      subs.push({ taskId: task.id, userId: assignedUserId, role: "assignee", notifyOn: ["overdue"] });
    }
    if (subs.length) await db.insert(taskSubscriptions).values(subs);

    return { ok: true, output: { taskId: task.id, title: task.title } };
  } catch (err: any) {
    return { ok: false, error: err?.message || "create_task failed" };
  }
}

async function actionNotifyUser(config: any, ctx: any): Promise<ActionResult> {
  try {
    const rendered = renderTemplate(config, ctx);
    const userIds: string[] = Array.isArray(rendered.userIds)
      ? rendered.userIds
      : rendered.userId
      ? [rendered.userId]
      : [];
    if (!userIds.length) return { ok: false, error: "notify_user requires userId or userIds" };

    const { notificationService } = await import("./notification-service");
    await notificationService.sendNotificationToUsers(userIds, {
      type: rendered.type || "automation",
      title: String(rendered.title || "Notification"),
      message: rendered.message || "",
      priority: rendered.priority || "normal",
      entityType: rendered.entityType || ctx.event?.entityType,
      entityId: rendered.entityId || ctx.event?.entityId,
      countryCode: rendered.countryCode || ctx.event?.countryCode,
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
            console.warn("[Automation] template attachment load failed:", (e as any)?.message);
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
    console.warn("[Automation] applyMessageTemplate failed:", (err as any)?.message);
    return config;
  }
}

async function actionSendEmail(config: any, ctx: any): Promise<ActionResult> {
  try {
    config = await applyMessageTemplate(config, "email");
    const rendered = renderTemplate(config, ctx);
    const toRaw = rendered.to;
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
    const from = rendered.from ? String(rendered.from).trim() : undefined;

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
    const countryCode: string | undefined =
      (rendered.countryCode as string) ||
      ctx.event?.countryCode ||
      undefined;
    let ms365Conn: any = null;
    if (countryCode) {
      try {
        ms365Conn = await storage.getSystemMs365Connection(countryCode);
      } catch {}
    }

    if (ms365Conn?.accessToken) {
      try {
        const tokenInfo = await getMs365ValidToken(
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
        // Fall through to SendGrid below
        console.warn("[Automation] MS365 send failed, falling back:", err?.message);
      }
    }

    if (provider === "log") {
      provider = process.env.SENDGRID_API_KEY ? "sendgrid" : "log";
      for (const to of recipients) {
        const ok = await sendEmailViaProvider({ to, subject, html, from });
        if (ok) sent.push(to);
        else failed.push(to);
      }
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
    return { ok: false, error: err?.message || "send_email failed" };
  }
}

async function actionSendSms(config: any, ctx: any): Promise<ActionResult> {
  try {
    config = await applyMessageTemplate(config, "sms");
    const rendered = renderTemplate(config, ctx);
    const to: string = String(rendered.to || "").trim();
    const text: string = String(rendered.text || rendered.message || "").trim();
    if (!to) return { ok: false, error: "send_sms requires `to` (phone number)" };
    if (!text) return { ok: false, error: "send_sms requires `text`" };

    const promotional = rendered.kind === "promotional" || rendered.promotional === true;
    const country: string | undefined =
      rendered.country || ctx.event?.countryCode || undefined;

    const { sendTransactionalSms, sendPromotionalSms } = await import("./bulkgate");
    const send = promotional ? sendPromotionalSms : sendTransactionalSms;
    const result = await send({
      number: to,
      text,
      country,
      unicode: rendered.unicode === true,
      tag: rendered.tag || `automation-rule`,
    });

    if (!result.success) {
      return { ok: false, error: result.error || "send_sms failed", output: { errorCode: result.errorCode } };
    }
    return { ok: true, output: { smsId: result.smsId, number: result.number, kind: promotional ? "promotional" : "transactional" } };
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

/* ============================================================
 *  assign_user — auto-assign owner using round-robin / least-loaded / random / specific
 * ============================================================ */
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

const ACTION_HANDLERS: Record<string, (cfg: any, ctx: any, runId: string) => Promise<ActionResult>> = {
  create_task: actionCreateTask,
  notify_user: actionNotifyUser,
  send_email: actionSendEmail,
  send_sms: actionSendSms,
  webhook: actionWebhook,
  update_entity: actionUpdateEntity,
  assign_user: actionAssignUser,
};

/* ============================================================
 *  Engine
 * ============================================================ */
async function findMatchingRules(event: WorkflowEvent): Promise<WorkflowRule[]> {
  const all = await db
    .select()
    .from(workflowRules)
    .where(and(eq(workflowRules.enabled, true), eq(workflowRules.module, event.module)));
  return all.filter((rule) => {
    const t: any = rule.trigger || {};
    if (t.type === "event") {
      if (t.entityType && t.entityType !== event.entityType) return false;
      if (t.eventType && t.eventType !== event.eventType) return false;
      if (rule.countryCode && event.countryCode && rule.countryCode !== event.countryCode) return false;
      return true;
    }
    return false;
  });
}

/** Used by the cron driver in alert-evaluator to fire schedule-triggered rules. */
export async function runScheduledRule(rule: WorkflowRule): Promise<void> {
  const syntheticEvent = {
    id: `schedule-${rule.id}-${Date.now()}`,
    source: "cron",
    module: rule.module,
    entityType: "schedule",
    entityId: rule.id,
    eventType: "schedule.tick",
    oldValues: null,
    newValues: { firedAt: new Date().toISOString(), trigger: rule.trigger },
    changedFields: null,
    actorUserId: null,
    countryCode: rule.countryCode,
    causationRunId: null,
    createdAt: new Date(),
  } as any;
  try {
    await runRule(rule, syntheticEvent, []);
  } catch (err) {
    console.error(`[Automation] runScheduledRule error rule=${rule.id}:`, err);
  }
}

export async function getEnabledScheduleRules(): Promise<WorkflowRule[]> {
  const all = await db.select().from(workflowRules).where(eq(workflowRules.enabled, true));
  return all.filter((r) => {
    const t: any = r.trigger || {};
    return t.type === "schedule";
  });
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

async function runRule(
  rule: WorkflowRule,
  event: WorkflowEvent,
  causationChain: string[]
): Promise<void> {
  const ctx = {
    event,
    newValues: event.newValues || {},
    oldValues: event.oldValues || {},
    entityId: event.entityId,
    countryCode: event.countryCode,
    actorUserId: event.actorUserId,
  };

  // Skip if conditions not met
  if (!evalCondition(rule.conditions as any, ctx)) {
    await db.insert(workflowRuns).values({
      ruleId: rule.id,
      eventId: event.id,
      status: "skipped",
      skippedReason: "condition_false",
      payload: ctx,
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
      payload: ctx,
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
      payload: ctx,
      causationChain,
      finishedAt: new Date(),
    });
    return;
  }

  const [run] = await db
    .insert(workflowRuns)
    .values({ ruleId: rule.id, eventId: event.id, status: "running", payload: ctx, causationChain })
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
      results.push({ index: i, type: action.type, ...r });
      await db.insert(workflowActionLog).values({
        runId: run.id,
        actionIndex: i,
        actionType: action.type,
        status: r.ok ? "success" : "failed",
        output: r.output ?? null,
        error: r.error ?? null,
      });
      if (!r.ok) overallOk = false;
    } catch (err: any) {
      results.push({ index: i, type: action.type, ok: false, error: err?.message });
      await db.insert(workflowActionLog).values({
        runId: run.id,
        actionIndex: i,
        actionType: action.type,
        status: "failed",
        error: err?.message || "Handler threw",
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
}

export async function processEvent(eventId: string): Promise<void> {
  const [event] = await db.select().from(workflowEvents).where(eq(workflowEvents.id, eventId));
  if (!event) return;
  const rules = await findMatchingRules(event);
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
  const conditionMet = evalCondition(rule.conditions as any, ctx);
  const renderedActions = (rule.actions as any[]).map((a) => ({
    type: a.type,
    rendered: renderTemplate(a.config || {}, ctx),
  }));
  return { conditionMet, ctx, actions: renderedActions };
}
