import { pool } from "./db";
import { storage } from "./storage";
import { isPersistedAdministrator } from "./lib/admin-authorization";
import { countrySupported, providerSupported, validateOmniSmsGrant } from "./lib/omni-sms-policy";
import { OMNI_SMS_COUNTRIES, type OmniSmsAccess, type OmniSmsMessage, type OmniSmsPage } from "@shared/omni-sms";

export class OmniSmsError extends Error {
  constructor(public status: number, code: string) { super(code); }
}

export async function getOmniSmsAccess(actorId: string): Promise<OmniSmsAccess> {
  const actor = await storage.getUser(actorId);
  if (!actor?.isActive) throw new OmniSmsError(403, "sms_access_denied");
  const isAdmin = await isPersistedAdministrator(storage, actorId);
  const countries = isAdmin ? [...OMNI_SMS_COUNTRIES, "UNASSIGNED"]
    : (actor.assignedCountries || []).filter(countrySupported);
  const grants = isAdmin ? [] : (await pool.query(
    `SELECT country_code AS "countryCode", provider FROM omni_sms_gateway_grants WHERE user_id=$1`, [actorId],
  )).rows.filter(g => countries.includes(g.countryCode) && providerSupported(g.provider) &&
    (g.provider !== "smstools" || g.countryCode === "SK"));
  return {
    isAdmin, countries, grants,
    gateways: [
      { provider: "bulkgate", label: "BulkGate", countries: [...OMNI_SMS_COUNTRIES] },
      { provider: "smstools", label: "SMSTOOLS", countries: ["SK"] },
    ],
  };
}

// No country inference from caller digits, and no guessed provider for legacy rows.
// Historical rows without a snapshot use their explicit linked entity/Mission.
// SMSTOOLS is a country-bound SK gateway. Ambiguous global virtual numbers stay unassigned.
const base = `
  SELECT m.id,
    COALESCE(NULLIF(upper(m.country_code),''),
      CASE WHEN lower(trim(m.provider))='smstools' THEN 'SK' END,
      cu.country, cl.country_code, ho.country_code, co.country_code,
      CASE WHEN cardinality(ca.country_codes)=1 THEN ca.country_codes[1] END,
      gw.country_code) AS "countryCode",
    NULLIF(lower(trim(m.provider)),'') AS provider,
    m.direction,m.content,m.recipient_phone AS "recipientPhone",m.sender_phone AS "senderPhone",
    m.status,m.delivery_status AS "deliveryStatus",m.created_at AS "createdAt",m.sent_at AS "sentAt",
    m.campaign_id AS "campaignId",m.entity_id AS "entityId",m.entity_type AS "entityType",
    m.customer_id AS "customerId",
    CASE WHEN cu.id IS NULL THEN NULL ELSE json_build_object('id',cu.id,'firstName',cu.first_name,'lastName',cu.last_name) END AS customer,
    COALESCE(NULLIF(concat_ws(' ',cu.first_name,cu.last_name),''),cl.name,ho.name,
      NULLIF(concat_ws(' ',co.first_name,co.last_name),'')) AS "contactName",
    m.ai_analyzed AS "aiAnalyzed",m.ai_alert_level AS "aiAlertLevel",m.ai_sentiment AS "aiSentiment",
    m.ai_has_angry_tone AS "aiHasAngryTone",m.ai_has_rude_expressions AS "aiHasRudeExpressions",
    m.ai_wants_to_cancel AS "aiWantsToCancel",m.ai_wants_consent AS "aiWantsConsent",
    m.ai_does_not_accept_contract AS "aiDoesNotAcceptContract",m.ai_analysis_note AS "aiAnalysisNote"
  FROM communication_messages m
  LEFT JOIN customers cu ON cu.id=CASE WHEN m.entity_type='customer' THEN COALESCE(m.entity_id,m.customer_id)
    WHEN m.entity_type IS NULL THEN m.customer_id END
  LEFT JOIN clinics cl ON m.entity_type='clinic' AND cl.id=m.entity_id
  LEFT JOIN hospitals ho ON m.entity_type='hospital' AND ho.id=m.entity_id
  LEFT JOIN collaborators co ON m.entity_type='collaborator' AND co.id=m.entity_id
  LEFT JOIN campaigns ca ON ca.id=m.campaign_id
  LEFT JOIN LATERAL (
    SELECT CASE WHEN count(DISTINCT s.country_code)=1 THEN min(s.country_code) END AS country_code
    FROM sms_gateway_settings s
    WHERE s.provider=lower(trim(m.provider)) AND s.country_code IS NOT NULL
      AND m.country_code IS NULL AND lower(trim(m.provider))<>'smstools'
      AND cu.country IS NULL AND cl.country_code IS NULL AND ho.country_code IS NULL AND co.country_code IS NULL
      AND COALESCE(cardinality(ca.country_codes),0)<>1
      AND m.direction='inbound' AND s.virtual_number IS NOT NULL
      AND regexp_replace(s.virtual_number,'[^0-9]','','g')<>''
      AND regexp_replace(s.virtual_number,'[^0-9]','','g')=regexp_replace(m.recipient_phone,'[^0-9]','','g')
  ) gw ON true
  WHERE m.type='sms'
`;

