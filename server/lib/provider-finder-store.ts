import { pool } from "../db";
import { DEFAULT_FINDER_POLICY, finderPolicySchema, pointSchema, matchesFinderRequirements, type FinderContext, type FinderProvider, type FinderSelection } from "../../shared/provider-finder";

export class FinderError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export async function finderActor(userId: string, country: string, configure = false) {
  const { rows } = await pool.query(`SELECT u.role,u.role_id,u.assigned_countries,u.is_active,
    (SELECT row_to_json(p) FROM role_module_permissions p WHERE p.role_id=u.role_id AND p.module_key='configurator' LIMIT 1) AS config,
    (SELECT row_to_json(p) FROM role_module_permissions p WHERE p.role_id=u.role_id AND p.module_key='hospitals' LIMIT 1) AS sites,
    (SELECT row_to_json(p) FROM role_module_permissions p WHERE p.role_id=u.role_id AND p.module_key='customers' LIMIT 1) AS customers,
    (SELECT row_to_json(p) FROM role_module_permissions p WHERE p.role_id=u.role_id AND p.module_key='collaborators' LIMIT 1) AS people,
    EXISTS(SELECT 1 FROM role_field_permissions p WHERE p.role_id=u.role_id AND p.module_key='collaborators'
      AND p.field_key IN ('first_name','last_name','firstName','lastName') AND p.permission='hidden') AS hide_people
    FROM users u WHERE u.id=$1`, [userId]);
  const u = rows[0];
  if (!u?.is_active || (u.role !== "admin" && !u.assigned_countries?.includes(country))) throw new FinderError("forbidden", 403);
  const admin = u.role === "admin";
  const legacyManager = !u.role_id && u.role === "manager";
  const visible = (p: any) => admin || (p ? p.access !== "hidden" : legacyManager);
  if (configure ? !(admin || (visible(u.config) && (u.config?.can_edit || legacyManager))) :
    !(visible(u.customers) || visible(u.sites))) throw new FinderError("forbidden", 403);
  return { canReadPeople: admin || (!u.hide_people && visible(u.people)), canEditCustomer: admin || (visible(u.customers) && (u.customers?.can_edit || legacyManager)) };
}
export async function finderContext(company: string, country: string, allowMissing = false): Promise<FinderContext> {
  // Legacy URLs/selections can still name a real company, but never choose a different policy.
  if (company !== "country") {
    const valid = await pool.query(`SELECT 1 FROM billing_details WHERE id=$1 AND is_active=true
      AND (country_code=$2 OR $2=ANY(country_codes))`, [company, country]);
    if (!valid.rows.length) throw new FinderError("not_found", 404);
  }
  const { rows } = await pool.query(`SELECT settings FROM provider_finder_country_policies WHERE country=$1`, [country]);
  if (!rows.length && !allowMissing) throw new FinderError("not_configured", 409);
  return { billingCompanyId: "country", country, companyName: country,
    policy: rows[0] ? finderPolicySchema.parse(rows[0].settings) : { ...DEFAULT_FINDER_POLICY },
    mapsReady: !!process.env.GOOGLE_MAPS_SERVER_API_KEY && !!process.env.GOOGLE_MAPS_BROWSER_API_KEY };
}
export async function publicFinderContext(slug: string) {
  const { rows } = await pool.query(`SELECT w.id,w.country_code FROM web_forms w
    JOIN provider_finder_country_forms b ON b.form_id=w.id AND b.country=w.country_code
    WHERE w.slug=$1 AND w.is_active=true`, [slug]);
  if (!rows[0]) throw new FinderError("not_found", 404);
  const context = await finderContext("country", rows[0].country_code);
  if (!context.policy.publicEnabled) throw new FinderError("not_found", 404);
  return context;
}
export async function finderProviders(company: string, country: string, readPeople: boolean, publicView = false): Promise<FinderProvider[]> {
  const { rows } = await pool.query(`
    WITH sites AS (
      SELECT c.id,'clinic' AS type,c.name,COALESCE(c.address,'') AS address,COALESCE(c.city,'') AS city,
        c.latitude,c.longitude,c.is_active,
        (EXISTS(SELECT 1 FROM clinic_agreements a WHERE a.clinic_id=c.id AND a.active=true AND a.ended_at IS NULL
          AND (a.valid_from IS NULL OR a.valid_from<=CURRENT_DATE) AND (a.valid_to IS NULL OR a.valid_to>=CURRENT_DATE))
          OR (SELECT s.status_key='contract_signed' FROM clinic_cooperation_statuses s
            WHERE s.clinic_id=c.id AND s.phase='contract' ORDER BY s.confirmed_at DESC,s.id DESC LIMIT 1)) AS contracted,
        (SELECT s.status_key IN ('retention_paused','retention_terminated') FROM clinic_cooperation_statuses s
          WHERE s.clinic_id=c.id AND s.phase='retention' ORDER BY s.confirmed_at DESC,s.id DESC LIMIT 1) AS paused,
        (SELECT max(s.confirmed_at) FROM clinic_cooperation_statuses s WHERE s.clinic_id=c.id) AS last_contact_at,
        (SELECT s.status_key='retention_active' FROM clinic_cooperation_statuses s WHERE s.clinic_id=c.id
          AND s.phase='retention' ORDER BY s.confirmed_at DESC,s.id DESC LIMIT 1) AS cooperating,
        EXISTS(SELECT 1 FROM clinic_agreements a WHERE a.clinic_id=c.id AND a.active=true AND a.ended_at IS NULL
          AND a.storage_key<>'' AND (a.valid_from IS NULL OR a.valid_from<=CURRENT_DATE)
          AND (a.valid_to IS NULL OR a.valid_to>=CURRENT_DATE)) AS uploaded_contract,
        EXISTS(SELECT 1 FROM clinic_representative_assignments a JOIN users u ON u.id=a.user_id AND u.is_active=true
          WHERE a.clinic_id=c.id AND a.valid_from<=now() AND (a.valid_to IS NULL OR a.valid_to>now())) AS has_representative
      FROM clinics c WHERE c.country_code=$1
      UNION ALL
      SELECT h.id,'hospital',h.name,COALESCE(h.street_number,''),COALESCE(h.city,''),h.latitude,h.longitude,h.is_active,false,false,NULL::timestamp,
        false,false,EXISTS(SELECT 1 FROM hospital_representative_assignments a JOIN users u ON u.id=a.user_id AND u.is_active=true
          WHERE a.hospital_id=h.id AND a.valid_from<=now() AND (a.valid_to IS NULL OR a.valid_to>now()))
      FROM hospitals h WHERE h.country_code=$1
    )
    SELECT s.*,CASE WHEN $2::boolean THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',q.id,'name',q.name) ORDER BY q.name,q.id) FROM (
        SELECT DISTINCT x.id,concat_ws(' ',x.title_before,x.first_name,x.last_name,x.title_after) AS name
        FROM contact_assignments a JOIN collaborators x ON x.id=a.person_id
        WHERE a.entity_type=s.type AND a.entity_id=s.id AND a.is_active=true AND x.is_active=true
          AND (a.start_date IS NULL OR a.start_date<=now()) AND (a.end_date IS NULL OR a.end_date>now())
          AND (x.country_code=$1 OR $1=ANY(x.country_codes))
      ) q),'[]'::jsonb) ELSE '[]'::jsonb END AS people
    FROM sites s
    ORDER BY s.name,s.type,s.id`, [country, readPeople || publicView]);
  return rows.map(r => {
    return { id: r.id, type: r.type, name: r.name, address: r.address, city: r.city,
      lat: r.latitude == null ? null : Number(r.latitude), lng: r.longitude == null ? null : Number(r.longitude),
      active: r.is_active, contracted: r.contracted === true, paused: r.paused === true,
      cooperating: r.cooperating === true, uploadedContract: r.uploaded_contract === true, hasRepresentative: r.has_representative === true,
      lastContactAt: r.last_contact_at ? new Date(r.last_contact_at).toISOString() : null,
      enabled: true, publicVisible: true, services: [],
      publicPhone: "", publicEmail: "", people: r.people || [] };
  });
}
export async function validateFinderSelection(selection: FinderSelection, publicView = false, readPeople = true) {
  const context = await finderContext(selection.billingCompanyId, selection.country);
  if (publicView ? !context.policy.publicEnabled : !context.policy.enabled) throw new FinderError("disabled", 409);
  const providers = await finderProviders(selection.billingCompanyId, selection.country, readPeople, publicView);
  const p = providers.find(p => p.id === selection.id && p.type === selection.type);
  if (!p || !p.active || p.paused ||
    !pointSchema.safeParse({ lat: p.lat, lng: p.lng }).success ||
    !matchesFinderRequirements(p, context.policy) || (selection.personId && !p.people.some(x => x.id === selection.personId)))
    throw new FinderError("selection_unavailable", 409);
  return { ...selection, billingCompanyId: "country", name: p.name, address: p.address, city: p.city,
    personName: selection.personId ? p.people.find(x => x.id === selection.personId)?.name : undefined };
}
