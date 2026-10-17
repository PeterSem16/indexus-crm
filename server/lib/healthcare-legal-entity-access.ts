import { pool } from "../db";
import { LegalEntityError } from "./orsr-client";
import type { Facility, FacilityType } from "../../shared/healthcare-legal-entity";
import { REGISTRY_COUNTRIES } from "../../shared/healthcare-legal-entity";

export interface LegalEntityActor {
  id: string; canRead: boolean; canManage: boolean; canEdit: boolean; canAdd: boolean; canViewSensitive: boolean;
  canReadFacilities: boolean; canEditFacilities: boolean; canReadPersons: boolean; canEditPersons: boolean; canAddPersons: boolean;
  countries?: string[];
}
export const legalActorCountries = (actor: LegalEntityActor) => actor.countries ?? ["SK"];
export function assertLegalCountry(actor: LegalEntityActor, country: string) {
  if (!legalActorCountries(actor).includes(country) || !REGISTRY_COUNTRIES.includes(country as any))
    throw new LegalEntityError("forbidden", 403);
}
export async function legalEntityActor(userId: string): Promise<LegalEntityActor> {
  const { rows } = await pool.query(`SELECT u.id,u.role,u.role_id,u.is_active,u.assigned_countries,
    (SELECT row_to_json(p) FROM role_module_permissions p WHERE p.role_id=u.role_id AND p.module_key='healthcare_legal_entities' LIMIT 1) AS legal,
    (SELECT row_to_json(p) FROM role_module_permissions p WHERE p.role_id=u.role_id AND p.module_key='hospitals' LIMIT 1) AS facilities,
    (SELECT row_to_json(p) FROM role_module_permissions p WHERE p.role_id=u.role_id AND p.module_key='collaborators' LIMIT 1) AS persons,
    EXISTS(SELECT 1 FROM role_field_permissions p WHERE p.role_id=u.role_id AND p.module_key='healthcare_legal_entities'
      AND p.field_key='registry_raw' AND p.permission IN ('editable','readonly')) AS raw_access,
    EXISTS(SELECT 1 FROM role_field_permissions p WHERE p.role_id=u.role_id AND p.module_key='collaborators'
      AND p.field_key IN ('first_name','last_name') AND p.permission='hidden') AS person_name_hidden
    FROM users u WHERE u.id=$1`, [userId]);
  const row = rows[0];
  if (!row?.is_active) throw new LegalEntityError("forbidden", 403);
  const admin = row.role === "admin";
  const countries = REGISTRY_COUNTRIES.filter(code => admin || row.assigned_countries?.includes(code));
  const country = countries.length > 0;
  const manager = !row.role_id && row.role === "manager";
  const read = (permission: any) => country && (admin || permission?.access !== "hidden");
  const edit = (permission: any) => read(permission) && (admin || (permission ? permission.can_edit === true : manager));
  const add = (permission: any) => read(permission) && (admin || (permission ? permission.can_add === true : manager));
  const canRead = Boolean(read(row.legal));
  return {
    id: userId, countries, canRead, canManage: Boolean(edit(row.legal) || add(row.legal)), canEdit: Boolean(edit(row.legal)), canAdd: Boolean(add(row.legal)),
    canViewSensitive: Boolean(canRead && (admin || manager || row.raw_access)),
    canReadFacilities: Boolean(read(row.facilities)), canEditFacilities: Boolean(edit(row.facilities)),
    canReadPersons: Boolean(read(row.persons) && (admin || !row.person_name_hidden)),
    canEditPersons: Boolean(edit(row.persons)), canAddPersons: Boolean(add(row.persons)),
  };
}
export const facilityTypeValid = (type: unknown): type is FacilityType => type === "clinic" || type === "hospital";
export async function readLegalFacility(type: unknown, id: unknown, actor: LegalEntityActor, edit = false, client: any = pool): Promise<Facility> {
  if (!facilityTypeValid(type) || typeof id !== "string" || !id || id.length > 128) throw new LegalEntityError("invalid");
  if (!(edit ? actor.canEditFacilities : actor.canReadFacilities)) throw new LegalEntityError("forbidden", 403);
  // Identifiers are chosen only from this fixed allowlist, never from SQL input.
  const table = type === "clinic" ? "clinics" : "hospitals";
  const address = type === "clinic" ? "address" : "street_number";
  const { rows } = await client.query(`SELECT id,name,ico,country_code AS "countryCode",${address} AS address,city,
    postal_code AS "postalCode" FROM ${table} WHERE id=$1${edit ? " FOR UPDATE" : ""}`, [id]);
  if (!rows[0]) throw new LegalEntityError("not_found", 404);
  assertLegalCountry(actor, rows[0].countryCode);
  return { ...rows[0], type };
}
