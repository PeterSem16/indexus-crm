import { createHash } from "node:crypto";
import type { Express, RequestHandler } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, pool } from "../db";
import { workflowRules, workflowEvents } from "../../shared/schema";
import { eligibilityInput, type EligibilitySourceEvent } from "../../shared/automation-eligibility";
import { isAnalysisServiceEvent } from "../../shared/automation-analysis-triggers";
import { authorizeAnalysisRetrySource } from "./automation-analysis-source";
import { analyzeCommunication } from "./automation-analysis";
import { eventRuleExclusion, runRule } from "./automation-engine";
import { analysisEffectSourceKey } from "./automation-effect-admission";
import { automationExecutableActions } from "../../shared/automation-branches";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const uuid = (value: unknown): value is string => typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
type Selection = { sourceId: string; sourceEvent: EligibilitySourceEvent };

export async function retryContext(ruleId: string, viewerId: string, input: Selection) {
  const [rule] = await db.select().from(workflowRules).where(eq(workflowRules.id, ruleId));
  if (!rule || rule.module !== "communication" || (rule.trigger as any)?.type !== "event" ||
      !isAnalysisServiceEvent((rule.trigger as any)?.eventType) || !(rule.trigger as any)?.analysis)
    throw new Error("retry_unavailable");
  const [event] = await db.select().from(workflowEvents).where(and(eq(workflowEvents.module, "communication"),
    eq(workflowEvents.entityId, input.sourceId), eq(workflowEvents.eventType, input.sourceEvent)))
    .orderBy(desc(workflowEvents.createdAt), desc(workflowEvents.id)).limit(1);
  if (!event) throw new Error("retry_unavailable");
  // Only the historical listening cutoff is overridden by this explicit action.
  // Do not short-circuit eventRuleExclusion at "before_activation": country and
  // trigger checks must still run for old sources.
  const gateRule = { ...rule, createdAt: event.createdAt,
    trigger: { ...(rule.trigger as any), listenAfter: null, reviewActivatedAt: null } };
  if (eventRuleExclusion(gateRule, event)) throw new Error("retry_unavailable");
  const source = await authorizeAnalysisRetrySource(rule, event, viewerId);
  if (typeof source.communication.countryCode === "string" &&
      eventRuleExclusion(gateRule, { ...event, countryCode: source.communication.countryCode }))
    throw new Error("retry_unavailable");
  // Source contents, filters, definition, countries and original event identity
  // bind the reviewed analysis to the current authorized source.
  const definitionHash = hash([rule, event, source.text, source.privateAttachments, source.communication]);
  const sourceKey = analysisEffectSourceKey(event);
  return { rule, event, definitionHash, sourceKey };
}