function accessWhere(access: OmniSmsAccess, values: unknown[]) {
  if (access.isAdmin) return "true";
  if (!access.grants.length) return "false";
  return "(" + access.grants.map(g => {
    const c = values.push(g.countryCode), p = values.push(g.provider);
    return `("countryCode"=$${c} AND provider=$${p})`;
  }).join(" OR ") + ")";
}

export async function findOmniSmsMessage(actorId: string, id: string): Promise<OmniSmsMessage> {
  const access = await getOmniSmsAccess(actorId);
  const values: unknown[] = [id];
  const allowed = accessWhere(access, values);
  const readActor = values.push(actorId);
  const result = await pool.query(`WITH sms AS (${base}) SELECT *,
    (COALESCE("deliveryStatus"='read',false) OR EXISTS(
      SELECT 1 FROM omni_sms_reads r WHERE r.user_id=$${readActor} AND r.message_id=sms.id
    )) AS "isRead" FROM sms WHERE id=$1 AND ${allowed}`, values);
  if (!result.rows[0]) throw new OmniSmsError(404, "sms_not_found");
  return result.rows[0];
}

export async function getOmniSmsUnread(actorId: string) {
  const access = await getOmniSmsAccess(actorId);
  const values: unknown[] = [];
  const allowed = accessWhere(access, values);
  const actor = values.push(actorId);
  const result = await pool.query(`WITH sms AS (${base}) SELECT count(*)::int AS unread FROM sms
    WHERE ${allowed} AND direction='inbound' AND "deliveryStatus" IS DISTINCT FROM 'read'
      AND NOT EXISTS(SELECT 1 FROM omni_sms_reads r WHERE r.user_id=$${actor} AND r.message_id=sms.id)`, values);
  return { unread: result.rows[0].unread };
}

