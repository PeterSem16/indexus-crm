import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { pool } from "../db";
import type { Pool } from "pg";
import {
  funnelConfigSchema, suggestFunnelConfig, type FunnelItem, type FunnelConfig,
} from "../../shared/mission-funnel";
import { computeMissionFunnel, type FunnelInput } from "./mission-funnel";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s =>
  Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s);
const filtersSchema = z.object({
  from: day.optional(), to: day.optional(), referral: z.enum(["all","yes","no"]).default("all"),
}).refine(v => !v.from || !v.to || v.from <= v.to);
export function parseFunnelSettings(raw: unknown): Record<string, unknown> {
  const value = typeof raw === "string" ? JSON.parse(raw || "{}") : raw ?? {};
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Mission settings");
  return value as Record<string, unknown>;
}
function authenticatedUserId(req: unknown): string {
  const id = (req as { session?: { user?: { id?: string } } }).session?.user?.id;
  if (!id) throw new Error("Authenticated identity required");
  return id;
}

/** Read permissions are evaluated using fresh DB identity, never a caller-supplied country. */
async function access(userId: string, missionId: string, database: Pick<Pool, "query" | "connect">) {
  const { rows } = await database.query(`
    SELECT u.role,u.role_id,u.assigned_countries,m.name,m.country_codes,m.settings,
      EXISTS(SELECT 1 FROM campaign_agents a WHERE a.campaign_id=m.id AND a.user_id=u.id) AS assigned,
      EXISTS(SELECT 1 FROM role_module_permissions p WHERE p.role_id=u.role_id
        AND p.module_key='campaigns' AND p.access='visible') AS module_read,
      EXISTS(SELECT 1 FROM role_module_permissions p WHERE p.role_id=u.role_id
        AND p.module_key='campaigns' AND p.access='visible' AND p.can_edit) AS module_edit
    FROM users u CROSS JOIN campaigns m WHERE u.id=$1 AND u.is_active AND m.id=$2`,
  [userId, missionId]);
  const row = rows[0];
  if (!row) return null;
  const admin = row.role === "admin";
  const legacyManager = row.role === "manager" && !row.role_id;
  const countries: string[] = row.assigned_countries ?? [];
  const missionCountries: string[] = row.country_codes ?? [];
  const countryRead = admin || missionCountries.some(c => countries.includes(c));
  const canRead = countryRead && (admin || legacyManager || row.module_read || row.assigned);
  const canConfigure = countryRead && (admin || legacyManager || row.module_edit) &&
    (admin || missionCountries.length > 0 && missionCountries.every(c => countries.includes(c)));
  return { ...row, admin, countries, canRead, canConfigure };
}

