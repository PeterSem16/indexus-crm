import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { eq, desc, and } from "drizzle-orm";
import {
  workflowRules,
  workflowRuns,
  workflowActionLog,
  workflowEvents,
  insertWorkflowRuleSchema,
} from "@shared/schema";
import { processEvent, dryRunRule } from "./automation-engine";
import { emitEvent } from "./event-bus";

function getSessionUser(req: Request): { id: string; role?: string } | null {
  // @ts-ignore — session shape from existing middleware
  const u = req.session?.user;
  return u && u.id ? u : null;
}
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!getSessionUser(req)) return res.status(401).json({ error: "Unauthorized" });
  next();
}
function requireAutomationAdmin(req: Request, res: Response, next: NextFunction) {
  const u = getSessionUser(req);
  if (!u) return res.status(401).json({ error: "Unauthorized" });
  const role = (u.role || "").toLowerCase();
  if (!["admin", "superadmin", "owner"].includes(role)) {
    return res.status(403).json({ error: "Admin role required to manage automation rules" });
  }
  next();
}

export function registerAutomationRoutes(app: Express) {
  /* -------- RULES CRUD -------- */
  app.get("/api/automation/rules", requireAuth, async (req, res) => {
    const module = req.query.module as string | undefined;
    const country = req.query.country as string | undefined;
    let q = db.select().from(workflowRules).$dynamic();
    const where: any[] = [];
    if (module) where.push(eq(workflowRules.module, module));
    if (country) where.push(eq(workflowRules.countryCode, country));
    if (where.length) q = q.where(and(...where));
    const rows = await q.orderBy(desc(workflowRules.updatedAt));
    res.json(rows);
  });

  app.get("/api/automation/rules/:id", requireAuth, async (req, res) => {
    const [row] = await db.select().from(workflowRules).where(eq(workflowRules.id, req.params.id));
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  });

  app.post("/api/automation/rules", requireAutomationAdmin, async (req, res) => {
    const parsed = insertWorkflowRuleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid", details: parsed.error.errors });
    const userId = getSessionUser(req)!.id;
    const [row] = await db
      .insert(workflowRules)
      .values({ ...parsed.data, createdByUserId: userId })
      .returning();
    res.json(row);
  });

  app.patch("/api/automation/rules/:id", requireAutomationAdmin, async (req, res) => {
    const partial = insertWorkflowRuleSchema.partial().safeParse(req.body);
    if (!partial.success) return res.status(400).json({ error: "Invalid", details: partial.error.errors });
    const [row] = await db
      .update(workflowRules)
      .set({ ...partial.data, updatedAt: new Date() })
      .where(eq(workflowRules.id, req.params.id))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  });

  app.delete("/api/automation/rules/:id", requireAutomationAdmin, async (req, res) => {
    const [row] = await db
      .select({ isSystem: workflowRules.isSystem })
      .from(workflowRules)
      .where(eq(workflowRules.id, req.params.id));
    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.isSystem) return res.status(403).json({ error: "Cannot delete system rule" });
    await db.delete(workflowRules).where(eq(workflowRules.id, req.params.id));
    res.json({ ok: true });
  });

  /* -------- DRY-RUN / TEST -------- */
  app.post("/api/automation/rules/:id/test", requireAutomationAdmin, async (req, res) => {
    const [rule] = await db.select().from(workflowRules).where(eq(workflowRules.id, req.params.id));
    if (!rule) return res.status(404).json({ error: "Not found" });
    const sample = req.body?.sampleEvent || {};
    const result = await dryRunRule(rule, sample);
    res.json(result);
  });

  /* -------- MANUAL TRIGGER -------- */
  app.post("/api/automation/rules/:id/run", requireAutomationAdmin, async (req, res) => {
    const [rule] = await db.select().from(workflowRules).where(eq(workflowRules.id, req.params.id));
    if (!rule) return res.status(404).json({ error: "Not found" });
    const userId = getSessionUser(req)!.id;
    // emitEvent persists + dispatches asynchronously via the registered dispatcher.
    // Do NOT also call processEvent here — that would double-run actions.
    const eventId = await emitEvent({
      source: "manual",
      module: rule.module,
      entityType: req.body?.entityType || rule.module,
      entityId: req.body?.entityId || null,
      eventType: "manual",
      newValues: req.body?.newValues || null,
      oldValues: req.body?.oldValues || null,
      actorUserId: userId,
      countryCode: req.body?.countryCode || null,
    });
    if (!eventId) return res.status(500).json({ error: "Failed to emit event" });
    res.json({ ok: true, eventId });
  });

  /* -------- RUNS HISTORY -------- */
  app.get("/api/automation/runs", requireAuth, async (req, res) => {
    const ruleId = req.query.ruleId as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    let q = db.select().from(workflowRuns).$dynamic();
    if (ruleId) q = q.where(eq(workflowRuns.ruleId, ruleId));
    const rows = await q.orderBy(desc(workflowRuns.startedAt)).limit(limit);
    res.json(rows);
  });

  app.get("/api/automation/runs/:id", requireAuth, async (req, res) => {
    const [run] = await db.select().from(workflowRuns).where(eq(workflowRuns.id, req.params.id));
    if (!run) return res.status(404).json({ error: "Not found" });
    const actions = await db
      .select()
      .from(workflowActionLog)
      .where(eq(workflowActionLog.runId, run.id))
      .orderBy(workflowActionLog.actionIndex);
    let event = null as any;
    if (run.eventId) {
      const [ev] = await db.select().from(workflowEvents).where(eq(workflowEvents.id, run.eventId));
      event = ev || null;
    }
    res.json({ run, actions, event });
  });

  /* -------- TRIGGER / ACTION CATALOGUE (for UI dropdowns) -------- */
  app.get("/api/automation/catalog", requireAuth, async (_req, res) => {
    res.json({
      modules: [
        { value: "customer", label: "Customer" },
        { value: "task", label: "Task" },
        { value: "contract", label: "Contract" },
        { value: "hospital", label: "Hospital" },
        { value: "clinic", label: "Clinic" },
        { value: "call", label: "Inbound call" },
      ],
      eventTypes: [
        { value: "created", label: "Entity created" },
        { value: "updated", label: "Entity updated" },
        { value: "status_changed", label: "Status changed" },
        { value: "task.completed", label: "Task completed" },
        { value: "call.assigned", label: "Inbound call assigned to agent" },
        { value: "call.answered", label: "Inbound call answered" },
        { value: "call.completed", label: "Inbound call completed" },
        { value: "call.abandoned", label: "Inbound call abandoned (caller hangup)" },
        { value: "call.timeout", label: "Inbound call timed out" },
        { value: "manual", label: "Manual trigger" },
      ],
      actionTypes: [
        {
          value: "create_task",
          label: "Create task",
          configSchema: {
            title: "string (template)",
            description: "string (template, optional)",
            assignedUserId: "string",
            assignedDepartmentId: "string (optional)",
            priority: "low|medium|high|urgent",
            dueInHours: "number",
            checklist: "array of strings or {label,required}",
          },
        },
        {
          value: "notify_user",
          label: "Notify user(s)",
          configSchema: {
            userId: "string",
            userIds: "string[]",
            title: "string",
            message: "string",
            priority: "low|normal|high|urgent",
          },
        },
        {
          value: "send_email",
          label: "Send email",
          configSchema: {
            to: "string (email, comma-separated list, or template)",
            cc: "string (optional carbon copy: email, comma-separated list, or template)",
            bcc: "string (optional blind carbon copy; MS365 only)",
            subject: "string (template)",
            body: "string (template; HTML auto-detected, plain text gets <br/> conversion)",
            from: "string (optional sender email; falls back to EMAIL_FROM env)",
            attachments: "array of { name, url } or { name, contentType, contentBase64 } (max 5, 10MB each, 25MB total; only http/https URLs to public hosts)",
          },
        },
        {
          value: "send_sms",
          label: "Send SMS (BulkGate)",
          configSchema: {
            to: "string (phone number, E.164 or template)",
            text: "string (template, max ~160 chars per part)",
            country: "ISO country code (optional, defaults to event country)",
            kind: "transactional|promotional (default transactional)",
            unicode: "boolean (optional, for non-GSM characters)",
            tag: "string (optional, audit tag)",
          },
        },
        {
          value: "webhook",
          label: "Call webhook (HTTP)",
          configSchema: {
            url: "string (URL, supports template)",
            method: "GET|POST|PUT|PATCH|DELETE (default POST)",
            headers: "object (optional)",
            body: "any (optional, defaults to event payload)",
          },
        },
        {
          value: "update_entity",
          label: "Update entity (mutate fields)",
          configSchema: {
            entityType: "task|customer|hospital|clinic|invoice (defaults to event entityType)",
            entityId: "string (defaults to event entityId, supports template)",
            fields: "object - only allow-listed fields per entity type are applied",
          },
        },
      ],
      operators: [
        { value: "eq", label: "equals", arity: 1 },
        { value: "neq", label: "not equals", arity: 1 },
        { value: "gt", label: ">", arity: 1 },
        { value: "gte", label: ">=", arity: 1 },
        { value: "lt", label: "<", arity: 1 },
        { value: "lte", label: "<=", arity: 1 },
        { value: "in", label: "in (comma list)", arity: 1 },
        { value: "not_in", label: "not in (comma list)", arity: 1 },
        { value: "contains", label: "contains", arity: 1 },
        { value: "starts_with", label: "starts with", arity: 1 },
        { value: "is_null", label: "is empty", arity: 0 },
        { value: "is_not_null", label: "is set", arity: 0 },
        { value: "changed", label: "changed (any)", arity: 0 },
        { value: "changed_to", label: "changed to", arity: 1 },
        { value: "changed_from", label: "changed from", arity: 1 },
      ],
      fields: {
        customer: [
          { value: "newValues.firstName", label: "First name", type: "string" },
          { value: "newValues.lastName", label: "Last name", type: "string" },
          { value: "newValues.email", label: "Email", type: "string" },
          { value: "newValues.phone", label: "Phone", type: "string" },
          { value: "newValues.country", label: "Country", type: "string" },
          { value: "newValues.status", label: "Status", type: "enum", options: ["new", "in_process", "client", "rejected", "lost", "archived"] },
          { value: "newValues.clientStatus", label: "Client status", type: "string" },
          { value: "newValues.assignedUserId", label: "Assigned user", type: "string" },
          { value: "newValues.complaintTypeId", label: "Complaint type", type: "string" },
          { value: "newValues.cooperationTypeId", label: "Cooperation type", type: "string" },
          { value: "newValues.vipStatusId", label: "VIP status", type: "string" },
          { value: "newValues.newsletter", label: "Newsletter", type: "boolean" },
        ],
        task: [
          { value: "newValues.title", label: "Title", type: "string" },
          { value: "newValues.priority", label: "Priority", type: "enum", options: ["low", "medium", "high", "urgent"] },
          { value: "newValues.status", label: "Status", type: "enum", options: ["pending", "in_progress", "completed", "cancelled"] },
          { value: "newValues.assignedUserId", label: "Assignee", type: "string" },
          { value: "newValues.assignedDepartmentId", label: "Department", type: "string" },
          { value: "newValues.createdByUserId", label: "Creator", type: "string" },
          { value: "newValues.customerId", label: "Customer", type: "string" },
          { value: "newValues.country", label: "Country", type: "string" },
        ],
        contract: [
          { value: "newValues.status", label: "Status", type: "string" },
          { value: "newValues.country", label: "Country", type: "string" },
        ],
        hospital: [
          { value: "newValues.status", label: "Status", type: "enum", options: ["active", "pending", "inactive"] },
          { value: "newValues.country", label: "Country", type: "string" },
        ],
        clinic: [
          { value: "newValues.status", label: "Status", type: "enum", options: ["active", "pending", "inactive"] },
          { value: "newValues.country", label: "Country", type: "string" },
        ],
      },
      countries: [
        { value: "SK", label: "Slovakia" },
        { value: "CZ", label: "Czech Republic" },
        { value: "RO", label: "Romania" },
        { value: "IT", label: "Italy" },
        { value: "DE", label: "Germany" },
      ],
    });
  });

  /* -------- USERS LIST (for assignee/notify pickers) -------- */
  app.get("/api/automation/users", requireAuth, async (_req, res) => {
    try {
      const { db } = await import("../db");
      const { users } = await import("@shared/schema");
      const rows = await db
        .select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role })
        .from(users);
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e?.message || "Failed to load users" });
    }
  });
}

/** Seed system rule(s). Idempotent. */
export async function seedSystemAutomationRules() {
  const existing = await db
    .select({ id: workflowRules.id })
    .from(workflowRules)
    .where(and(eq(workflowRules.isSystem, true), eq(workflowRules.name, "Notify creator on task completion")));
  if (existing.length) return;
  await db.insert(workflowRules).values({
    name: "Notify creator on task completion",
    description: "System rule — notifies the task creator when their task is marked completed.",
    module: "task",
    enabled: true,
    isSystem: true,
    trigger: { type: "event", entityType: "task", eventType: "task.completed" },
    conditions: null,
    actions: [
      {
        type: "notify_user",
        config: {
          userId: "{{newValues.createdByUserId}}",
          title: "Task completed: {{newValues.title}}",
          message: "Your task \"{{newValues.title}}\" was completed.",
          type: "task_completed",
          entityType: "task",
          entityId: "{{newValues.id}}",
          priority: "normal",
        },
      },
    ],
  });
  console.log("[Automation] Seeded system rule: Notify creator on task completion");
}
