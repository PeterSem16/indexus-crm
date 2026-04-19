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
      ],
      eventTypes: [
        { value: "created", label: "Entity created" },
        { value: "updated", label: "Entity updated" },
        { value: "status_changed", label: "Status changed" },
        { value: "task.completed", label: "Task completed" },
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
            to: "string (email or template)",
            subject: "string",
            body: "string (template)",
          },
        },
      ],
      operators: ["eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in", "contains", "starts_with", "is_null", "is_not_null", "changed", "changed_to", "changed_from"],
    });
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
