import type { Express, Request, RequestHandler } from "express";
import { z } from "zod";
import { pool } from "../db";
import { storage } from "../storage";
import { canAgentReadCampaignByWorkspaceCountry } from "./agent-workspace-country-access";
import { workflowAnswerSchema } from "../../shared/status-list-workflow";
import { saveWorkflowQuestion, StatusListWorkflowError, validateWorkflow, workflowCatalog } from "./status-list-workflow";
import { readWorkflowNotes } from "./status-list-workflow-notes";

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
      console.error("[status-list-workflow] request failed", error instanceof Error ? error.name : "unknown");
      res.status(500).json({ error: "workflow_failed" });
    }
  };
  app.get(root, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const { rows } = await pool.query("SELECT id,campaign_id,definition FROM mission_status_list_rules WHERE campaign_id=$1 ORDER BY created_at,id", [req.params.campaignId]);
    res.json({ rules: rows.map(row => ({ ...row.definition, id: row.id, campaignId: row.campaign_id })),
      catalog: await workflowCatalog(req.params.campaignId) });
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
    const runs = await pool.query(`SELECT r.id,r.rule_name AS "ruleName",r.branch,r.results,r.created_at AS "createdAt",u.full_name AS "actorName"
      FROM mission_status_list_rule_runs r LEFT JOIN users u ON u.id=r.actor_id
      WHERE r.campaign_contact_id=$1 AND r.campaign_id=$2 ORDER BY r.created_at DESC,r.id DESC LIMIT 50`,
    [req.params.campaignContactId, req.params.campaignId]);
    res.json({ answers: Object.fromEntries(answers.rows.map(row => [row.question_id, row.value])),
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
