import { pool } from "../db";
import { DEFAULT_FINDER_POLICY, finderPolicySchema, pointSchema, profileSchema, type FinderContext, type FinderProvider, type FinderSelection } from "../../shared/provider-finder";

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
  const { rows } = await pool.query(`SELECT b.company_name,p.settings FROM billing_details b
    LEFT JOIN provider_finder_policies p ON p.billing_company_id=b.id AND p.country=$2
    WHERE b.id=$1 AND b.is_active=true AND (b.country_code=$2 OR $2=ANY(b.country_codes))`, [company, country]);
  if (!rows[0]) throw new FinderError("not_found", 404);
  if (!rows[0].settings && !allowMissing) throw new FinderError("not_configured", 409);
  return { billingCompanyId: company, country, companyName: rows[0].company_name,
    policy: rows[0].settings ? finderPolicySchema.parse(rows[0].settings) : { ...DEFAULT_FINDER_POLICY },
    mapsReady: !!process.env.GOOGLE_MAPS_SERVER_API_KEY && !!process.env.GOOGLE_MAPS_BROWSER_API_KEY };
}
export async function publicFinderContext(slug: string) {
  const { rows } = await pool.query(`SELECT w.id,w.country_code,b.billing_company_id FROM web_forms w
    JOIN provider_finder_form_bindings b ON b.form_id=w.id AND b.country=w.country_code
    WHERE w.slug=$1 AND w.is_active=true`, [slug]);
  if (!rows[0]) throw new FinderError("not_found", 404);
  const context = await finderContext(rows[0].billing_company_id, rows[0].country_code);
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
        (SELECT max(s.confirmed_at) FROM clinic_cooperation_statuses s WHERE s.clinic_id=c.id) AS last_contact_at
      FROM clinics c WHERE c.country_code=$2
      UNION ALL
      SELECT h.id,'hospital',h.name,COALESCE(h.street_number,''),COALESCE(h.city,''),h.latitude,h.longitude,h.is_active,false,false,NULL::timestamp
      FROM hospitals h WHERE h.country_code=$2
    )
    SELECT s.*,p.settings,CASE WHEN $3::boolean THEN COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',q.id,'name',q.name) ORDER BY q.name,q.id) FROM (
        SELECT DISTINCT x.id,concat_ws(' ',x.title_before,x.first_name,x.last_name,x.title_after) AS name
        FROM contact_assignments a JOIN collaborators x ON x.id=a.person_id
        WHERE a.entity_type=s.type AND a.entity_id=s.id AND a.is_active=true AND x.is_active=true
          AND (a.start_date IS NULL OR a.start_date<=now()) AND (a.end_date IS NULL OR a.end_date>now())
          AND (x.country_code=$2 OR $2=ANY(x.country_codes))
      ) q),'[]'::jsonb) ELSE '[]'::jsonb END AS people
    FROM sites s LEFT JOIN provider_finder_profiles p
      ON p.billing_company_id=$1 AND p.country=$2 AND p.facility_type=s.type AND p.facility_id=s.id
    ORDER BY s.name,s.type,s.id`, [company, country, readPeople || publicView]);
  return rows.map(r => {
    const p = profileSchema.parse({ type: r.type, id: r.id, ...(r.settings || {}) });
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bratislava" });
    const manualContract = !!p.contractReference && (!p.contractValidFrom || p.contractValidFrom <= today) && (!p.contractValidTo || p.contractValidTo >= today);
    return { id: r.id, type: r.type, name: r.name, address: r.address, city: r.city,
      lat: r.latitude == null ? null : Number(r.latitude), lng: r.longitude == null ? null : Number(r.longitude),
      active: r.is_active, contracted: manualContract || (p.useClinicContractEvidence && r.contracted === true), paused: p.paused || r.paused === true,
      lastContactAt: r.last_contact_at ? new Date(r.last_contact_at).toISOString() : null,
      enabled: p.enabled, publicVisible: p.publicVisible, services: p.services,
      ...(!publicView ? { publicPersonIds: p.publicPersonIds } : {}),
      ...(!publicView ? { contractProfile: { useClinicContractEvidence: p.useClinicContractEvidence, contractReference: p.contractReference,
        contractValidFrom: p.contractValidFrom, contractValidTo: p.contractValidTo } } : {}),
      publicPhone: p.publicPhone, publicEmail: p.publicEmail,
      people: publicView ? (r.people || []).filter((x: { id: string }) => p.publicPersonIds.includes(x.id)) : r.people || [] };
  });
}
export async function validateFinderSelection(selection: FinderSelection, publicView = false, readPeople = true) {
  const context = await finderContext(selection.billingCompanyId, selection.country);
  if (publicView ? !context.policy.publicEnabled : !context.policy.enabled) throw new FinderError("disabled", 409);
  const providers = await finderProviders(selection.billingCompanyId, selection.country, readPeople, publicView);
  const p = providers.find(p => p.id === selection.id && p.type === selection.type);
  if (!p || !p.active || !p.enabled || p.paused || (publicView && !p.publicVisible) ||
    !pointSchema.safeParse({ lat: p.lat, lng: p.lng }).success ||
    (context.policy.requireContract && !p.contracted) || (selection.personId && !p.people.some(x => x.id === selection.personId)))
    throw new FinderError("selection_unavailable", 409);
  return { ...selection, name: p.name, address: p.address, city: p.city,
    personName: selection.personId ? p.people.find(x => x.id === selection.personId)?.name : undefined };
}