async function retryPreview(context: Awaited<ReturnType<typeof retryContext>>, viewerId: string) {
  const { rule, event, definitionHash, sourceKey } = context;
  const runs = (await pool.query(`SELECT r.id,r.status,r.skipped_reason AS "skippedReason",r.started_at AS "startedAt"
    FROM workflow_runs r JOIN workflow_events e ON e.id=r.event_id
    WHERE r.rule_id=$1 AND e.module=$2 AND e.event_type=$3 AND e.entity_id=$4
    ORDER BY r.started_at DESC,r.id DESC LIMIT 100`,
  [rule.id, event.module, event.eventType, event.entityId])).rows;
  const attempts = (await pool.query(`SELECT a.id,a.status,a.created_at AS "createdAt",
    (a.requested_by=$5) AS "canResume"
    FROM workflow_analysis_retries a JOIN workflow_events e ON e.id=a.event_id
    WHERE a.rule_id=$1 AND e.module=$2 AND e.event_type=$3 AND e.entity_id=$4
    ORDER BY a.created_at DESC LIMIT 100`,
  [rule.id, event.module, event.eventType, event.entityId, viewerId])).rows;
  const actionResults = (await pool.query(`SELECT l.run_id AS "runId",l.action_index AS "actionIndex",
    l.action_type AS "actionType",l.status,l.executed_at AS "executedAt"
    FROM workflow_action_log l JOIN workflow_runs r ON r.id=l.run_id JOIN workflow_events e ON e.id=r.event_id
    WHERE r.rule_id=$1 AND e.module=$2 AND e.event_type=$3 AND e.entity_id=$4
    ORDER BY l.executed_at DESC LIMIT 200`,
  [rule.id, event.module, event.eventType, event.entityId])).rows;
  const existingAnalyses = (await pool.query(`WITH analyzed AS (
      SELECT a.id::text AS id,a.status,a.analysis,a.created_at AS at
      FROM workflow_analysis_retries a JOIN workflow_events e ON e.id=a.event_id
      WHERE a.rule_id=$1 AND e.module=$2 AND e.event_type=$3 AND e.entity_id=$4 AND a.analysis IS NOT NULL
      UNION ALL
      SELECT r.id::text,r.status,r.payload->'analysis',r.started_at
      FROM workflow_runs r JOIN workflow_events e ON e.id=r.event_id
      WHERE r.rule_id=$1 AND e.module=$2 AND e.event_type=$3 AND e.entity_id=$4
        AND r.payload->'analysis' IS NOT NULL AND r.payload->>'retryAttemptId' IS NULL
    ) SELECT id AS "attemptId",status,analysis->>'summary' AS summary,
      analysis->>'sentiment' AS sentiment,analysis->>'tone' AS tone,
      analysis->'hasInvoice' AS "hasInvoice",analysis->'attachmentCount' AS "attachmentCount",
      analysis->'failedAttachmentCount' AS "failedAttachmentCount"
      FROM analyzed ORDER BY at DESC LIMIT 100`,
  [rule.id, event.module, event.eventType, event.entityId])).rows;
  const effects = (await pool.query(`SELECT action_index AS "actionIndex",status FROM workflow_analysis_effects
    WHERE rule_id=$1 AND source_key=$2 ORDER BY action_index`, [rule.id, sourceKey])).rows;
  return { token: hash([definitionHash, runs, actionResults, effects]), ruleName: rule.name,
    rule: { name: rule.name, module: rule.module, trigger: rule.trigger, conditions: rule.conditions,
      actions: rule.actions, countryCode: rule.countryCode, countryCodes: rule.countryCodes, enabled: rule.enabled },
    actions: automationExecutableActions(rule).map(action => action.type), runs, attempts, effects, actionResults, existingAnalyses };
}

function attemptResponse(row: any) {
  const a = row.analysis;
  return { attemptId: row.id, status: row.status, analysis: a ? {
    summary: a.summary, sentiment: a.sentiment, tone: a.tone, hasInvoice: a.hasInvoice,
    attachmentCount: a.attachmentCount, failedAttachmentCount: a.failedAttachmentCount,
  } : null };
}

