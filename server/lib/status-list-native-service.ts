import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { statusListNativeActionIssues, statusListNativeActionType } from "../../shared/status-list-service-config";
import { STATUS_LIST_RECORD_DB_KEYS, statusListRecordValues } from "../../shared/status-list-template-context";

type Query = (sql: string, params?: any[]) => Promise<{ rows: any[]; rowCount?: number | null }>;
type Input = {
  campaignId: string; campaignContactId: string; itemId: string; userId: string;
  confirmationId?: string; requestId?: string;
};
type Dependencies = {
  query: Query;
  execute: (type: any, config: Record<string, unknown>, context: any, runId: string) => Promise<any>;
  condition?: (automation: any, context: any) => Promise<boolean>;
};
const defaults: Dependencies = {
  query: async (sql, params) => (await import("../db")).pool.query(sql, params),
  execute: async (...args) => (await import("./automation-engine")).executeSharedServiceAction(...args),
  condition: async (...args) => (await import("./condition-evaluator")).evaluateAutomationCondition(...args),
};
const admin = (role: string) => ["admin", "superadmin", "owner"].includes(role);
const codes = (values: unknown): string[] => Array.isArray(values)
  ? values.filter((v): v is string => typeof v === "string").map(v => v.toUpperCase()) : [];
export const canManageNativeMission = (user: any, countries: unknown) =>
  user?.isActive !== false && (admin(user?.role) || (user?.role === "manager" &&
    codes(countries).length > 0 && codes(countries).every(code => codes(user.assignedCountries).includes(code))));

/** Runs only on service-action definition writes; agent confirmation is untouched. */
export function createStatusListServiceWriteGuard(deps: {
  query: Query; gateway: (campaignId: string) => Promise<string | null>;
  validateUpdate?: (config: any, sourceType: string, owner: any, countries: string[]) => Promise<void>;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).session?.user;
    if (!user) return res.status(401).json({ error: "unauthorized" });
    const [source] = (await deps.query(
      `SELECT c.country_codes FROM campaigns c JOIN campaign_status_list_items i
       ON i.campaign_id=c.id WHERE c.id=$1 AND i.id=$2`, [req.params.campaignId, req.params.itemId])).rows;
    if (!source) return res.status(404).json({ error: "Status List item not found" });
    if (!canManageNativeMission(user, source.country_codes)) return res.status(403).json({ error: "forbidden" });
    if (req.method === "DELETE") return next();
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).json({ error: "Invalid action" });
    let existing: any;
    if (req.params.autoId) {
      [existing] = (await deps.query(
        `SELECT action_type,service_action_config,service_action_owner_id FROM campaign_status_list_automations
         WHERE id=$1 AND status_list_item_id=$2`, [req.params.autoId, req.params.itemId])).rows;
      if (!existing) return res.status(404).json({ error: "Automation not found" });
    }
    const config = Object.prototype.hasOwnProperty.call(body, "serviceActionConfig")
      ? body.serviceActionConfig : existing?.service_action_config;
    const type = body.actionType ?? existing?.action_type;
    const issues = statusListNativeActionIssues(type, config);
    if (issues.length) return res.status(400).json({ error: "Invalid service action", issues });
    if (type === "update_record") {
      try {
        // Mission memberships may contain different entity types. The actual
        // event target is checked again against the persisted membership at run time.
        await deps.validateUpdate?.(config, config.target.entityType, user, source.country_codes);
      } catch {
        return res.status(400).json({ error: "Invalid or unauthorized record update" });
      }
    }
    // The client cannot select another user's personal mailbox by forging an ID.
    body.serviceActionOwnerId = config == null ? null :
      !existing || existing.action_type !== type || JSON.stringify(config) !== JSON.stringify(existing.service_action_config)
        ? user.id : existing.service_action_owner_id;
    if (type === "send_sms" && config) {
      const gateway = await deps.gateway(req.params.campaignId);
      if (gateway && config.provider && config.provider !== "default" && config.provider !== gateway)
        return res.status(400).json({ error: "SMS gateway conflicts with Mission settings" });
    }
    next();
  } catch {
    res.status(500).json({ error: "Could not validate Status List action" });
  }
  };
}
export const authorizeStatusListServiceWrite = createStatusListServiceWriteGuard({
  query: defaults.query,
  gateway: async id => (await import("./sms-provider")).getCampaignSmsProvider(id),
  validateUpdate: async (...args) => (await import("./automation-update-record")).validateSavedUpdateRecord(...args),
});

