import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { representativeCheckSchema, type RepresentativeCheckResult } from "../../shared/status-list-representative-check";
import { readStatusListRepresentativeInformation } from "./status-list-representative-information";
import { automaticActionIssues, loadAutomaticActions } from "./status-list-automatic";
import { automaticCondition } from "../../shared/status-list-automatic";
import { loadStatusListHistoryFacts } from "./status-list-history";
import { statusListExecutionMode } from "../../shared/status-list-execution-policy";
import { taskTargetLabel } from "./status-list-confirmation-preview";
import { StatusListWorkflowError } from "./status-list-workflow";

type Reader = Pick<PoolClient, "query">;
const stable = (value: unknown): string => JSON.stringify(value, (_, v) =>
  v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const hash = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");

/** Caller holds the exact Mission/contact transaction lock. Preview never sends effects.
 * The persisted absence episode survives config edits/reopens; ended assignments also
 * distinguish an assignment cycle that happened between two evaluations.
 */
export async function evaluateRepresentativeChecks(client: Reader, campaignId: string, contactId: string, options: {
  trigger: "card_open" | "pulse_open" | "background_change";
  actorId?: string; confirm?: { questionId: string; fingerprint: string };
  statusOnly?: boolean;
}): Promise<RepresentativeCheckResult> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`representative-check:${campaignId}:${contactId}`]);
  const configs = (await client.query(`SELECT s.question_id,s.check_config,s.check_revision,q.item_id
    FROM mission_status_list_sources s JOIN campaign_status_list_questions q ON q.id=s.question_id
    JOIN campaign_status_list_items i ON i.id=q.item_id AND i.campaign_id=s.campaign_id
    WHERE s.campaign_id=$1 AND s.source='representative_assigned' AND s.show_information
      AND jsonb_typeof(s.check_config)='object' ORDER BY s.question_id`, [campaignId])).rows;
  if (!configs.some(source=>source.check_config.enabled)) {
    if (!(await client.query("SELECT 1 FROM campaign_contacts WHERE id=$1 AND campaign_id=$2", [contactId,campaignId])).rows.length)
      throw new StatusListWorkflowError("contact_not_found",404);
    return {information:[],reviews:[]};
  }
  const context = (await client.query(`SELECT c.settings,c.country_codes,cc.contact_type,
    CASE cc.contact_type WHEN 'clinic' THEN cl.country_code WHEN 'hospital' THEN h.country_code ELSE NULL END AS country,
    (SELECT coalesce(max(valid_to)::text,'initial') FROM (
      SELECT valid_to FROM clinic_representative_assignments WHERE cc.contact_type='clinic' AND clinic_id=cc.clinic_id AND valid_to<=now()
      UNION ALL SELECT valid_to FROM hospital_representative_assignments WHERE cc.contact_type='hospital' AND hospital_id=cc.hospital_id AND valid_to<=now()
    ) history) AS assignment_version
    FROM campaign_contacts cc JOIN campaigns c ON c.id=cc.campaign_id
    LEFT JOIN clinics cl ON cl.id=cc.clinic_id AND cc.contact_type='clinic'
    LEFT JOIN hospitals h ON h.id=cc.hospital_id AND cc.contact_type='hospital'
    WHERE cc.id=$1 AND cc.campaign_id=$2`, [contactId, campaignId])).rows[0];
  if (!context) throw new StatusListWorkflowError("contact_not_found", 404);
  const mode = statusListExecutionMode(context.settings);
  const country = context.country?.toUpperCase() || (context.country_codes?.length === 1 ? context.country_codes[0]?.toUpperCase() : null);
  const countryOkay = country && (!context.country_codes?.length || context.country_codes.some((c: string) => c.toUpperCase() === country));
  const information = await readStatusListRepresentativeInformation(client, campaignId, contactId);
  const result: RepresentativeCheckResult = { information: [], reviews: [] };
  let confirmed = false;
  for (const source of configs) {
    const config = representativeCheckSchema.parse(source.check_config);
    if (!config.enabled) continue;
    const info = information.find(row => row.questionId === source.question_id);
    if (!info) continue;
    const old = (await client.query(`SELECT state,episode,assignment_version,actionable FROM mission_status_list_representative_states
      WHERE campaign_contact_id=$1 AND question_id=$2`, [contactId, source.question_id])).rows[0];
    const version = context.assignment_version || "initial";
    const newAbsence = info.state === "unassigned" && (old?.state === "assigned" || old && old.assignment_version !== version);
    const newAssignment = !!old && info.state === "assigned" && (old.state !== "assigned" || old.assignment_version !== version);
    // Assigned branches are explicitly opt-in. Existing definitions retain their
    // absence-only behavior, including their durable absence episode identities.
    const newEpisode = newAbsence || config.assignedActions === true && newAssignment;
    const episode = !old || newEpisode ? randomUUID() : old.episode;
    const actionable = (info.state === "unassigned" || config.assignedActions === true && info.state === "assigned") &&
      (newEpisode || old?.actionable === true);
    if (info.state !== "unknown" || !old) await client.query(`INSERT INTO mission_status_list_representative_states
      (campaign_contact_id,question_id,state,episode,assignment_version,actionable) VALUES($1,$2,$3,$4,$5,$6)
      ON CONFLICT(campaign_contact_id,question_id) DO UPDATE SET state=EXCLUDED.state,episode=EXCLUDED.episode,
        assignment_version=EXCLUDED.assignment_version,actionable=EXCLUDED.actionable,updated_at=now()`,
    [contactId, source.question_id, info.state, episode, version, actionable]);
    // Background polling tracks episodes for every trigger, but executes only the selected trigger.
    const matches = config.trigger === options.trigger;
    if (!matches) continue;
    result.information.push(info);
    if (options.trigger === "background_change" && !actionable) { info.actionState = "none"; continue; }
    if (info.state === "unknown" || info.state === "assigned" && !config.assignedActions || config.behavior === "information") continue;
    const actions = (await loadAutomaticActions(client, campaignId, source.item_id))
      .filter(action => action.questionId === source.question_id);
    const facts = actions.some(a => JSON.stringify([a.conditionField, a.conditionJson]).includes("history."))
      ? await loadStatusListHistoryFacts(client, campaignId, contactId) : null;
    const prior = (await client.query(`SELECT automation_id,state,trigger_key FROM mission_status_list_automatic_events
      WHERE campaign_id=$1 AND campaign_contact_id=$2 AND trigger_key LIKE $3`, [campaignId, contactId, `representative:${source.question_id}:${episode}:%`])).rows;
    const planned = actions.map(action => {
      const evaluation = automaticCondition(action, facts, country, info.state === "assigned" ? "yes" : "no");
      // Unconditional legacy actions are absence actions, never an implicit YES branch.
      if (info.state === "assigned" && automaticCondition(action, facts, country, "no").value !== false)
        evaluation.value = false;
      const issues = automaticActionIssues(action);
      const saved = prior.find(row => row.automation_id === action.id);
      return { action, evaluation, saved, review: action.executionPolicy === "review" || action.executionPolicy !== "automatic" && config.behavior === "confirm",
        blocked: issues.length > 0 || !countryOkay || evaluation.value === null };
    });
    const candidates = planned.filter(row => row.evaluation.value !== false && !row.saved);
    const fingerprint = hash({ campaignId, contactId, source, episode, state:info.state, representativeName:info.representativeName, country, facts,
      actions: planned.map(({ action, evaluation, blocked }) => ({ action, evaluation, blocked })) });
    const preview = { readOnly: true as const, mode, actions: await Promise.all(planned.filter(row=>!row.saved && row.review).map(async row => ({
      id: row.action.id, sourceLabel: info.label, actionType: row.action.actionType,
      condition: row.evaluation.value === false ? "not_matched" as const : row.blocked ? "blocked" as const : "matched" as const,
      ...(row.action.actionType === "assign_task" ? { targetLabel: await taskTargetLabel(client, row.action, options.actorId || "system:mission-status-list") } : {}),
    }))) };
    const blocked = candidates.some(row => row.blocked);
    info.actionState = planned.some(row => row.saved && ["failed", "indeterminate"].includes(row.saved.state)) ? "failed"
      : planned.some(row => row.saved && ["pending", "running", "awaiting_batch"].includes(row.saved.state)) ? "pending"
       : blocked ? "blocked" : candidates.some(row=>row.review) ? "available"
      : planned.some(row => row.saved?.state === "succeeded") ? "done" : "none";
    info.batchDeferred = planned.some(row => row.saved?.state === "awaiting_batch");
    const confirm = options.confirm?.questionId === source.question_id;
    if (confirm) {
      if (!planned.some(row=>row.review && row.evaluation.value!==false) || options.confirm!.fingerprint !== fingerprint || blocked)
        throw new StatusListWorkflowError("preview_changed", 409);
      confirmed = true;
    }
    if (!options.statusOnly && !blocked) {
      const admitted = candidates.filter(row=>!row.review || confirm);
      for (const { action } of admitted) await client.query(`INSERT INTO mission_status_list_automatic_events
        (campaign_id,campaign_contact_id,automation_id,item_id,trigger_key,action_snapshot,config_revision,actor_id,event_context,state,created_at)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10,clock_timestamp())
        ON CONFLICT(campaign_contact_id,automation_id,trigger_key) DO NOTHING`,
      [campaignId, contactId, action.id, source.item_id, `representative:${source.question_id}:${episode}:${action.id}`,
        JSON.stringify(action), source.check_revision, options.actorId || "system:mission-status-list",
        JSON.stringify({ representativeCheck: { questionId: source.question_id, episode, state:info.state, representativeName:info.representativeName }, occurredAt: new Date().toISOString() }),
        mode === "batch" ? "awaiting_batch" : "pending"]);
      if (admitted.length && !candidates.some(row=>row.review && !confirm)) info.actionState = "pending";
      if (admitted.length && mode === "batch") info.batchDeferred = true;
    }
    if (!blocked && candidates.some(row=>row.review) && !confirm) {
      result.reviews.push({ questionId: source.question_id, fingerprint, preview });
    }
  }
  if (options.confirm && !confirmed) throw new StatusListWorkflowError("preview_changed", 409);
  return result;
}

