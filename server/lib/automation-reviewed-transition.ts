import type { Express, RequestHandler } from "express";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { alertRules, notificationRules, workflowRules, users } from "../../shared/schema";
import { notificationAutomationDraft } from "../../client/src/lib/notification-automation-draft";
import { validateRuleCapabilities } from "./automation-capabilities";
import { validateAutomationActions } from "./automation-action-policy";
import { ensureMetricServicesSchema } from "./automation-metric-services";

let ready: Promise<void> | undefined;
export function ensureReviewedTransitionSchema() {
  return ready ||= db.execute(sql`CREATE TABLE IF NOT EXISTS workflow_legacy_reviews (
    rule_id varchar PRIMARY KEY REFERENCES workflow_rules(id) ON DELETE CASCADE,
    source_kind text NOT NULL, source_id varchar NOT NULL, source_fingerprint text NOT NULL,
    activated_at timestamptz
  )`).then(() => undefined).catch(error => { ready = undefined; throw error; });
}
export function sourceFingerprint(source: Record<string, unknown>): string {
  const volatile = new Set(["lastCheckedAt", "nextCheckAt", "lastAlertedAt", "triggerCount", "lastTriggeredAt", "updatedAt", "createdAt"]);
  const persisted = Object.keys(source).sort().filter(key => !volatile.has(key)).map(key => [key, source[key]]);
  return createHash("sha256").update(JSON.stringify(persisted)).digest("hex");
}
export async function isUnreviewedReplacement(ruleId: string) {
  await ensureReviewedTransitionSchema();
  const result = await db.execute(sql`SELECT rule_id FROM workflow_legacy_reviews WHERE rule_id=${ruleId} AND activated_at IS NULL`);
  return result.rows.length > 0;
}

