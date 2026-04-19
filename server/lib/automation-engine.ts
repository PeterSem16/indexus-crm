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

async function actionSendEmail(config: any, ctx: any): Promise<ActionResult> {
  try {
    const rendered = renderTemplate(config, ctx);
    const to = rendered.to;
    if (!to) return { ok: false, error: "send_email requires `to`" };
    // MVP: log-only sender. Wire to real email infra later.
    console.log(
      `[Automation] send_email to=${to} subject="${rendered.subject || ""}" body="${(rendered.body || "").substring(0, 80)}"`
    );
    return { ok: true, output: { to, subject: rendered.subject } };
  } catch (err: any) {
    return { ok: false, error: err?.message || "send_email failed" };
  }
}

const ACTION_HANDLERS: Record<string, (cfg: any, ctx: any, runId: string) => Promise<ActionResult>> = {
  create_task: actionCreateTask,
  notify_user: actionNotifyUser,
  send_email: actionSendEmail,
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