/** Rechecked immediately before sending, independently of browser claims. */
export async function representativeEventValid(client: Reader, row: any) {
  const check = row.event_context?.representativeCheck;
  if (!check) return false;
  const source = (await client.query(`SELECT check_config,check_revision FROM mission_status_list_sources
    WHERE campaign_id=$1 AND question_id=$2`, [row.campaign_id, check.questionId])).rows[0];
  if (!source?.check_config?.enabled || source.check_config.behavior === "information" ||
    source.check_revision !== row.config_revision) return false;
  const state = (await client.query(`SELECT state,episode,assignment_version FROM mission_status_list_representative_states
    WHERE campaign_contact_id=$1 AND question_id=$2`, [row.campaign_contact_id, check.questionId])).rows[0];
  const expectedState = check.state || "unassigned";
  if (!["assigned","unassigned"].includes(expectedState) || expectedState === "assigned" && !source.check_config.assignedActions ||
    state?.state !== expectedState || state.episode !== check.episode) return false;
  const version = (await client.query(`SELECT (SELECT coalesce(max(valid_to)::text,'initial') FROM (
      SELECT valid_to FROM clinic_representative_assignments WHERE cc.contact_type='clinic' AND clinic_id=cc.clinic_id AND valid_to<=now()
      UNION ALL SELECT valid_to FROM hospital_representative_assignments WHERE cc.contact_type='hospital' AND hospital_id=cc.hospital_id AND valid_to<=now()
    ) history) AS version FROM campaign_contacts cc WHERE cc.id=$1 AND cc.campaign_id=$2`,
  [row.campaign_contact_id,row.campaign_id])).rows[0]?.version;
  if (version !== state.assignment_version) return false;
  const live = (await readStatusListRepresentativeInformation(client, row.campaign_id, row.campaign_contact_id))
    .find(info => info.questionId === check.questionId);
  return live?.state === expectedState &&
    (expectedState !== "assigned" || live?.representativeName === check.representativeName);
}
