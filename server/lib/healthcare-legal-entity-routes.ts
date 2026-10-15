import type { Express, Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db";
import { LegalEntityError, loadOrsrCompany, normalizeIco, type RegistryLoader } from "./orsr-client";
import { facilityTypeValid, legalEntityActor, readLegalFacility, type LegalEntityActor } from "./healthcare-legal-entity-access";
import {
  confirmFacilityLink, directLegalPeople, facilityLinks, inLegalTransaction, latestRegistryPeople,
  legalAudit, legalEntityRow, legalEntitySummary, relatedLegalPeople, saveLegalVerification,
} from "./healthcare-legal-entity-store";
import type { VerificationPreview } from "../../shared/healthcare-legal-entity";

const id = z.string().trim().min(1).max(128);
const facilityType = z.enum(["clinic", "hospital"]);
const facilityContext = { facilityType: facilityType.optional(), facilityId: id.optional() };
const verifySchema = z.object({ ico: z.string().max(32), ...facilityContext }).strict();
const linkSchema = z.object({ facilityType, facilityId: id, confirmOperator: z.literal(true), replaceExisting: z.boolean().optional() }).strict();
const saveSchema = z.object({
  verificationId: id, ...facilityContext, confirmOperator: z.literal(true).optional(), replaceExisting: z.boolean().optional(),
  applyFields: z.array(z.enum(["name", "address", "city", "postalCode", "ico"])).max(5)
    .refine(fields => new Set(fields).size === fields.length).optional(),
}).strict();
type Handler = (req: Request, res: Response, actor: LegalEntityActor) => Promise<unknown>;

export function registerHealthcareLegalEntityRoutes(app: Express, requireAuth: any, loader: RegistryLoader = loadOrsrCompany) {
  const root = "/api/healthcare-legal-entities";
  const recentRequests = new Map<string, number[]>();
  const route = (permission: "read" | "manage" | "edit", handler: Handler) => async (req: Request, res: Response) => {
    try {
      res.setHeader("Cache-Control", "private, no-store");
      const actor = await legalEntityActor(req.session.user!.id);
      if (!(permission === "read" ? actor.canRead : permission === "edit" ? actor.canEdit : actor.canManage))
        throw new LegalEntityError("forbidden", 403);
      return await handler(req, res, actor);
    } catch (error) {
      if (error instanceof LegalEntityError) return res.status(error.status).json({ error: error.code });
      if (error instanceof z.ZodError) return res.status(400).json({ error: "invalid" });
      const code = (error as any)?.code;
      if (["23505", "40001", "40P01"].includes(code)) return res.status(409).json({ error: "conflict" });
      // Neither registry responses, database detail nor personal data enter diagnostic logs.
      console.error("[HealthcareLegalEntity] Request failed");
      return res.status(500).json({ error: "request_failed" });
    }
  };
  async function verify(actor: LegalEntityActor, icoValue: string, type?: any, facilityId?: string): Promise<VerificationPreview> {
    const ico = normalizeIco(icoValue);
    if (Boolean(type) !== Boolean(facilityId)) throw new LegalEntityError("invalid");
    const facility = facilityId ? await readLegalFacility(type, facilityId, actor, true) : undefined;
    const now = Date.now();
    recentRequests.forEach((times, key) => {
      if (!times.some(time => time > now - 60_000)) recentRequests.delete(key);
    });
    const times = (recentRequests.get(actor.id) || []).filter(time => time > now - 60_000);
    if (times.length >= 6) throw new LegalEntityError("rate_limited", 429);
    recentRequests.set(actor.id, [...times, now]);
    const result = await loader(ico);
    if (result.company.ico !== ico || result.company.countryCode !== "SK") throw new LegalEntityError("registry_identity_conflict", 502);
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const { rows } = await pool.query(`INSERT INTO healthcare_legal_entity_verifications
      (created_by,facility_type,facility_id,normalized,registry_people,raw_data,checked_at,source_updated_at,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [actor.id, type || null, facilityId || null,
      JSON.stringify(result.company), JSON.stringify(result.registryPeople), JSON.stringify(result.rawData),
      result.checkedAt, result.sourceUpdatedAt, expiresAt]);
    // Only temporary previews expire; saved source snapshots and audit remain durable.
    await pool.query(`DELETE FROM healthcare_legal_entity_verifications WHERE expires_at < now()-interval '2 days'`);
    const existing = await pool.query(`SELECT id FROM healthcare_legal_entities WHERE country_code='SK' AND ico=$1`, [ico]);
    return { verificationId: rows[0].id, expiresAt, company: result.company, existingEntityId: existing.rows[0]?.id || null,
      facility, registryPeople: result.registryPeople, documents: result.documents, checkedAt: result.checkedAt, sourceUpdatedAt: result.sourceUpdatedAt };
  }

  app.get(root, requireAuth, route("read", async (_req, res, actor) => {
    const { rows } = await pool.query(`SELECT e.*,
      (SELECT count(*) FROM healthcare_legal_entity_facilities l WHERE l.legal_entity_id=e.id AND l.valid_to IS NULL) AS facility_count
      FROM healthcare_legal_entities e ORDER BY e.normalized->>'name',e.id`);
    res.json({ items: rows.map(legalEntitySummary), canManage: actor.canManage });
  }));
  app.get(`${root}/person-options`, requireAuth, route("read", async (req, res, actor) => {
    if (!actor.canReadPersons) throw new LegalEntityError("forbidden", 403);
    const search = z.string().max(120).parse(req.query.search || "");
    const { rows } = await pool.query(`SELECT id,concat_ws(' ',first_name,last_name) AS name FROM collaborators
      WHERE (country_code='SK' OR 'SK'=ANY(country_codes)) AND is_active=true
      AND concat_ws(' ',first_name,last_name) ILIKE $1 ORDER BY last_name,first_name,id LIMIT 100`, [`%${search}%`]);
    res.json({ items: rows });
  }));
  app.get(`${root}/facility-options`, requireAuth, route("read", async (req, res, actor) => {
    if (!actor.canReadFacilities) throw new LegalEntityError("forbidden", 403);
    const search = z.string().max(120).parse(req.query.search || "");
    const { rows } = await pool.query(`SELECT * FROM (
      SELECT id,'clinic' AS type,name,ico,country_code AS "countryCode" FROM clinics WHERE country_code='SK'
      UNION ALL SELECT id,'hospital' AS type,name,ico,country_code AS "countryCode" FROM hospitals WHERE country_code='SK'
      ) f WHERE name ILIKE $1 OR ico ILIKE $1 ORDER BY name,id LIMIT 100`, [`%${search}%`]);
    res.json({ items: rows });
  }));
  app.get(`${root}/facilities/:type/:id`, requireAuth, route("read", async (req, res, actor) => {
    const facility = await readLegalFacility(req.params.type, req.params.id, actor);
    res.json({ facility, links: await facilityLinks(null, facility.type, facility.id),
      canManage: actor.canManage && actor.canEditFacilities });
  }));
  app.get(`${root}/persons/:id`, requireAuth, route("read", async (req, res, actor) => {
    if (!actor.canReadPersons) throw new LegalEntityError("forbidden", 403);
    const person = await pool.query(`SELECT id FROM collaborators WHERE id=$1 AND (country_code='SK' OR 'SK'=ANY(country_codes))`, [id.parse(req.params.id)]);
    if (!person.rows.length) throw new LegalEntityError("not_found", 404);
    res.json({ facilities: actor.canReadFacilities ? await relatedLegalPeople(null, req.params.id) : [],
      direct: await directLegalPeople(null, req.params.id) });
  }));
  app.post(`${root}/verify`, requireAuth, route("manage", async (req, res, actor) => {
    const body = verifySchema.parse(req.body);
    res.json(await verify(actor, body.ico, body.facilityType, body.facilityId));
  }));
  app.post(`${root}/save`, requireAuth, route("manage", async (req, res, actor) => {
    const body = saveSchema.parse(req.body);
    if (Boolean(body.facilityType) !== Boolean(body.facilityId)) throw new LegalEntityError("invalid");
    res.json(await saveLegalVerification(actor, body));
  }));
  app.get(`${root}/:id/snapshots/:snapshotId`, requireAuth, route("read", async (req, res, actor) => {
    await legalEntityRow(id.parse(req.params.id));
    const { rows } = await pool.query(`SELECT * FROM healthcare_legal_entity_snapshots WHERE id=$1 AND legal_entity_id=$2`,
      [id.parse(req.params.snapshotId), req.params.id]);
    if (!rows[0]) throw new LegalEntityError("not_found", 404);
    res.json({ snapshot: { id: rows[0].id, checkedAt: rows[0].checked_at, sourceUpdatedAt: rows[0].source_updated_at },
      ...(actor.canViewSensitive ? { rawData: rows[0].raw_data } : {}) });
  }));
  app.post(`${root}/:id/verify`, requireAuth, route("edit", async (req, res, actor) => {
    const entity = await legalEntityRow(id.parse(req.params.id));
    res.json(await verify(actor, entity.ico));
  }));
  app.patch(`${root}/:id`, requireAuth, route("edit", async (req, res, actor) => {
    const body = z.object({ notes: z.string().max(10_000) }).strict().parse(req.body);
    const entityId = id.parse(req.params.id);
    await inLegalTransaction(async client => {
      await legalEntityRow(entityId, client);
      await client.query(`UPDATE healthcare_legal_entities SET notes=$2,updated_at=now() WHERE id=$1`, [entityId, body.notes]);
      await legalAudit(client, entityId, actor, "notes_updated");
    });
    res.json({ ok: true });
  }));
  app.post(`${root}/:id/facilities`, requireAuth, route("edit", async (req, res, actor) => {
    const body = linkSchema.parse(req.body);
    const linkId = await inLegalTransaction(client => confirmFacilityLink(client, actor, id.parse(req.params.id),
      body.facilityType, body.facilityId, body.confirmOperator, body.replaceExisting));
    res.json({ linkId });
  }));
  app.post(`${root}/:id/facilities/:linkId/end`, requireAuth, route("edit", async (req, res, actor) => {
    await inLegalTransaction(async client => {
      const found = await client.query(`SELECT * FROM healthcare_legal_entity_facilities WHERE id=$1 AND legal_entity_id=$2 FOR UPDATE`,
        [id.parse(req.params.linkId), id.parse(req.params.id)]);
      const link = found.rows[0];
      if (!link) throw new LegalEntityError("not_found", 404);
      await readLegalFacility(link.facility_type, link.facility_id, actor, true, client);
      if (!link.valid_to) {
        await client.query(`UPDATE healthcare_legal_entity_facilities SET valid_to=now(),ended_by=$2 WHERE id=$1`, [link.id, actor.id]);
        await legalAudit(client, req.params.id, actor, "operator_ended", { facilityType: link.facility_type, facilityId: link.facility_id });
      }
    });
    res.json({ ok: true });
  }));
  app.post(`${root}/:id/person-links`, requireAuth, route("edit", async (req, res, actor) => {
    const body = z.object({ registryPersonKey: z.string().regex(/^[a-f0-9]{64}$/), personId: id.optional(),
      createPerson: z.literal(true).optional(), confirm: z.literal(true) }).strict().parse(req.body);
    if (Boolean(body.personId) === Boolean(body.createPerson)) throw new LegalEntityError("invalid");
    if (!(actor.canReadPersons && (body.createPerson ? actor.canAddPersons : actor.canEditPersons))) throw new LegalEntityError("forbidden", 403);
    const personId = await inLegalTransaction(async client => {
      const entityId = id.parse(req.params.id);
      await legalEntityRow(entityId, client);
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`hle-person:${entityId}:${body.registryPersonKey}`]);
      const source = (await latestRegistryPeople(entityId, client)).find(person => person.key === body.registryPersonKey);
      if (!source || !source.current) throw new LegalEntityError("registry_person_unavailable", 409);
      if (source.isNaturalPerson !== true) throw new LegalEntityError("not_natural_person");
      const linked = await client.query(`SELECT person_id FROM healthcare_legal_entity_person_links
        WHERE legal_entity_id=$1 AND registry_person_key=$2 AND valid_to IS NULL`, [entityId, body.registryPersonKey]);
      if (linked.rows.length) {
        if (body.personId && linked.rows[0].person_id !== body.personId) throw new LegalEntityError("conflict", 409);
        return linked.rows[0].person_id;
      }
      let selectedId = body.personId;
      if (selectedId) {
        const selected = await client.query(`SELECT id FROM collaborators WHERE id=$1
          AND (country_code='SK' OR 'SK'=ANY(country_codes)) FOR SHARE`, [selectedId]);
        if (!selected.rows.length) throw new LegalEntityError("forbidden", 403);
      } else {
        // Preserve the authoritative formatted name intact; never guess title/family-name boundaries.
        // A corporate member is not a natural person and cannot become a CRM Person.
        const created = await client.query(`INSERT INTO collaborators(country_code,country_codes,first_name,last_name)
          VALUES('SK',ARRAY['SK'],$1,$2) RETURNING id`,
        [source.lastName ? source.firstName || "" : "", source.lastName || source.name]);
        selectedId = created.rows[0].id;
      }
      await client.query(`INSERT INTO healthcare_legal_entity_person_links(legal_entity_id,person_id,registry_person_key,role,confirmed_by)
        VALUES($1,$2,$3,$4,$5)`, [entityId, selectedId, source.key, source.role, actor.id]);
      await legalAudit(client, entityId, actor, body.createPerson ? "registry_person_created" : "registry_person_linked",
        { personId: selectedId, registryPersonKey: source.key });
      return selectedId;
    });
    res.json({ personId });
  }));
  app.post(`${root}/:id/person-links/:linkId/end`, requireAuth, route("edit", async (req, res, actor) => {
    if (!actor.canEditPersons) throw new LegalEntityError("forbidden", 403);
    await inLegalTransaction(async client => {
      const result = await client.query(`UPDATE healthcare_legal_entity_person_links SET valid_to=now(),ended_by=$3
        WHERE id=$1 AND legal_entity_id=$2 AND valid_to IS NULL RETURNING id`,
      [id.parse(req.params.linkId), id.parse(req.params.id), actor.id]);
      if (!result.rows.length) throw new LegalEntityError("not_found", 404);
      await legalAudit(client, req.params.id, actor, "registry_person_unlinked", { linkId: req.params.linkId });
    });
    res.json({ ok: true });
  }));
  app.get(`${root}/:id`, requireAuth, route("read", async (req, res, actor) => {
    const entity = await legalEntityRow(id.parse(req.params.id));
    const snapshots = await pool.query(`SELECT s.id,s.checked_at AS "checkedAt",s.source_updated_at AS "sourceUpdatedAt",
      concat_ws(' ',u.full_name) AS "createdByName",'registry' AS kind
      FROM healthcare_legal_entity_snapshots s LEFT JOIN users u ON u.id=s.created_by WHERE s.legal_entity_id=$1
      ORDER BY s.checked_at DESC,s.created_at DESC,s.id DESC`, [entity.id]);
    const audit = await pool.query(`SELECT a.id,a.occurred_at AS "checkedAt",NULL AS "sourceUpdatedAt",
      u.full_name AS "createdByName",a.kind,a.details FROM healthcare_legal_entity_audit a
      LEFT JOIN users u ON u.id=a.actor_id WHERE a.legal_entity_id=$1 ORDER BY a.occurred_at DESC,a.id`, [entity.id]);
    const latest = actor.canViewSensitive ? await pool.query(`SELECT raw_data FROM healthcare_legal_entity_snapshots
      WHERE legal_entity_id=$1 ORDER BY checked_at DESC,created_at DESC,id DESC LIMIT 1`, [entity.id]) : null;
    res.json({
      entity: legalEntitySummary(entity), facilities: actor.canReadFacilities ? await facilityLinks(entity.id) : [],
      people: actor.canReadFacilities && actor.canReadPersons ? await relatedLegalPeople(entity.id) : [],
      registryPeople: await latestRegistryPeople(entity.id), personLinks: actor.canReadPersons ? await directLegalPeople(entity.id) : [],
      history: snapshots.rows, audit: audit.rows, canManage: actor.canEdit, canViewSensitive: actor.canViewSensitive,
      ...(latest?.rows[0] ? { rawData: latest.rows[0].raw_data } : {}),
    });
  }));
}
