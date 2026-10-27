import type { Express, Request, RequestHandler } from "express";
import { z } from "zod";
import { readStatusListRepresentativeInformation } from "./status-list-representative-information";
import { evaluateRepresentativeChecks } from "./status-list-representative-check";
import { pool } from "../db";
import { storage } from "../storage";
import { canAgentReadCampaignByWorkspaceCountry } from "./agent-workspace-country-access";
import { workflowAnswerSchema } from "../../shared/status-list-workflow";
import { saveWorkflowQuestion, saveWorkflowQuestions, StatusListWorkflowError, validateWorkflow, workflowCatalog } from "./status-list-workflow";
import { checkStatusListExecution } from "../../shared/status-list-execution-policy";
import { readWorkflowNotes } from "./status-list-workflow-notes";
import { readQuestionAudit, writeQuestionNote, questionNoteSchema } from "./status-list-question-audit";
import { configureBackgroundSource, createConfiguredBackgroundSource } from "./status-list-background";
import { createStatusListSourceTarget } from "./status-list-source-targets";
import { addWaitingOption, configureOptionSource } from "./status-list-option-source";
import { registerStatusListOrganizationRoutes } from "./status-list-organization-routes";
import { readTransitionInventory } from "./status-list-transition-inventory";
import { medicalPartnerAudit } from "../../shared/status-list-transition-audit";
import { CallbackTransitionError, readCallbackReadiness, switchCallbackOwner, withCallbackRuleChange } from "./status-list-callback-transition";
import { readStatusListServiceHistory } from "./status-list-service-history";
import { readTransitionExport } from "./status-list-transition-export";
import { readCallbackServiceStatus } from "./status-list-service-status";
import { readWorkflowConditionOptions } from "./status-list-workflow-condition-options";
import { readBackgroundDiagnostics } from "./status-list-background-diagnostics";
import { automaticOverview, inspectAutomaticContact, saveAutomaticConfig } from "./status-list-automatic";
import { previewStatusListConfirmation } from "./status-list-confirmation-preview";
import { statusListExecutionMode } from "../../shared/status-list-execution-policy";
import { initialScopeSchema, previewAutomaticInitial, confirmAutomaticInitial } from "./status-list-automatic-initial";
import { healthcareFacts, saveHealthcareReview, createHealthcareSource, resetHealthcareCounter } from "./status-list-healthcare";
import { readActionReviews, confirmActionReview } from "./status-list-action-review";
import { evaluateOptionSources } from "./status-list-option-source";
import { workflowTransaction, executeEvent } from "./status-list-workflow";
import { queueAutomaticSourceEvent } from "./status-list-automatic";