export function registerAnalysisRetryRoutes(app: Express, requireAdmin: RequestHandler,
  viewer: (req: any) => string) {
  const prefix = "/api/automation/rules/:id/analysis-retry";
  app.post(`${prefix}/preview`, requireAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const input = eligibilityInput(req.body);
    if (!input) return res.status(400).json({ error: "Invalid source" });
    try { res.json(await retryPreview(await retryContext(req.params.id, viewer(req), input), viewer(req))); }
    catch { res.status(409).json({ error: "Retry unavailable; refresh access and source selection" }); }
  });
  app.get(`${prefix}/:attemptId`, requireAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const input = eligibilityInput(req.query);
    if (!input || !uuid(req.params.attemptId)) return res.status(400).json({ error: "Invalid source" });
    try {
      const context = await retryContext(req.params.id, viewer(req), input);
      const { rows } = await pool.query(`SELECT * FROM workflow_analysis_retries
        WHERE id=$1 AND rule_id=$2 AND event_id=$3 AND requested_by=$4`,
      [req.params.attemptId, context.rule.id, context.event.id, viewer(req)]);
      if (!rows[0]) return res.status(404).json({ error: "Attempt unavailable" });
      res.json(attemptResponse(rows[0]));
    } catch { res.status(409).json({ error: "Retry unavailable" }); }
  });
  app.post(`${prefix}/analyze`, requireAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const input = eligibilityInput(req.body);
    if (!input || !uuid(req.body.requestId) || req.body.confirmed !== true || typeof req.body.token !== "string")
      return res.status(400).json({ error: "Explicit confirmation required" });
    let attemptId: string | undefined;
    try {
      const context = await retryContext(req.params.id, viewer(req), input);
      const prior = (await pool.query(`SELECT * FROM workflow_analysis_retries WHERE requested_by=$1 AND request_id=$2`,
        [viewer(req), req.body.requestId])).rows[0];
      if (prior) {
        if (prior.rule_id !== context.rule.id || prior.event_id !== context.event.id)
          throw new Error("retry_conflict");
        return res.json(attemptResponse(prior));
      }
      if ((await retryPreview(context, viewer(req))).token !== req.body.token) throw new Error("retry_stale");
      const inserted = await pool.query(`INSERT INTO workflow_analysis_retries
        (rule_id,event_id,requested_by,request_id,definition_hash) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(requested_by,request_id) DO NOTHING RETURNING *`,
      [context.rule.id, context.event.id, viewer(req), req.body.requestId, context.definitionHash]);
      if (!inserted.rows[0]) {
        const row = (await pool.query(`SELECT * FROM workflow_analysis_retries WHERE requested_by=$1 AND request_id=$2`,
          [viewer(req), req.body.requestId])).rows[0];
        if (row?.rule_id !== context.rule.id || row?.event_id !== context.event.id) throw new Error("retry_conflict");
        return res.json(attemptResponse(row));
      }
      attemptId = inserted.rows[0].id;
      const analysis = await analyzeCommunication(context.rule, context.event, attemptId);
      if (!analysis) throw new Error("retry_unavailable");
      const latest = await retryContext(req.params.id, viewer(req), input);
      if (latest.definitionHash !== context.definitionHash) throw new Error("retry_stale");
      const { rows } = await pool.query(`UPDATE workflow_analysis_retries SET analysis=$2,status='ready'
        WHERE id=$1 RETURNING *`, [attemptId, JSON.stringify(analysis)]);
      res.json(attemptResponse(rows[0]));
    } catch {
      if (attemptId) await pool.query(`UPDATE workflow_analysis_retries
        SET status='failed',error_code='analysis_retry_failed',finished_at=now() WHERE id=$1`, [attemptId]);
      res.status(409).json({ error: "Analysis unavailable; reload preview before another attempt" });
    }
  });
  app.post(`${prefix}/execute`, requireAdmin, async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const input = eligibilityInput(req.body);
    if (!input || !uuid(req.body.attemptId) || req.body.confirmed !== true)
      return res.status(400).json({ error: "Explicit confirmation required" });
    let claimed = false;
    try {
      const context = await retryContext(req.params.id, viewer(req), input);
      const { rows } = await pool.query(`SELECT * FROM workflow_analysis_retries
        WHERE id=$1 AND rule_id=$2 AND event_id=$3 AND requested_by=$4`,
      [req.body.attemptId, context.rule.id, context.event.id, viewer(req)]);
      const attempt = rows[0];
      if (!attempt || attempt.definition_hash !== context.definitionHash) throw new Error("retry_stale");
      if (attempt.status !== "ready") return res.json(attemptResponse(attempt));
      const updated = await pool.query(`UPDATE workflow_analysis_retries SET status='executing'
        WHERE id=$1 AND status='ready' RETURNING id`, [attempt.id]);
      if (!updated.rows.length) {
        const current = (await pool.query("SELECT * FROM workflow_analysis_retries WHERE id=$1", [attempt.id])).rows[0];
        return res.json(attemptResponse(current));
      }
      claimed = true;
      await runRule(context.rule, context.event, [], undefined, {
        attemptId: attempt.id, analysis: attempt.analysis,
        authorize: async () => {
          const latest = await retryContext(req.params.id, viewer(req), input);
          if (latest.definitionHash !== attempt.definition_hash) throw new Error("retry_stale");
        },
      });
      const completed = await pool.query(`UPDATE workflow_analysis_retries SET status='done',finished_at=now()
        WHERE id=$1 RETURNING *`, [attempt.id]);
      res.json(attemptResponse(completed.rows[0]));
    } catch {
      if (claimed) await pool.query(`UPDATE workflow_analysis_retries SET status='failed',
        error_code='execution_retry_failed',finished_at=now() WHERE id=$1`, [req.body.attemptId]);
      res.status(409).json({ error: "Execution unavailable; completed or uncertain effects are not retried" });
    }
  });
}