export async function markOmniSmsRead(actorId: string, messageId: string) {
  const message = await findOmniSmsMessage(actorId, messageId);
  if (message.direction === "inbound") await pool.query(
    `INSERT INTO omni_sms_reads(user_id,message_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [actorId, messageId]);
  return { saved: true };
}

export async function filterOmniSmsFromMixedHistory<T extends { id: string; type: string }>(actorId: string, messages: T[]): Promise<T[]> {
  const smsIds = messages.filter(message => message.type === "sms").map(message => message.id);
  if (!smsIds.length) return messages;
  const access = await getOmniSmsAccess(actorId);
  const values: unknown[] = [smsIds];
  const allowed = accessWhere(access, values);
  const result = await pool.query(`WITH sms AS (${base}) SELECT id FROM sms WHERE id=ANY($1::varchar[]) AND ${allowed}`, values);
  const visible = new Set(result.rows.map(row => row.id));
  return messages.filter(message => message.type !== "sms" || visible.has(message.id));
}

export async function listOmniSms(actorId: string, query: Record<string, unknown>, allowAllCountries = false): Promise<OmniSmsPage> {
  const access = await getOmniSmsAccess(actorId);
  const country = query.country;
  if ((!allowAllCountries && !country) || (country && !countrySupported(country) && !(country === "UNASSIGNED" && access.isAdmin)))
    throw new OmniSmsError(400, "invalid_sms_country");
  if (country && !access.countries.includes(String(country))) throw new OmniSmsError(403, "sms_country_denied");
  if (query.provider && !providerSupported(query.provider)) throw new OmniSmsError(400, "invalid_sms_provider");
  if (query.direction && !["inbound", "outbound"].includes(String(query.direction)))
    throw new OmniSmsError(400, "invalid_sms_direction");
  const page = Number(query.page ?? 0), pageSize = Number(query.pageSize ?? 25);
  if (!Number.isSafeInteger(page) || page < 0 || page > 1_000_000 ||
      !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100)
    throw new OmniSmsError(400, "invalid_sms_page");
  if (query.q !== undefined && (typeof query.q !== "string" || query.q.length > 200))
    throw new OmniSmsError(400, "invalid_sms_search");
  const values: unknown[] = [];
  const where = [accessWhere(access, values)];
  if (country === "UNASSIGNED") where.push(`"countryCode" IS NULL`);
  else if (country) where.push(`"countryCode"=$${values.push(country)}`);
  if (query.provider) where.push(`provider=$${values.push(query.provider)}`);
  if (query.direction) where.push(`direction=$${values.push(query.direction)}`);
  if (query.q) {
    const n = values.push(`%${String(query.q).replace(/[\\%_]/g, "\\$&")}%`);
    where.push(`(content ILIKE $${n} OR "recipientPhone" ILIKE $${n} OR "senderPhone" ILIKE $${n} OR "contactName" ILIKE $${n})`);
  }
  // Scope and SMS type are applied BEFORE counting or paging; emails never consume the SMS limit.
  const filtered = `WITH sms AS (${base}), filtered AS (SELECT * FROM sms WHERE ${where.join(" AND ")})`;
  const count = await pool.query(`${filtered} SELECT count(*)::int AS total FROM filtered`, values);
  const readActor = values.push(actorId);
  const limit = values.push(pageSize), offset = values.push(page * pageSize);
  const data = await pool.query(`${filtered} SELECT *,
    (COALESCE("deliveryStatus"='read',false) OR EXISTS(
      SELECT 1 FROM omni_sms_reads r WHERE r.user_id=$${readActor} AND r.message_id=filtered.id
    )) AS "isRead" FROM filtered ORDER BY "createdAt" DESC,id DESC LIMIT $${limit} OFFSET $${offset}`, values);
  return { messages: data.rows, total: count.rows[0].total, page, pageSize };
}

export async function getOmniSmsPermissionUsers(country: string) {
  if (!countrySupported(country)) throw new OmniSmsError(400, "invalid_sms_country");
  const result = await pool.query(`
    SELECT u.id,u.full_name AS name,u.username,
      u.assigned_countries AS "assignedCountries",
      COALESCE((SELECT json_agg(g.provider ORDER BY g.provider) FROM omni_sms_gateway_grants g
        WHERE g.user_id=u.id AND g.country_code=$1),'[]'::json) AS providers
    FROM users u LEFT JOIN roles r ON r.id=u.role_id
    WHERE u.is_active=true AND u.role<>'admin' AND COALESCE(r.legacy_role,'')<>'admin'
      AND $1=ANY(u.assigned_countries)
    ORDER BY u.full_name,u.username`, [country]);
  return { users: result.rows };
}

export async function saveOmniSmsPermissions(userId: string, country: unknown, providers: unknown) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(`SELECT u.assigned_countries,u.is_active,u.role,r.legacy_role
      FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE u.id=$1 FOR UPDATE OF u`, [userId]);
    const target = found.rows[0];
    if (!target?.is_active || target.role === "admin" || target.legacy_role === "admin")
      throw new OmniSmsError(400, "invalid_sms_permission_user");
    let validated;
    try { validated = validateOmniSmsGrant(country, providers, target.assigned_countries || []); }
    catch { throw new OmniSmsError(400, "invalid_sms_permissions"); }
    await client.query("DELETE FROM omni_sms_gateway_grants WHERE user_id=$1 AND country_code=$2", [userId, validated.countryCode]);
    for (const provider of validated.providers)
      await client.query("INSERT INTO omni_sms_gateway_grants(user_id,country_code,provider) VALUES($1,$2,$3)", [userId, validated.countryCode, provider]);
    await client.query("COMMIT");
    return { saved: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