export function registerReviewedTransitionRoutes(app: Express, requireAdmin: RequestHandler) {
  app.post("/api/automation/legacy/:kind/:id/draft", requireAdmin, async (req, res) => {
    const kind = req.params.kind;
    if (!["notification", "metric"].includes(kind)) return res.status(400).json({ error: "Unsupported legacy source" });
    try {
      await ensureReviewedTransitionSchema();
      const table = kind === "notification" ? notificationRules : alertRules;
      const [source]: any[] = await db.select().from(table as any).where(eq(table.id, req.params.id));
      if (!source) return res.status(404).json({ error: "Legacy rule not found" });
      const fingerprint = sourceFingerprint(source);
      const previous = await db.execute(sql`SELECT rule_id,source_fingerprint FROM workflow_legacy_reviews
        WHERE source_kind=${kind} AND source_id=${source.id} AND activated_at IS NULL`);
      if (previous.rows.length) {
        if (previous.rows[0].source_fingerprint !== fingerprint) return res.status(409).json({ error: "Legacy source changed; review the existing replacement against its source" });
        const [draft] = await db.select().from(workflowRules).where(eq(workflowRules.id, String(previous.rows[0].rule_id)));
        if (draft) return res.json(draft);
      }
      let draft: any;
      if (kind === "notification") draft = notificationAutomationDraft(source, "notify_user");
      else {
        const recipients = source.targetType === "role" ? (source.targetRoles || []).map((targetRole: string) => ({ targetRole }))
          : (source.targetUserIds || []).map((userId: string) => ({ userId }));
        draft = { name: source.name, description: source.description || "", module: "metric", enabled: false,
          countryCodes: source.countryCodes?.length ? source.countryCodes : null,
          trigger: { type: "event", entityType: "metric", eventType: "metric.threshold",
            metric: { metricType: source.metricType, checkFrequency: source.checkFrequency, cooldownMinutes: source.cooldownMinutes } },
          conditions: { field: "newValues.value", op: source.comparisonOperator, value: source.thresholdValue },
          actions: (recipients.length ? recipients : [{}]).map((recipient: any) => ({ type: "notify_user",
            config: { notificationActionVersion: 2, title: source.name, message: "{{newValues.value}}",
              priority: source.notificationPriority, ...recipient } })),
        };
      }
      if (source.targetType === "all") {
        const activeUsers = await db.select({ id: users.id }).from(users).where(eq(users.isActive, true));
        const base = draft.actions[0];
        draft.actions = activeUsers.map(user => ({ type: base.type, config: { ...base.config, userId: user.id } }));
      }
      // External delivery stays present in the paused draft and must be configured
      // in the general editor before activation; never silently discard a channel.
      if (kind === "notification") for (const [flag, type] of [["sendEmail", "send_email"], ["sendSms", "send_sms"]] as const) {
        if (source[flag]) draft.actions.push(...notificationAutomationDraft(source, type).actions);
      }
      draft.trigger.legacySource = { kind, id: source.id, sourceUpdatedAt: source.updatedAt || source.createdAt,
        sourceFingerprint: fingerprint, snapshot: source };
      const saved = await db.transaction(async tx => {
        const [row] = await tx.insert(workflowRules).values({ ...draft, createdByUserId: (req as any).session.user.id }).returning();
        await tx.execute(sql`INSERT INTO workflow_legacy_reviews(rule_id,source_kind,source_id,source_fingerprint)
          VALUES(${row.id},${kind},${source.id},${fingerprint})`);
        return row;
      });
      res.json(saved);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error && error.message === "unsupported_legacy_conditions"
        ? "The original rule's conditions require manual review; the original is unchanged" : "Unable to create a reviewed replacement" });
    }
  });

  app.post("/api/automation/rules/:id/activate-reviewed", requireAdmin, async (req, res) => {
    try {
      await ensureReviewedTransitionSchema();
      await ensureMetricServicesSchema();
      const result = await db.transaction(async tx => {
        const reviewResult = await tx.execute(sql`SELECT * FROM workflow_legacy_reviews WHERE rule_id=${req.params.id} FOR UPDATE`);
        const review: any = reviewResult.rows[0];
        if (!review || review.activated_at) throw new Error("review_unavailable");
        const table = review.source_kind === "notification" ? notificationRules : alertRules;
        await tx.execute(sql`SELECT id FROM ${table} WHERE id=${review.source_id} FOR UPDATE`);
        const [source]: any[] = await tx.select().from(table as any).where(eq(table.id, review.source_id));
        const [rule] = await tx.select().from(workflowRules).where(eq(workflowRules.id, req.params.id)).for("update");
        if (!source || !rule || rule.enabled || sourceFingerprint(source) !== review.source_fingerprint) throw new Error("review_stale");
        if (validateRuleCapabilities(rule).length || validateAutomationActions(rule.actions, "manual").length) throw new Error("review_invalid");
        // No queued pre-transition communication can execute in both engines.
        const activationTime = new Date();
        await tx.update(table as any).set({ isActive: false }).where(eq(table.id, source.id));
        const [enabled] = await tx.update(workflowRules).set({ enabled: true, consecutiveErrorCount: 0, disabledReason: null,
          trigger: { ...(rule.trigger as object), reviewActivatedAt: activationTime.toISOString() }, updatedAt: activationTime })
          .where(and(eq(workflowRules.id, rule.id), eq(workflowRules.enabled, false))).returning();
        if (!enabled) throw new Error("review_stale");
        await tx.execute(sql`UPDATE workflow_legacy_reviews SET activated_at=${activationTime} WHERE rule_id=${rule.id}`);
        if (review.source_kind === "metric") await tx.execute(sql`INSERT INTO workflow_service_state(rule_id,last_checked_at,last_alerted_at)
          VALUES(${rule.id},${source.lastCheckedAt || null},${source.lastAlertedAt || null})
          ON CONFLICT(rule_id) DO UPDATE SET last_checked_at=EXCLUDED.last_checked_at,last_alerted_at=EXCLUDED.last_alerted_at`);
        return enabled;
      });
      res.json(result);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      res.status(code === "review_invalid" ? 400 : 409).json({ error: code === "review_invalid"
        ? "Complete the replacement's source, conditions, recipients and actions before activation"
        : "The original or replacement changed; neither rule was switched" });
    }
  });
}