export function registerMissionFunnelRoutes(app: Express, requireAuth: RequestHandler, database: Pick<Pool, "query" | "connect"> = pool) {
  // Analytics evidence only; this is NOT authorization to dial or record.
  // Called after SIP.js dispatches INVITE, not when a call-log row is created.
  app.post("/api/call-logs/:id/funnel-attempt", requireAuth, async (req, res) => {
    const sentAt = z.string().datetime({ offset: true }).safeParse(req.body?.sentAt);
    if (!sentAt.success || Date.parse(sentAt.data) > Date.now() + 5000) return res.status(400).json({ error: "Invalid attempt time" });
    let client: Awaited<ReturnType<typeof database.connect>> | undefined;
    try {
      client = await database.connect();
      await client.query("BEGIN");
      const { rows } = await client.query(`SELECT l.metadata,l.started_at FROM call_logs l
        JOIN users u ON u.id=l.user_id AND u.is_active
        JOIN campaign_contacts cc ON cc.id=l.campaign_contact_id AND cc.campaign_id=l.campaign_id
        JOIN clinics c ON c.id=cc.clinic_id
        WHERE l.id=$1 AND l.user_id=$2 AND l.direction='outbound' AND cc.contact_type='clinic'
        AND l.customer_id=c.id AND (u.role='admin' OR c.country_code=ANY(u.assigned_countries))
        FOR UPDATE OF l`, [req.params.id, authenticatedUserId(req)]);
      if (!rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Owned Mission call not found" });
      }
      if (Date.parse(sentAt.data) < new Date(rows[0].started_at).getTime() - 5000 ||
        Date.now() - Date.parse(sentAt.data) > 300_000) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Attempt time outside call window" });
      }
      const metadata = parseFunnelSettings(rows[0].metadata);
      if (!metadata.funnelAttemptSentAt) {
        await client.query("UPDATE call_logs SET metadata=$2 WHERE id=$1", [req.params.id, JSON.stringify({
          ...metadata, funnelAttemptSentAt: sentAt.data, funnelAttemptEvidence: "client-dispatched",
          funnelAttemptReceivedAt: new Date().toISOString(),
        })]);
      }
      await client.query("COMMIT");
      return res.json({ success: true });
    } catch {
      await client?.query("ROLLBACK").catch(() => {});
      return res.status(500).json({ error: "Attempt evidence unavailable" });
    } finally { client?.release(); }
  });

  app.get("/api/campaigns/:id/mission-funnel", requireAuth, async (req, res) => {
    const filters = filtersSchema.safeParse(req.query);
    if (!filters.success) return res.status(400).json({ error: "Invalid funnel filters" });
    try {
      const user = await access(authenticatedUserId(req), req.params.id, database);
      if (!user?.canRead) return res.status(403).json({ error: "Mission report not authorized" });
      const client = await database.connect();
      try {
        await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
        await client.query("SET LOCAL statement_timeout = '20s'");
        const itemRows = await client.query(`SELECT id,step_id AS "stepId",label,parent_id AS "parentId"
          FROM campaign_status_list_items WHERE campaign_id=$1 ORDER BY sort_order,id`, [req.params.id]);
        const items: FunnelItem[] = itemRows.rows;
        const questions = await client.query(`SELECT q.id,q.question_text AS label
          FROM campaign_status_list_questions q JOIN campaign_status_list_items i ON i.id=q.item_id
          WHERE i.campaign_id=$1 AND q.field_type='date' ORDER BY i.sort_order,q.sort_order,q.id`, [req.params.id]);
        const settings = parseFunnelSettings(user.settings);
        const parsed = settings.missionFunnel ? funnelConfigSchema.safeParse(settings.missionFunnel) : null;
        if (parsed && !parsed.success) throw new Error("Invalid saved funnel configuration");
        const config: FunnelConfig = parsed?.success ? parsed.data : suggestFunnelConfig(items);
        const ids = new Set(items.map(item => item.id));
        // Removed source items remain visible as unavailable, never silently remapped.
        const validConfig = { ...config, sources: Object.fromEntries(Object.entries(config.sources)
          .map(([key, values]) => [key, values.filter(id => ids.has(id))])) } as FunnelConfig;
        const clinicRows = await client.query(`
          SELECT DISTINCT c.id,c.name,c.representative_id AS "representativeId",c.is_referred_by_doctor AS referred
          FROM clinics c JOIN campaign_contacts cc ON cc.clinic_id=c.id
          WHERE cc.campaign_id=$1 AND cc.contact_type='clinic' AND ($2::boolean OR c.country_code=ANY($3::text[]))`,
        [req.params.id, user.admin, user.countries]);
        const clinicIds = clinicRows.rows.map(c => c.id);
        const enrollmentRows = await client.query(`SELECT id,clinic_id AS "clinicId" FROM campaign_contacts
          WHERE campaign_id=$1 AND contact_type='clinic' AND clinic_id=ANY($2::text[])`, [req.params.id, clinicIds]);
        const contactIds = enrollmentRows.rows.map(c => c.id);
        const absenceReturns: Record<string, string> = {};
        if (config.absenceReturnQuestionId && questions.rows.some(q => q.id === config.absenceReturnQuestionId)) {
          const answers = await client.query(`SELECT campaign_contact_id,value FROM mission_status_list_answers
            WHERE campaign_contact_id=ANY($1::text[]) AND question_id=$2`, [contactIds, config.absenceReturnQuestionId]);
          for (const answer of answers.rows) {
            if (typeof answer.value === "string" && day.safeParse(answer.value).success) absenceReturns[answer.campaign_contact_id] = answer.value;
          }
        }
        const eventRows = await client.query(`SELECT h.id,h.campaign_contact_id AS "contactId",
          h.metadata->>'statusListItemId' AS "itemId",
          (h.metadata->>'confirmed')::boolean AS confirmed,h.created_at AS at
          FROM campaign_contact_history h JOIN campaign_status_list_items i ON i.id=h.metadata->>'statusListItemId'
          WHERE h.campaign_contact_id=ANY($1::text[]) AND i.campaign_id=$2
          AND h.action='status_list_confirmation' AND h.metadata->>'confirmed' IN ('true','false')
          ORDER BY h.created_at,h.id`, [contactIds, req.params.id]);
        const stateRows = await client.query(`SELECT s.campaign_contact_id AS "contactId",s.status_list_item_id AS "itemId",s.confirmed_at AS at
          FROM campaign_contact_status_list_state s JOIN campaign_status_list_items i ON i.id=s.status_list_item_id
          WHERE s.campaign_contact_id=ANY($1::text[]) AND i.campaign_id=$2`, [contactIds, req.params.id]);
        // Exact Mission and clinic identities only. A saved Mission is retained
        // for historical orphan links, but conflicting live links fail closed.
        const callRows = await client.query(`SELECT l.id,l.campaign_contact_id AS "contactId",
          CASE WHEN cc.id IS NOT NULL AND cc.campaign_id=$1 AND cc.contact_type='clinic'
            AND cc.clinic_id=ANY($2::text[]) AND (l.customer_id IS NULL OR l.customer_id=cc.clinic_id) THEN cc.clinic_id
            WHEN cc.id IS NULL AND l.customer_id=ANY($2::text[]) THEN l.customer_id ELSE NULL END AS "clinicId",
          l.direction,l.status,l.started_at AS at,l.answered_at AS "answeredAt",
          l.duration_seconds AS duration,l.sip_call_id AS "sipCallId",l.metadata
          FROM call_logs l LEFT JOIN campaign_contacts cc ON cc.id=l.campaign_contact_id
          WHERE l.campaign_id=$1 AND (
            cc.clinic_id=ANY($2::text[]) OR l.customer_id=ANY($2::text[]) OR
            ($3::boolean AND cc.id IS NULL))`, [req.params.id, clinicIds, user.admin]);
        await client.query("COMMIT");
        const iso = (v: unknown) => v instanceof Date ? v.toISOString() : String(v);
        const input: FunnelInput = {
          clinics: clinicRows.rows, enrollments: enrollmentRows.rows, items, config: validConfig, absenceReturns,
          events: eventRows.rows.map(e => ({ ...e, at: iso(e.at) })),
          states: stateRows.rows.map(s => ({ ...s, at: iso(s.at) })),
          calls: callRows.rows.map(c => {
            let metadata: Record<string, unknown> = {};
            try { metadata = parseFunnelSettings(c.metadata); } catch { /* legacy metadata is not call evidence */ }
            return { ...c, at: iso(c.at), answeredAt: c.answeredAt ? iso(c.answeredAt) : null,
              duration: Number(c.duration) || 0,
              attemptAt: typeof metadata.funnelAttemptSentAt === "string" ? metadata.funnelAttemptSentAt : null };
          }),
        };
        res.json({ ...computeMissionFunnel(input, filters.data), dateQuestions: questions.rows, missionName: user.name, canConfigure: user.canConfigure });
      } catch (error) {
        await client.query("ROLLBACK"); throw error;
      } finally { client.release(); }
    } catch {
      console.error("[Mission funnel] Report failed");
      res.status(500).json({ error: "Mission funnel unavailable" });
    }
  });

  app.put("/api/campaigns/:id/mission-funnel/config", requireAuth, async (req, res) => {
    const parsed = funnelConfigSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid funnel configuration" });
    try {
      const user = await access(authenticatedUserId(req), req.params.id, database);
      if (!user?.canConfigure) return res.status(403).json({ error: "Funnel configuration not authorized" });
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await client.query("SELECT settings FROM campaigns WHERE id=$1 FOR UPDATE", [req.params.id]);
        const settings = parseFunnelSettings(rows[0].settings);
        const mapped = [...new Set(Object.values(parsed.data.sources).flat())];
        const { rows: items } = await client.query(`SELECT id FROM campaign_status_list_items
          WHERE campaign_id=$1 AND id=ANY($2::text[])`, [req.params.id, mapped]);
        if (items.length !== mapped.length) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "Mapping contains foreign or deleted items" });
        }
        if (parsed.data.absenceReturnQuestionId) {
          const question = await client.query(`SELECT q.id FROM campaign_status_list_questions q
            JOIN campaign_status_list_items i ON i.id=q.item_id
            WHERE q.id=$1 AND i.campaign_id=$2 AND q.field_type='date'`,
          [parsed.data.absenceReturnQuestionId, req.params.id]);
          if (!question.rows.length) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Absence return date must be a date question in this Mission" });
          }
        }
        // Preserve every other module-owned setting atomically under row lock.
        await client.query("UPDATE campaigns SET settings=$2 WHERE id=$1",
          [req.params.id, JSON.stringify({ ...settings, missionFunnel: parsed.data })]);
        await client.query("COMMIT");
        res.json({ success: true });
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    } catch {
      console.error("[Mission funnel] Configuration save failed");
      res.status(500).json({ error: "Funnel configuration unavailable" });
    }
  });
}
