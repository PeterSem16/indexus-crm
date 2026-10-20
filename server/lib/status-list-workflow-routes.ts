import type { Express, Request, RequestHandler } from "express";
import { z } from "zod";
import { pool } from "../db";
import { storage } from "../storage";
import { canAgentReadCampaignByWorkspaceCountry } from "./agent-workspace-country-access";
import { workflowAnswerSchema } from "../../shared/status-list-workflow";
import { saveWorkflowQuestion, StatusListWorkflowError, validateWorkflow, workflowCatalog } from "./status-list-workflow";
import { readWorkflowNotes } from "./status-list-workflow-notes";
import { configureBackgroundSource } from "./status-list-background";
import { addWaitingOption, configureOptionSource } from "./status-list-option-source";
import { registerStatusListOrganizationRoutes } from "./status-list-organization-routes";
import { readTransitionInventory } from "./status-list-transition-inventory";
import { medicalPartnerAudit } from "../../shared/status-list-transition-audit";
import { CallbackTransitionError, readCallbackReadiness, switchCallbackOwner } from "./status-list-callback-transition";

const admin = (user: any) => ["admin", "superadmin", "owner"].includes(user.role);
async function authorize(req: Request, manage: boolean, contactId?: string) {
  const user = (req as any).session?.user;
  if (!user) throw new StatusListWorkflowError("unauthorized", 401);
  const mission = (await pool.query("SELECT country_codes FROM campaigns WHERE id=$1", [req.params.campaignId])).rows[0];
  if (!mission) throw new StatusListWorkflowError("mission_not_found", 404);
  if (manage) {
    if (!admin(user) && user.role !== "manager") throw new StatusListWorkflowError("forbidden", 403);
    if (!admin(user) && (!mission.country_codes.length ||
      !mission.country_codes.every((code: string) => (user.assignedCountries || []).includes(code))))
      throw new StatusListWorkflowError("forbidden", 403);
  } else if (!admin(user)) {
    const access = await storage.getAgentWorkspaceAccess(user.id);
    if (!canAgentReadCampaignByWorkspaceCountry({ role: user.role,
      workspaceCountryCodes: access.map(row => row.countryCode), campaignCountryCodes: mission.country_codes }))
      throw new StatusListWorkflowError("forbidden", 403);
    if (user.role !== "manager") {
      const assignment = await pool.query("SELECT id FROM campaign_agents WHERE campaign_id=$1 AND user_id=$2",
        [req.params.campaignId, user.id]);
      if (!assignment.rowCount) throw new StatusListWorkflowError("forbidden", 403);
    }
  }
  if (contactId) {
    const contact = (await pool.query(`SELECT cc.id,cc.assigned_to,COALESCE(
      CASE cc.contact_type WHEN 'clinic' THEN cl.country_code WHEN 'hospital' THEN h.country_code
      WHEN 'collaborator' THEN co.country_code ELSE cu.country END,
      CASE WHEN cardinality(c.country_codes)=1 THEN c.country_codes[1] END) AS country
      FROM campaign_contacts cc JOIN campaigns c ON c.id=cc.campaign_id
      LEFT JOIN clinics cl ON cl.id=cc.clinic_id LEFT JOIN hospitals h ON h.id=cc.hospital_id
      LEFT JOIN collaborators co ON co.id=cc.collaborator_id LEFT JOIN customers cu ON cu.id=cc.customer_id
      WHERE cc.id=$1 AND cc.campaign_id=$2`, [contactId, req.params.campaignId])).rows[0];
    if (!contact) throw new StatusListWorkflowError("contact_not_found", 404);
    if (!admin(user)) {
      const access = await storage.getAgentWorkspaceAccess(user.id);
      const countries = access.map(row => row.countryCode);
      if (countries.length && (!contact.country || !countries.includes(contact.country)))
        throw new StatusListWorkflowError("forbidden", 403);
    }
  }
  return user;
}
export function registerStatusListWorkflowRoutes(app: Express, requireAuth: RequestHandler) {
  const root = "/api/campaigns/:campaignId/status-list-workflows";
  const contactRoot = "/api/campaigns/:campaignId/contacts/:campaignContactId/status-list-workflows";
  const route = (fn: (req: Request, res: any) => Promise<unknown>): RequestHandler => async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try { await fn(req, res); } catch (error) {
      if (error instanceof z.ZodError) { res.status(400).json({ error: "invalid_rule" }); return; }
      if (error instanceof StatusListWorkflowError) { res.status(error.status).json({ error: error.code }); return; }
      if (error instanceof CallbackTransitionError) { res.status(error.status).json({ error: error.code }); return; }
      console.error("[status-list-workflow] request failed", error instanceof Error ? error.name : "unknown");
      res.status(500).json({ error: "workflow_failed" });
    }
  };
  registerStatusListOrganizationRoutes(app, requireAuth, authorize, route);
  app.get(`${root}/transition-readiness`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    res.json(await readCallbackReadiness(req.params.campaignId));
  }));
  app.post(`${root}/transition-switch`, requireAuth, route(async (req, res) => {
    const user = await authorize(req, true);
    const body = z.object({
      fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
      expectedOwner: z.enum(["legacy", "compatible"]), targetOwner: z.enum(["legacy", "compatible"]),
      backupConfirmed: z.literal(true), missionNameConfirmation: z.string().min(1).max(500),
    }).strict().parse(req.body);
    res.json(await switchCallbackOwner(req.params.campaignId, user.id, body));
  }));
  app.get(`${root}/transition-inventory`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const client = await pool.connect();
    try {
      res.json({ current: await readTransitionInventory(client, req.params.campaignId),
        audited: medicalPartnerAudit(req.params.campaignId) });
    } finally { client.release(); }
  }));
  app.get(root, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const { rows } = await pool.query("SELECT id,campaign_id,definition FROM mission_status_list_rules WHERE campaign_id=$1 ORDER BY created_at,id", [req.params.campaignId]);
    res.json({ rules: rows.map(row => ({ ...row.definition, id: row.id, campaignId: row.campaign_id })),
      catalog: await workflowCatalog(req.params.campaignId) });
  }));
  app.get(`${root}/history`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const { rows } = await pool.query(`SELECT r.id,r.rule_name AS "ruleName",r.branch,r.results,
      r.created_at AS "createdAt",r.actor_kind AS "actorKind",u.full_name AS "actorName",
      r.campaign_contact_id AS "campaignContactId"
      FROM mission_status_list_rule_runs r LEFT JOIN users u ON u.id=r.actor_id
      WHERE r.campaign_id=$1 ORDER BY r.created_at DESC,r.id DESC LIMIT 50`, [req.params.campaignId]);
    res.json({ runs: rows });
  }));
  app.patch(`${root}/items/:itemId/presentation`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const body = z.object({ isHidden: z.boolean().optional(), required: z.boolean().optional(), tab: z.enum(["acquisition", "contract", "retention"]).nullable().optional() }).strict()
      .refine(value => value.isHidden !== undefined || value.required !== undefined || value.tab !== undefined).parse(req.body);
    const result = await pool.query(`UPDATE campaign_status_list_items SET
      is_hidden=COALESCE($3,is_hidden),required=COALESCE($4,required),tab=CASE WHEN $5::boolean THEN $6::text ELSE tab END,updated_at=now()
      WHERE id=$1 AND campaign_id=$2 RETURNING id`,
    [req.params.itemId, req.params.campaignId, body.isHidden, body.required, body.tab !== undefined, body.tab ?? null]);
    if (!result.rowCount) throw new StatusListWorkflowError("item_not_found", 404);
    res.json({ ok: true });
  }));
  app.post(`${root}/items/:itemId/move`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const { direction, neighborId } = z.object({ direction: z.enum(["up", "down"]), neighborId: z.string().uuid().optional() }).strict().parse(req.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`mission-workflow-config:${req.params.campaignId}`]);
      const { rows } = await client.query(`SELECT id,parent_id,item_type,tab FROM campaign_status_list_items
        WHERE campaign_id=$1 ORDER BY sort_order,id FOR UPDATE`, [req.params.campaignId]);
      const selected = rows.find(row => row.id === req.params.itemId);
      if (!selected) throw new StatusListWorkflowError("item_not_found", 404);
      const siblings = rows.filter(row => row.parent_id === selected.parent_id && row.item_type === selected.item_type);
      const index = siblings.findIndex(row => row.id === selected.id), target = neighborId ? siblings.findIndex(row => row.id === neighborId) : index + (direction === "up" ? -1 : 1);
      if (neighborId && (target < 0 || (direction === "up" ? target >= index : target <= index))) throw new StatusListWorkflowError("invalid_neighbor", 400);
      if (target >= 0 && target < siblings.length) {
        siblings.splice(index, 1);
        siblings.splice(target, 0, selected);
        await client.query(`UPDATE campaign_status_list_items i SET sort_order=o.n::int,updated_at=now()
          FROM unnest($1::varchar[]) WITH ORDINALITY AS o(id,n) WHERE i.id=o.id AND i.campaign_id=$2`,
        [siblings.map(row => row.id), req.params.campaignId]);
      }
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
    res.json({ ok: true });
  }));
  app.post(`${root}/items/:itemId/questions/:questionId/move`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const { direction, neighborId } = z.object({ direction: z.enum(["up", "down"]), neighborId: z.string().uuid().optional() }).strict().parse(req.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`mission-workflow-config:${req.params.campaignId}`]);
      const { rows } = await client.query(`SELECT q.id FROM campaign_status_list_questions q JOIN campaign_status_list_items i ON i.id=q.item_id
        WHERE q.item_id=$1 AND i.campaign_id=$2 ORDER BY q.sort_order,q.id FOR UPDATE OF q`, [req.params.itemId, req.params.campaignId]);
      const index = rows.findIndex(row => row.id === req.params.questionId);
      if (index < 0) throw new StatusListWorkflowError("question_not_found", 404);
      const target = neighborId ? rows.findIndex(row => row.id === neighborId) : index + (direction === "up" ? -1 : 1);
      if (neighborId && (target < 0 || (direction === "up" ? target >= index : target <= index))) throw new StatusListWorkflowError("invalid_neighbor", 400);
      if (target >= 0 && target < rows.length) {
        const [selected] = rows.splice(index, 1);
        rows.splice(target, 0, selected);
        await client.query(`UPDATE campaign_status_list_questions q SET sort_order=o.n::int,updated_at=now()
          FROM unnest($1::varchar[]) WITH ORDINALITY AS o(id,n) WHERE q.id=o.id AND q.item_id=$2`, [rows.map(row => row.id), req.params.itemId]);
      }
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
    res.json({ ok: true });
  }));
  app.get(`${root}/sources`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const { rows } = await pool.query(`SELECT s.question_id AS "questionId",s.source,q.is_hidden AS hidden
      FROM mission_status_list_sources s JOIN campaign_status_list_questions q ON q.id=s.question_id
      WHERE s.campaign_id=$1 ORDER BY s.question_id`, [req.params.campaignId]);
    res.json({ sources: rows, catalog: await workflowCatalog(req.params.campaignId) });
  }));
  app.get(`${root}/option-sources`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const sources = (await pool.query(`SELECT s.group_id AS "groupId",s.config,i.is_hidden AS hidden
      FROM mission_status_list_option_sources s JOIN campaign_status_list_items i ON i.id=s.group_id
      WHERE s.campaign_id=$1 ORDER BY s.group_id`, [req.params.campaignId])).rows;
    const coordinators = (await pool.query(`SELECT u.id,u.full_name AS name FROM users u WHERE u.id IN (
      SELECT user_id FROM campaign_agents WHERE campaign_id=$1 UNION
      SELECT assigned_to FROM campaign_contacts WHERE campaign_id=$1 AND assigned_to IS NOT NULL) ORDER BY u.full_name,u.id`,
    [req.params.campaignId])).rows;
    res.json({ sources: sources.map(row => ({ ...row.config, groupId: row.groupId, hidden: row.hidden })),
      coordinators, catalog: await workflowCatalog(req.params.campaignId) });
  }));
  app.put(`${root}/option-sources/:groupId`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    await configureOptionSource(req.params.campaignId, req.params.groupId, req.body);
    res.json({ ok: true });
  }));
  app.post(`${root}/option-sources/:groupId/waiting-option`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const { label } = z.object({ label: z.string().trim().min(1).max(180) }).strict().parse(req.body);
    res.status(201).json(await addWaitingOption(req.params.campaignId, req.params.groupId, label));
  }));
  app.delete(`${root}/option-sources/:groupId`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    await configureOptionSource(req.params.campaignId, req.params.groupId, null);
    res.json({ ok: true });
  }));
  app.put(`${root}/sources/:questionId`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    await configureBackgroundSource(req.params.campaignId, req.params.questionId, req.body);
    res.json({ ok: true });
  }));
  app.delete(`${root}/sources/:questionId`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    await configureBackgroundSource(req.params.campaignId, req.params.questionId, null);
    res.json({ ok: true });
  }));
  app.post(root, requireAuth, route(async (req, res) => {
    const user = await authorize(req, true);
    const rule = await validateWorkflow(req.params.campaignId, req.body);
    const { rows } = await pool.query(`INSERT INTO mission_status_list_rules(campaign_id,definition,created_by)
      VALUES($1,$2::jsonb,$3) RETURNING id`, [req.params.campaignId, JSON.stringify(rule), user.id]);
    res.status(201).json({ ...rule, id: rows[0].id, campaignId: req.params.campaignId });
  }));
  app.put(`${root}/:id`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const rule = await validateWorkflow(req.params.campaignId, req.body);
    const result = await pool.query(`UPDATE mission_status_list_rules SET definition=$3::jsonb,updated_at=clock_timestamp()
      WHERE id=$1 AND campaign_id=$2 RETURNING id`, [req.params.id, req.params.campaignId, JSON.stringify(rule)]);
    if (!result.rowCount) throw new StatusListWorkflowError("rule_not_found", 404);
    res.json({ ...rule, id: req.params.id, campaignId: req.params.campaignId });
  }));
  app.delete(`${root}/:id`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const result = await pool.query("DELETE FROM mission_status_list_rules WHERE id=$1 AND campaign_id=$2", [req.params.id, req.params.campaignId]);
    if (!result.rowCount) throw new StatusListWorkflowError("rule_not_found", 404);
    res.json({ ok: true });
  }));
  app.get(contactRoot, requireAuth, route(async (req, res) => {
    await authorize(req, false, req.params.campaignContactId);
    const answers = await pool.query("SELECT question_id,value FROM mission_status_list_answers WHERE campaign_contact_id=$1 AND value<>'null'::jsonb", [req.params.campaignContactId]);
    const runs = await pool.query(`SELECT r.id,r.rule_name AS "ruleName",r.branch,r.results,r.created_at AS "createdAt",u.full_name AS "actorName",r.actor_kind AS "actorKind"
      FROM mission_status_list_rule_runs r LEFT JOIN users u ON u.id=r.actor_id
      WHERE r.campaign_contact_id=$1 AND r.campaign_id=$2 ORDER BY r.created_at DESC,r.id DESC LIMIT 50`,
    [req.params.campaignContactId, req.params.campaignId]);
    const transitions = await pool.query(`SELECT id,question_id AS "questionId",question_label AS "questionLabel",target_kind AS "targetKind",
      previous_label AS "previousLabel",value_label AS "valueLabel",previous,value,baseline,created_at AS "createdAt"
      FROM mission_status_list_transitions WHERE campaign_id=$1 AND campaign_contact_id=$2 ORDER BY created_at DESC,id DESC LIMIT 50`,
    [req.params.campaignId, req.params.campaignContactId]);
    res.json({ answers: Object.fromEntries(answers.rows.map(row => [row.question_id, row.value])), transitions: transitions.rows,
      notes: await readWorkflowNotes(pool, req.params.campaignContactId),
      runs: runs.rows, catalog: await workflowCatalog(req.params.campaignId) });
  }));
  app.put(`${contactRoot}/answers/:questionId`, requireAuth, route(async (req, res) => {
    const user = await authorize(req, false, req.params.campaignContactId);
    const { value } = z.object({ value: workflowAnswerSchema.nullable() }).strict().parse(req.body);
    await saveWorkflowQuestion({ campaignId: req.params.campaignId, campaignContactId: req.params.campaignContactId,
      questionId: req.params.questionId, actorId: user.id, value });
    res.json({ ok: true });
  }));
}