const admin = (user: any) => ["admin", "superadmin", "owner"].includes(user.role);
export async function authorize(req: Request, manage: boolean, contactId?: string) {
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
  app.post(`${root}/healthcare`,requireAuth,route(async(req,res)=>{
    const actor=await authorize(req,true);
    z.object({}).strict().parse(req.body);
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      const source=await createHealthcareSource(client,req.params.campaignId,actor.id);
      await client.query("COMMIT");
      res.status(201).json(source);
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }));
  app.get(`${contactRoot}/healthcare`,requireAuth,route(async(req,res)=>{
    await authorize(req,false,req.params.campaignContactId);
    const sources=(await pool.query(`SELECT group_id FROM mission_status_list_option_sources WHERE campaign_id=$1
      AND config->>'source'='healthcare_reachability' ORDER BY group_id`,[req.params.campaignId])).rows;
    const contact=(await pool.query("SELECT contact_type FROM campaign_contacts WHERE id=$1 AND campaign_id=$2",
      [req.params.campaignContactId,req.params.campaignId])).rows[0];
    if(!["clinic","hospital"].includes(contact?.contact_type)) {res.json([]);return;}
    res.json(await Promise.all(sources.map(s=>healthcareFacts(pool,req.params.campaignId,req.params.campaignContactId,s.group_id))));
  }));
  app.post(`${contactRoot}/healthcare/:groupId`,requireAuth,route(async(req,res)=>{
    const actor=await authorize(req,false,req.params.campaignContactId);
    await workflowTransaction(req.params.campaignContactId,async client=>{
      await saveHealthcareReview(client,req.params.campaignId,req.params.campaignContactId,req.params.groupId,actor.id,req.body);
      for(const event of await evaluateOptionSources(client,req.params.campaignContactId)) {
        await executeEvent(client,event);await queueAutomaticSourceEvent(client,event);
      }
    });
    res.json({ok:true});
  }));
  app.post(`${contactRoot}/healthcare/:groupId/reset-counter`,requireAuth,route(async(req,res)=>{
    const actor=await authorize(req,false,req.params.campaignContactId);
    await workflowTransaction(req.params.campaignContactId,async client=>{
      await resetHealthcareCounter(client,req.params.campaignId,req.params.campaignContactId,req.params.groupId,actor.id,req.body);
      // Establish a fresh baseline, never send effects solely because of reset.
      await client.query(`UPDATE mission_status_list_option_source_state SET config_revision='counter-reset'
        WHERE campaign_contact_id=$1 AND group_id=$2`,
        [req.params.campaignContactId,req.params.groupId]);
      for(const event of await evaluateOptionSources(client,req.params.campaignContactId)) {
        await executeEvent(client,event);await queueAutomaticSourceEvent(client,event);
      }
    });
    res.json({ok:true});
  }));
  app.get(`${contactRoot}/action-reviews`,requireAuth,route(async(req,res)=>{
    const actor=await authorize(req,false,req.params.campaignContactId);
    res.json(await readActionReviews(pool,req.params.campaignId,req.params.campaignContactId,actor.id));
  }));
  app.post(`${contactRoot}/action-reviews/:eventId`,requireAuth,route(async(req,res)=>{
    const actor=await authorize(req,false,req.params.campaignContactId);
    const body=z.object({fingerprint:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(req.body);
    await workflowTransaction(req.params.campaignContactId,client=>confirmActionReview(client,req.params.campaignId,
      req.params.campaignContactId,actor.id,req.params.eventId,body.fingerprint));
    res.json({ok:true});
  }));
  app.post(`${contactRoot}/representative-check`, requireAuth, route(async (req, res) => {
    const actor = await authorize(req, false, req.params.campaignContactId);
    const payload = z.object({
      trigger: z.enum(["card_open", "pulse_open", "background_change"]),
      statusOnly: z.boolean().optional(),
      confirm: z.object({ questionId: z.string().min(1).max(100), fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }).strict().optional(),
    }).strict().parse(req.body);
    if (payload.confirm && payload.statusOnly) throw new StatusListWorkflowError("invalid_rule", 400);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await evaluateRepresentativeChecks(client, req.params.campaignId, req.params.campaignContactId,
        { ...payload, actorId: actor.id });
      await client.query("COMMIT");
      res.json(result);
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }));
  app.post(`${root}/source-targets`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const target = await createStatusListSourceTarget(client, req.params.campaignId, req.body);
      await client.query("COMMIT");
      res.status(201).json(target);
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }));
  app.post(`${root}/sources`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const target = await createConfiguredBackgroundSource(client, req.params.campaignId, req.body);
      await client.query("COMMIT");
      res.status(201).json(target);
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }));
  app.post(`${contactRoot}/confirmation-preview`, requireAuth, route(async(req,res)=>{
    const actor=await authorize(req,false,req.params.campaignContactId);
    const client=await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await client.query("SET LOCAL statement_timeout='10s'");
      const preview=await previewStatusListConfirmation(client,req.params.campaignId,req.params.campaignContactId,actor.id,req.body);
      await client.query("COMMIT");res.json(preview);
    } catch(error) { await client.query("ROLLBACK");throw error; }
    finally {client.release();}
  }));
  const initialRoot=`${root}/automatic-items/:itemId`;
  app.post(`${initialRoot}/initial-preview`,requireAuth,route(async(req,res)=>{
    const actor=await authorize(req,true);
    const scope=initialScopeSchema.parse(req.body);
    if(scope.scope==="contact")await authorize(req,true,scope.contactId);
    const client=await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await client.query("SET LOCAL statement_timeout='15s'");
      const plan=await previewAutomaticInitial(client,req.params.campaignId,req.params.itemId,scope,actor.id);
      await client.query("COMMIT");res.json(plan);
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }));
  app.post(`${initialRoot}/initial-confirm`,requireAuth,route(async(req,res)=>{
    const actor=await authorize(req,true);
    const payload=z.object({scope:z.enum(["mission","contact"]),contactId:z.string().uuid().optional(),
      fingerprint:z.string().regex(/^[a-f0-9]{64}$/),acknowledged:z.literal(true)}).strict().parse(req.body);
    const scope=initialScopeSchema.parse({scope:payload.scope,...(payload.contactId ? {contactId:payload.contactId} : {})});
    if(scope.scope==="contact")await authorize(req,true,scope.contactId);
    const client=await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      await client.query("SET LOCAL statement_timeout='15s'");
      const result=await confirmAutomaticInitial(client,req.params.campaignId,req.params.itemId,scope,actor.id,payload.fingerprint);
      await client.query("COMMIT");res.json(result);
    }catch(error) {
      await client.query("ROLLBACK");
      if((error as any)?.code==="40001")throw new StatusListWorkflowError("preview_changed",409);
      throw error;
    }finally{client.release();}
  }));
  app.get(`${root}/automatic-items/:itemId`, requireAuth, route(async (req, res) => {
    await authorize(req,true);
    const result=await automaticOverview(pool,req.params.campaignId,req.params.itemId);
    if (!result) throw new StatusListWorkflowError("item_not_found",404);
    res.json(result);
  }));
  app.put(`${root}/automatic-items/:itemId`, requireAuth, route(async (req, res) => {
    await authorize(req,true);
    try { await saveAutomaticConfig(req.params.campaignId,req.params.itemId,req.body); }
    catch (error) {
      if (error instanceof z.ZodError) throw error;
      const code=error instanceof Error ? error.message : "invalid_config";
      if (["config_changed","agent_cannot_confirm","no_actions","unsupported_action","use_system_source_rules"].includes(code))
        throw new StatusListWorkflowError(code,409);
      if (code==="item_not_found") throw new StatusListWorkflowError(code,404);
      throw error;
    }
    res.json(await automaticOverview(pool,req.params.campaignId,req.params.itemId));
  }));
  app.get(`${root}/automatic-contacts`,requireAuth,route(async(req,res)=>{
    await authorize(req,true);
    const { search }=z.object({search:z.string().trim().max(120).default("")}).parse(req.query);
    // An admin chooses an exact Mission membership, not an address match across Missions.
    const rows=(await pool.query(`SELECT cc.id,
      coalesce(CASE cc.contact_type WHEN 'clinic' THEN cl.name WHEN 'hospital' THEN h.name
        WHEN 'collaborator' THEN concat_ws(' ',co.first_name,co.last_name)
        ELSE concat_ws(' ',cu.first_name,cu.last_name) END,'—') AS label
      FROM campaign_contacts cc
      LEFT JOIN clinics cl ON cl.id=cc.clinic_id LEFT JOIN hospitals h ON h.id=cc.hospital_id
      LEFT JOIN collaborators co ON co.id=cc.collaborator_id LEFT JOIN customers cu ON cu.id=cc.customer_id
      WHERE cc.campaign_id=$1 AND ($2='' OR coalesce(CASE cc.contact_type
        WHEN 'clinic' THEN cl.name WHEN 'hospital' THEN h.name
        WHEN 'collaborator' THEN concat_ws(' ',co.first_name,co.last_name)
        ELSE concat_ws(' ',cu.first_name,cu.last_name) END,'') ILIKE '%'||$2||'%')
      ORDER BY label,cc.id LIMIT 30`,[req.params.campaignId,search])).rows;
    res.json({contacts:rows});
  }));
  app.post(`${contactRoot}/automatic-preview`,requireAuth,route(async(req,res)=>{
    await authorize(req,true,req.params.campaignContactId);
    const {itemId}=z.object({itemId:z.string().uuid()}).strict().parse(req.body);
    const client=await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await client.query("SET LOCAL statement_timeout='10s'");
      const result=await inspectAutomaticContact(client,req.params.campaignId,req.params.campaignContactId,itemId);
      await client.query("COMMIT");
      res.json(result);
    } catch(error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }));
  app.post(`${contactRoot}/automatic-open`,requireAuth,route(async(req,res)=>{
    const actor=await authorize(req,false,req.params.campaignContactId);
    const {executionMode,commit,source}=z.object({
      executionMode:z.enum(["immediate","batch"]),commit:z.boolean().optional(),
      source:z.enum(["card_open","pulse_open"]).default("card_open"),
    }).strict().parse(req.body);
    const campaignId=req.params.campaignId,contactId=req.params.campaignContactId;
    const settings=(await pool.query("SELECT settings FROM campaigns WHERE id=$1",[campaignId])).rows[0]?.settings;
    const mode=statusListExecutionMode(settings);
    if (mode!==executionMode || (mode==="immediate" && commit))
      throw new StatusListWorkflowError("execution_mode_mismatch",409);
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`${campaignId}:${contactId}:automatic-open`]);
      const ids=(await client.query(`SELECT item_id,trigger FROM mission_status_list_automatic_configs
        WHERE campaign_id=$1 AND (trigger=$2 OR $3 AND trigger IN ('card_open','pulse_open'))
        AND enabled=true ORDER BY item_id`,[campaignId,source,commit===true])).rows;
      const results=[];
      for(const row of ids)results.push(await inspectAutomaticContact(client,campaignId,contactId,row.item_id,
        {enqueue:mode==="immediate" || commit===true,
          trigger:commit ? row.trigger : source,
          actorId:actor.id,batchCommit:commit===true}));
      if(mode==="batch" && commit===true) await client.query(`UPDATE mission_status_list_automatic_events
        SET state='pending' WHERE campaign_id=$1 AND campaign_contact_id=$2 AND state='awaiting_batch'`,
      [campaignId,contactId]);
      const deferredRows=(await client.query(`SELECT automation_id FROM mission_status_list_automatic_events
        WHERE campaign_id=$1 AND campaign_contact_id=$2 AND state='awaiting_batch'
        AND NOT (event_context ? 'representativeCheck')`,[campaignId,contactId])).rows;
      const deferredIds=new Set(deferredRows.map((row:any)=>row.automation_id));
      const candidateCount=results.reduce((n,result)=>n+result.actions.filter(action=>
        action.status==="batch_deferred" && !deferredIds.has(action.id)).length,0);
      const deferredCount=deferredRows.length;
      const pendingCount=deferredCount+candidateCount;
      await client.query("COMMIT");res.json({results,pendingCount,candidateCount,deferredCount});
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }));
  app.get(`${root}/background-diagnostics`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      await client.query("SET LOCAL statement_timeout='10s'");
      const result = await readBackgroundDiagnostics(client, req.params.campaignId);
      await client.query("COMMIT");
      res.json(result);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }));
  app.get(`${root}/condition-options`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    res.json(await readWorkflowConditionOptions(pool, req.params.campaignId, req.query));
  }));
  app.get(`${root}/contact-types`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const rows = (await pool.query(`SELECT DISTINCT coalesce(contact_type,'customer') AS type
      FROM campaign_contacts WHERE campaign_id=$1 ORDER BY type`, [req.params.campaignId])).rows;
    res.json({ contactTypes: rows.map(row => row.type).filter(type =>
      ["clinic", "hospital", "customer", "collaborator"].includes(type)) });
  }));
  app.get(`${root}/transition-runtime`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    res.json(await readCallbackServiceStatus(pool, req.params.campaignId));
  }));
  app.get(`${root}/transition-export`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const client = await pool.connect();
    try {
      const evidence = await readTransitionExport(client, req.params.campaignId);
      res.setHeader("Content-Disposition", 'attachment; filename="status-list-inventory.json"');
      res.json(evidence);
    } finally { client.release(); }
  }));
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
  app.get(`${root}/service-history`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const { automationId } = z.object({ automationId: z.string().uuid().optional() }).parse(req.query);
    res.json(await readStatusListServiceHistory(pool, req.params.campaignId, automationId));
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
    const { rows } = await pool.query(`SELECT s.question_id AS "questionId",s.source,q.is_hidden AS hidden,s.show_information AS "showInformation",s.check_config AS "check"
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
    const { rows } = await withCallbackRuleChange(req.params.campaignId, client =>
      client.query(`INSERT INTO mission_status_list_rules(campaign_id,definition,created_by)
      VALUES($1,$2::jsonb,$3) RETURNING id`, [req.params.campaignId, JSON.stringify(rule), user.id]));
    res.status(201).json({ ...rule, id: rows[0].id, campaignId: req.params.campaignId });
  }));
  app.put(`${root}/:id`, requireAuth, route(async (req, res) => {
    await authorize(req, true);
    const rule = await validateWorkflow(req.params.campaignId, req.body);
    const result = await withCallbackRuleChange(req.params.campaignId, client =>
      client.query(`UPDATE mission_status_list_rules SET definition=$3::jsonb,updated_at=clock_timestamp()
      WHERE id=$1 AND campaign_id=$2 RETURNING id`, [req.params.id, req.params.campaignId, JSON.stringify(rule)]));
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
    const executionIssues = (await pool.query(`SELECT r.automation_id AS "automationId",r.event_key AS "eventKey",
      r.status,r.created_at AS "createdAt",i.label AS "itemLabel"
      FROM status_list_effect_receipts r
      LEFT JOIN campaign_status_list_automations a ON a.id=r.automation_id
      LEFT JOIN campaign_status_list_items i ON i.id=a.status_list_item_id
      WHERE r.campaign_contact_id=$1 AND (r.status='failed' OR
        (r.status='running' AND r.created_at < now()-interval '2 minutes'))
      ORDER BY r.created_at DESC LIMIT 30`, [req.params.campaignContactId])).rows;
    res.json({ ...await readQuestionAudit(pool, req.params.campaignId, req.params.campaignContactId),
      answers: Object.fromEntries(answers.rows.map(row => [row.question_id, row.value])), transitions: transitions.rows, executionIssues,
      notes: await readWorkflowNotes(pool, req.params.campaignContactId),
      runs: runs.rows, catalog: await workflowCatalog(req.params.campaignId),
      representativeInformation: await readStatusListRepresentativeInformation(pool, req.params.campaignId, req.params.campaignContactId),
      representativeChecks: (await pool.query(`SELECT question_id AS "questionId",check_config AS config
        FROM mission_status_list_sources WHERE campaign_id=$1 AND jsonb_typeof(check_config)='object'`,
      [req.params.campaignId])).rows });
  }));
  app.patch(`${contactRoot}/answers/:questionId/note`, requireAuth, route(async (req, res) => {
    const user = await authorize(req, false, req.params.campaignContactId);
    const { note } = questionNoteSchema.parse(req.body);
    const editable = (await pool.query(`SELECT q.note_enabled FROM campaign_status_list_questions q
      JOIN campaign_status_list_items i ON i.id=q.item_id
      WHERE q.id=$1 AND i.campaign_id=$2`, [req.params.questionId,req.params.campaignId])).rows[0];
    if (!editable) throw new StatusListWorkflowError("question_not_found",404);
    if (editable.note_enabled === false) throw new StatusListWorkflowError("question_note_disabled",409);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await writeQuestionNote(client, { campaignId: req.params.campaignId,
        contactId: req.params.campaignContactId, questionId: req.params.questionId, actorId: user.id, note });
      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }));
  app.put(`${contactRoot}/answers`, requireAuth, route(async (req, res) => {
    const user = await authorize(req, false, req.params.campaignContactId);
    const body = z.object({
      requestId: z.string().uuid(), executionMode: z.enum(["immediate", "batch"]), commit: z.boolean(),
      changes: z.array(z.object({ questionId: z.string().min(1), expected: workflowAnswerSchema.nullable(),
        value: workflowAnswerSchema.nullable() }).strict()).min(1).max(200),
    }).strict().parse(req.body);
    const settings = (await pool.query("SELECT settings FROM campaigns WHERE id=$1", [req.params.campaignId])).rows[0]?.settings;
    try { checkStatusListExecution(settings, body); }
    catch (error) { throw new StatusListWorkflowError((error as Error).message, 409); }
    const events = await saveWorkflowQuestions({ ...body, actorId: user.id,
      campaignId: req.params.campaignId, campaignContactId: req.params.campaignContactId });
    const serviceActions = [];
    for (const event of events) serviceActions.push(...await (await import("./status-list-native-service")).executeStatusListQuestionNativeServices({
      campaignId: req.params.campaignId, campaignContactId: req.params.campaignContactId,
      questionId: event.questionId, userId: user.id, confirmationId: `answer:${event.revision}`,
    }));
    res.json({ ok: serviceActions.every(result => result.ok !== false), saved: true, serviceActions });
  }));
  app.put(`${contactRoot}/answers/:questionId`, requireAuth, route(async (req, res) => {
    const user = await authorize(req, false, req.params.campaignContactId);
    const settings = (await pool.query("SELECT settings FROM campaigns WHERE id=$1", [req.params.campaignId])).rows[0]?.settings;
    try { checkStatusListExecution(settings, {}); }
    catch (error) { throw new StatusListWorkflowError((error as Error).message, 409); }
    const { value } = z.object({ value: workflowAnswerSchema.nullable() }).strict().parse(req.body);
    const change = await saveWorkflowQuestion({ campaignId: req.params.campaignId, campaignContactId: req.params.campaignContactId,
      questionId: req.params.questionId, actorId: user.id, value });
    const serviceActions = change ? await (await import("./status-list-native-service")).executeStatusListQuestionNativeServices({
      campaignId: req.params.campaignId, campaignContactId: req.params.campaignContactId,
      questionId: req.params.questionId, userId: user.id, confirmationId: `answer:${change.revision}`,
    }) : [];
    res.json({ ok: true, serviceActions });
  }));
}
