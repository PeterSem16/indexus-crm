import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "../db";
import { workflowRules } from "../../shared/schema";
import { METRIC_FREQUENCIES, METRIC_TYPES } from "../../shared/automation-analysis";
import { emitEventOnce } from "./event-bus";
let ready: Promise<void> | undefined;
export function ensureMetricServicesSchema() {
  return ready ||= db.execute(sql`CREATE TABLE IF NOT EXISTS workflow_service_state (
    rule_id varchar PRIMARY KEY REFERENCES workflow_rules(id) ON DELETE CASCADE,
    last_checked_at timestamptz, last_alerted_at timestamptz
  )`).then(() => undefined).catch(error => { ready = undefined; throw error; });
}

export async function evaluateMetricServices() {
  await ensureMetricServicesSchema();
  const rules = await db.select().from(workflowRules).where(and(eq(workflowRules.enabled, true), eq(workflowRules.module, "metric")));
  const { evaluateMetric } = await import("../alert-evaluator");
  for (const rule of rules) {
    const config = (rule.trigger as any)?.metric;
    if (!config || !METRIC_TYPES.includes(config.metricType) || !(config.checkFrequency in METRIC_FREQUENCIES)) continue;
    const connection = await pool.connect();
    try {
      const lock = await connection.query("SELECT pg_try_advisory_lock(hashtext($1)) AS locked", [`metric:${rule.id}`]);
      if (!lock.rows[0]?.locked) continue;
      await connection.query("INSERT INTO workflow_service_state(rule_id) VALUES($1) ON CONFLICT DO NOTHING", [rule.id]);
      const state = (await connection.query("SELECT * FROM workflow_service_state WHERE rule_id=$1", [rule.id])).rows[0];
      const now = Date.now();
      if (state.last_checked_at && now - new Date(state.last_checked_at).getTime() < METRIC_FREQUENCIES[config.checkFrequency as keyof typeof METRIC_FREQUENCIES]) continue;
      if (state.last_alerted_at && now - new Date(state.last_alerted_at).getTime() < config.cooldownMinutes * 60000) continue;
      // Use the existing authoritative metric computation, not browser-provided values.
      const countries = rule.countryCodes?.length ? rule.countryCodes : rule.countryCode ? [rule.countryCode] : undefined;
      const value = await evaluateMetric(config.metricType, countries);
      await connection.query("UPDATE workflow_service_state SET last_checked_at=now() WHERE rule_id=$1", [rule.id]);
      const condition: any = rule.conditions;
      const { evalCondition } = await import("./automation-engine");
      if (!evalCondition(condition, { newValues: { value, metricType: config.metricType }, countryCode: countries?.length === 1 ? countries[0] : null })) continue;
      const eventId = await emitEventOnce({ source: "cron", module: "metric", entityType: "metric", entityId: rule.id,
        eventType: "metric.threshold", countryCode: countries?.length === 1 ? countries[0] : null,
        newValues: { value, metricType: config.metricType, metricRuleId: rule.id } }, `metric:${rule.id}:${Math.floor(now / METRIC_FREQUENCIES[config.checkFrequency as keyof typeof METRIC_FREQUENCIES])}`);
      if (eventId) await connection.query("UPDATE workflow_service_state SET last_alerted_at=now() WHERE rule_id=$1", [rule.id]);
    } catch {
      console.error("[Automation] metric rule evaluation unavailable");
    } finally {
      await connection.query("SELECT pg_advisory_unlock(hashtext($1))", [`metric:${rule.id}`]).catch(() => {});
      connection.release();
    }
  }
}