/** Readiness uses the saved sender identity, with the same Mission write scope. */
export async function resolveStatusListServiceAuthor(actionId: string, viewer: any, deps: Pick<Dependencies, "query"> = defaults) {
  const [row] = (await deps.query(`SELECT a.service_action_owner_id AS owner_id,c.country_codes
    FROM campaign_status_list_automations a
    JOIN campaign_status_list_items i ON i.id=a.status_list_item_id
    JOIN campaigns c ON c.id=i.campaign_id WHERE a.id=$1`, [actionId])).rows;
  if (!row) return { status: 404 as const, error: "Action not found" };
  if (!canManageNativeMission(viewer, row.country_codes)) return { status: 403 as const, error: "forbidden" };
  return { status: 200 as const, ownerId: row.owner_id || viewer.id };
}

/** Persisted identity only. No browser-supplied contact, country, owner or sender. */
export async function executeStatusListNativeService(automation: any, input: Input, deps = defaults) {
  const type = statusListNativeActionType(automation.actionType);
  const issues = statusListNativeActionIssues(automation.actionType, automation.serviceActionConfig);
  if (!type || !automation.serviceActionConfig || issues.length)
    return { ok: false, error: "invalid_service_configuration" };
  const [source] = (await deps.query(`
    SELECT c.name AS campaign_name,c.country_codes AS mission_countries,c.settings AS mission_settings,
      cc.contact_type,a.question_id,qa.value AS question_value,qa.revision AS answer_revision,
      (SELECT jsonb_object_agg(f.key,f.value) FROM jsonb_each(
        CASE coalesce(cc.contact_type,'customer') WHEN 'clinic' THEN to_jsonb(cl) WHEN 'hospital' THEN to_jsonb(h)
          WHEN 'customer' THEN to_jsonb(cu) ELSE '{}'::jsonb END) f
        WHERE f.key=ANY($5::text[])) AS template_fields,
      cc.status AS source_status,cc.assigned_to AS source_assigned_to,
      cc.created_at AS source_created_at,cc.updated_at AS source_updated_at,
      cc.callback_date AS source_due_date,
      CASE cc.contact_type WHEN 'clinic' THEN cl.id WHEN 'hospital' THEN h.id
        WHEN 'collaborator' THEN co.id ELSE cu.id END AS entity_id,
      CASE cc.contact_type WHEN 'clinic' THEN cl.country_code WHEN 'hospital' THEN h.country_code
        WHEN 'collaborator' THEN co.country_code ELSE cu.country END AS country,
      CASE cc.contact_type WHEN 'clinic' THEN cl.name WHEN 'hospital' THEN h.name
        WHEN 'collaborator' THEN concat_ws(' ',co.first_name,co.last_name)
        ELSE concat_ws(' ',cu.first_name,cu.last_name) END AS name,
      CASE cc.contact_type WHEN 'clinic' THEN cl.email WHEN 'hospital' THEN h.email
        WHEN 'collaborator' THEN co.email ELSE cu.email END AS email,
      CASE cc.contact_type WHEN 'clinic' THEN cl.phone WHEN 'hospital' THEN h.phone
        WHEN 'collaborator' THEN co.mobile ELSE cu.phone END AS phone,
      CASE cc.contact_type WHEN 'collaborator' THEN co.first_name ELSE cu.first_name END AS first_name,
      CASE cc.contact_type WHEN 'collaborator' THEN co.last_name ELSE cu.last_name END AS last_name
    FROM campaign_contacts cc JOIN campaigns c ON c.id=cc.campaign_id
    JOIN campaign_status_list_items i ON i.campaign_id=c.id AND i.id=$3
    JOIN campaign_status_list_automations a ON a.status_list_item_id=i.id AND a.id=$4
    LEFT JOIN mission_status_list_answers qa ON qa.campaign_contact_id=cc.id AND qa.question_id=a.question_id
    LEFT JOIN clinics cl ON cl.id=cc.clinic_id AND cc.contact_type='clinic'
    LEFT JOIN hospitals h ON h.id=cc.hospital_id AND cc.contact_type='hospital'
    LEFT JOIN collaborators co ON co.id=cc.collaborator_id AND cc.contact_type='collaborator'
    LEFT JOIN customers cu ON cu.id=cc.customer_id AND (cc.contact_type='customer' OR cc.contact_type IS NULL)
    WHERE cc.id=$1 AND c.id=$2`,
   [input.campaignContactId, input.campaignId, input.itemId, automation.id, STATUS_LIST_RECORD_DB_KEYS])).rows;
  if (!source?.entity_id) return { ok: false, error: "service_source_not_found" };
  if (type === "update_entity" && automation.serviceActionConfig.target.mode === "event" &&
      automation.serviceActionConfig.target.entityType !== (source.contact_type || "customer"))
    return { ok: false, error: "service_record_target_mismatch" };
  const [owner] = (await deps.query(
     `SELECT id,role,assigned_countries AS "assignedCountries",is_active AS "isActive",
        to_jsonb(u)->>'full_name' AS "fullName",to_jsonb(u)->>'email' AS email,
        concat_ws('',to_jsonb(u)->>'phone_prefix',to_jsonb(u)->>'phone') AS phone,
        to_jsonb(u)->>'position' AS position
      FROM users u WHERE id=$1`, [automation.serviceActionOwnerId])).rows;
  if (!owner || !canManageNativeMission(owner, source.mission_countries))
    return { ok: false, error: "service_owner_not_authorized" };
  const country = source.country?.toUpperCase() || (codes(source.mission_countries).length === 1 ? codes(source.mission_countries)[0] : null);
  if (!country || (codes(source.mission_countries).length > 0 && !codes(source.mission_countries).includes(country)))
    return { ok: false, error: "service_country_unresolved" };
  if (source.question_id && source.question_value == null)
    return { ok: false, error: "service_answer_missing" };
  if (source.question_id && input.confirmationId?.startsWith("answer:") &&
      input.confirmationId !== `answer:${source.answer_revision}`)
    return { ok: true, skipped: true, status: "answer_superseded" };
  if (automation.conditionField === "answer") {
    const normalize = (value: unknown) => {
      const text = String(value ?? "").trim().toLowerCase();
      return ["yes", "1", "true"].includes(text) ? "true" : ["no", "0", "false"].includes(text) ? "false" : text;
    };
    if (!source.question_id || normalize(source.question_value) !== normalize(automation.conditionValue))
      return { ok: true, skipped: true, status: "condition_false" };
  } else if ((automation.conditionField || automation.conditionJson) && deps.condition &&
      !await deps.condition(automation, { contactId: source.entity_id, campaignId: input.campaignId,
        agentId: input.userId, contactCountry: country })) {
    return { ok: true, skipped: true, status: "condition_false" };
  }
  let settings = source.mission_settings;
  if (typeof settings === "string") { try { settings = JSON.parse(settings); } catch { settings = null; } }
  if (type === "send_sms" && settings?.smsProvider && automation.serviceActionConfig.provider &&
      !["default", settings.smsProvider].includes(automation.serviceActionConfig.provider))
    return { ok: false, error: "service_gateway_conflict" };
  const contact = {
    id: source.entity_id, type: source.contact_type || "customer", name: source.name || "",
    firstName: source.first_name || "", lastName: source.last_name || "",
    email: source.email || "", phone: source.phone || "", country, countryCode: country,
  };
  const record = statusListRecordValues(contact.type, source.template_fields || {});
  const values = { ...record, ...contact, campaignId: input.campaignId, campaignContactId: input.campaignContactId,
    title: contact.name, status: source.source_status || "",
    assignedUserId: source.source_assigned_to || "",
    createdAt: source.source_created_at || "", updatedAt: source.source_updated_at || "",
    dueDate: source.source_due_date || "",
    customerId: contact.type === "customer" ? contact.id : "",
    priority: type === "assign_task" ? automation.serviceActionConfig.priority || "medium" : "",
    ...(source.question_id ? { answer: source.question_value, questionId: source.question_id } : {}) };
  const context = {
    statusListService: true,
    statusList: { itemId: input.itemId, campaignId: input.campaignId, campaignContactId: input.campaignContactId },
    rule: { createdByUserId: owner.id, countryCodes: codes(source.mission_countries) },
    event: { id: input.confirmationId || input.requestId || randomUUID(), module: contact.type,
      source: "status_list", eventType: "status_list.service_action", entityType: contact.type, entityId: contact.id, countryCode: country,
      actorUserId: input.userId, newValues: values, oldValues: {}, createdAt: new Date() },
    newValues: values, oldValues: {}, contact,
     ...(["clinic", "hospital", "customer"].includes(contact.type)
       ? { [contact.type]: { ...record, id: contact.id } } : {}),
    campaign: { id: input.campaignId, name: source.campaign_name },
     user: { id: owner.id, fullName: owner.fullName || "", email: owner.email || "", phone: owner.phone || "", position: owner.position || "" },
     actorUserId: input.userId, countryCode: country, entityId: contact.id,
  };
  const triggerKey = input.confirmationId ? `confirmation:${input.confirmationId}` :
    input.requestId ? `manual:${input.requestId}` : `invocation:${randomUUID()}`;
  // Reserve before external effects. A crash after provider acceptance must never
  // cause the same confirmation/request to send a second copy.
  const [run] = (await deps.query(`
    INSERT INTO status_list_service_executions
      (campaign_id,campaign_contact_id,automation_id,actor_id,owner_id,trigger_key,action_type,status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
    ON CONFLICT (campaign_contact_id,automation_id,trigger_key) DO NOTHING RETURNING id`,
  [input.campaignId, input.campaignContactId, automation.id, input.userId, owner.id, triggerKey, automation.actionType])).rows;
  if (!run) {
    const [prior] = (await deps.query(`SELECT status,result FROM status_list_service_executions
      WHERE campaign_contact_id=$1 AND automation_id=$2 AND trigger_key=$3`,
    [input.campaignContactId, automation.id, triggerKey])).rows;
    return { ok: prior?.status === "succeeded", duplicate: true, status: prior?.status || "pending" };
  }
  let result: any;
  try {
    result = await deps.execute(type, {
      ...automation.serviceActionConfig,
      countryCode: country, country,
      createdByUserId: input.userId, entityType: contact.type, entityId: contact.id,
      relatedEntityType: type === "create_task" ? "status_list_item" : contact.type,
      relatedEntityId: type === "create_task" ? input.itemId : contact.id,
      customerId: contact.type === "customer" ? contact.id : null,
    }, context, run.id);
  } catch {
    result = { ok: false };
  }
  const output: Record<string, unknown> = {};
  for (const key of ["taskId", "taskIds", "taskCount", "notifiedUsers", "sentCount", "failedCount", "recipientCount", "provider", "senderMode", "toCount", "ccCount", "bccCount"])
    if (result?.output?.[key] !== undefined) output[key] = result.output[key];
  const safe = { ok: result?.ok === true, ...(result?.ok === true ? {} : { error: "service_action_failed" }), output };
  await deps.query(`UPDATE status_list_service_executions SET status=$2,result=$3::jsonb,finished_at=now() WHERE id=$1`,
    [run.id, safe.ok ? "succeeded" : "failed", JSON.stringify(safe)]);
  return { ...safe, executionId: run.id };
}

/** Called after the answer transaction commits, never while holding its lock. */
export async function executeStatusListQuestionNativeServices(input: Omit<Input, "itemId"> & { questionId: string }, deps = defaults) {
  const actions = (await deps.query(`SELECT a.id,a.status_list_item_id AS "itemId",
      a.action_type AS "actionType",a.service_action_config AS "serviceActionConfig",
      a.service_action_owner_id AS "serviceActionOwnerId",a.condition_field AS "conditionField",
      a.condition_value AS "conditionValue",a.condition_operator AS "conditionOperator",a.condition_json AS "conditionJson"
    FROM campaign_status_list_automations a JOIN campaign_status_list_questions q ON q.id=a.question_id
    JOIN campaign_status_list_items i ON i.id=q.item_id AND i.id=a.status_list_item_id
    WHERE q.id=$1 AND i.campaign_id=$2 AND a.service_action_config IS NOT NULL ORDER BY a.sort_order,a.id`,
  [input.questionId, input.campaignId])).rows;
  const results = [];
  for (const action of actions) results.push(await executeStatusListNativeService(action, { ...input, itemId: action.itemId }, deps));
  return results;
}
