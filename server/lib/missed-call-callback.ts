import { sql } from "drizzle-orm";
import { db } from "../db";
import { clinics, collaborators, customers, hospitals } from "@shared/schema";
import { callbackPhoneKey, validateMissedCallback, type MissedCallbackEvidence } from "@shared/missed-call-callback";

export class MissedCallbackError extends Error {
  constructor(public code: "CONTACT_INACTIVE" | "MISSED_CALLBACK_FORBIDDEN") {
    super(code);
  }
}

/** Read-only, server-owned authorization for the original caller, not an invented enrollment. */
export async function authorizeMissedCallback(input: {
  userId: string; role: string; sourceId: string; campaignId: string;
  entityId: string; contactType: string; phone: unknown;
  assignedCountries: string[];
}, connection: Pick<typeof db, "execute"> = db) {
  const tables = { customer: customers, clinic: clinics, hospital: hospitals, collaborator: collaborators };
  const table = tables[input.contactType as keyof typeof tables];
  if (!table || ![input.sourceId, input.campaignId, input.entityId]
    .every(id => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))) {
    throw new MissedCallbackError("MISSED_CALLBACK_FORBIDDEN");
  }
  const result = await connection.execute(sql`
    WITH active AS (
      SELECT campaign_id, campaign_ids, inbound_queue_ids
      FROM agent_sessions WHERE user_id = ${input.userId} AND ended_at IS NULL
      ORDER BY started_at DESC LIMIT 1
    )
    SELECT il.id AS "callId", il.queue_id AS "queueId", il.status,
      il.caller_number AS "callerNumber",
      COALESCE(NULLIF(il.metadata->>'campaignId', ''), q.campaign_id) AS "campaignId",
      active.campaign_id AS "activeCampaignId", active.campaign_ids AS "activeCampaignIds",
      active.inbound_queue_ids AS "activeQueueIds", c.country_codes AS "countries",
      EXISTS(SELECT 1 FROM queue_members qm WHERE qm.queue_id = il.queue_id
        AND qm.user_id = ${input.userId}) AS "queueMember",
      EXISTS(SELECT 1 FROM campaign_agents ca WHERE ca.campaign_id = ${input.campaignId}
        AND ca.user_id = ${input.userId}) AS "missionAssigned"
    FROM inbound_call_logs il JOIN inbound_queues q ON q.id = il.queue_id
      JOIN campaigns c ON c.id = ${input.campaignId} CROSS JOIN active
    WHERE il.id = ${input.sourceId} LIMIT 1
  `);
  const row = result.rows[0] as Record<string, any> | undefined;
  const entities = await connection.execute(sql`
    SELECT country_code,
      COALESCE((to_jsonb(${table})->>'is_active')::boolean, true) AS is_active,
      to_jsonb(${table})->>'status' AS status, to_jsonb(${table})->>'name' AS name,
      to_jsonb(${table})->>'first_name' AS first_name, to_jsonb(${table})->>'last_name' AS last_name,
      to_jsonb(${table})->>'phone' AS phone, to_jsonb(${table})->>'phone2' AS phone2,
      to_jsonb(${table})->>'phone3' AS phone3, to_jsonb(${table})->>'mobile' AS mobile,
      to_jsonb(${table})->>'mobile2' AS mobile2
    FROM ${table} WHERE ${table.id} = ${input.entityId} LIMIT 1
  `);
  const entity = entities.rows[0] as Record<string, any> | undefined;
  if (!row || !entity) throw new MissedCallbackError("MISSED_CALLBACK_FORBIDDEN");
  if (input.role.toLowerCase() !== "admin" &&
      !input.assignedCountries.some(country => country.toUpperCase() === String(entity.country_code || "").toUpperCase())) {
    throw new MissedCallbackError("MISSED_CALLBACK_FORBIDDEN");
  }
  const countries: string[] = Array.isArray(row.countries) ? row.countries : [];
  const entityCountry = String(entity.country_code || "").toUpperCase();
  // Never infer a country from an untrusted request or a coincident national suffix.
  const country = countries.length === 1 ? countries[0] :
    countries.includes(entityCountry) ? entityCountry : undefined;
  const evidence: MissedCallbackEvidence = {
    callId: row.callId, queueId: row.queueId, campaignId: row.campaignId,
    status: row.status, callerNumber: row.callerNumber,
    activeCampaignIds: [row.activeCampaignId, ...(row.activeCampaignIds || [])].filter(Boolean),
    activeQueueIds: row.activeQueueIds || [], queueMember: row.queueMember === true,
    missionAssigned: ["admin", "manager"].includes(input.role.toLowerCase()) || row.missionAssigned === true,
    country, entityCountry, entityPhones: [entity.phone, entity.phone2, entity.phone3, entity.mobile, entity.mobile2],
    entityActive: entity.is_active !== false && String(entity.status || "").toLowerCase() !== "inactive",
  };
  const error = validateMissedCallback(evidence, { sourceId: input.sourceId, campaignId: input.campaignId, phone: input.phone });
  if (error) throw new MissedCallbackError(error);
  return {
    inboundCallLogId: row.callId as string, queueId: row.queueId as string,
    campaignId: row.campaignId as string,
    destinationPhoneKey: callbackPhoneKey(row.callerNumber, country)!,
    destinationCountry: country || null,
    customerName: String(entity.clinic_name || entity.name ||
      [entity.first_name, entity.last_name].filter(Boolean).join(" ")),
  };
}
