import type { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { pool } from "../db";
import { finderPolicySchema, profileSchema, rankProviders, searchSchema, selectionSchema, type FinderContext } from "../../shared/provider-finder";
import { FinderError, finderActor, finderContext, finderProviders, publicFinderContext, validateFinderSelection } from "./provider-finder-store";
import { addressSchema, geocodeFinderAddress } from "./provider-finder-google";

const countrySchema = z.string().regex(/^[A-Z]{2}$/);
const idSchema = z.string().min(1).max(128);
const limits = new Map<string, { count: number; reset: number }>();
function limited(key: string, max: number) {
  const now = Date.now();
  if (limits.size > 10000) for (const [k, v] of limits) if (v.reset < now) limits.delete(k);
  if (limits.size >= 20000 && !limits.has(key)) throw new FinderError("rate_limited", 429);
  const entry = limits.get(key);
  if (!entry || entry.reset < now) limits.set(key, { count: 1, reset: now + 60000 });
  else if (++entry.count > max) throw new FinderError("rate_limited", 429);
}
const uid = (req: Request) => (req as any).session?.user?.id || (req as any).session?.userId;
function route(fn: (req: Request, res: Response) => Promise<any>): RequestHandler {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try { await fn(req, res); }
    catch (e) {
      if (e instanceof z.ZodError) { res.status(400).json({ error: "invalid" }); return; }
      const error = e instanceof FinderError ? e : new FinderError("request_failed", 500);
      // Never log customer addresses, coordinates, selected persons or API keys.
      if (error.status === 500) console.error("[ProviderFinder] request failed");
      res.status(error.status).json({ error: error.code });
    }
  };
}
export function registerProviderFinderRoutes(app: Express, requireAuth: RequestHandler) {
  const root = "/api/provider-finder";
  const publicRoot = "/api/public/web-form/:slug/providers";
  async function internal(req: Request, configure = false) {
    const country = countrySchema.parse(req.params.country);
    const company = idSchema.parse(req.params.company);
    const actor = await finderActor(uid(req), country, configure);
    return { actor, context: await finderContext(company, country, configure) };
  }
  async function outputConfig(context: FinderContext, publicView = false) {
    const { policy, ...rest } = context;
    return { ...rest, policy: publicView ? {
      enabled: policy.enabled, publicEnabled: policy.publicEnabled, defaultRadiusKm: policy.defaultRadiusKm,
      maxRadiusKm: policy.maxRadiusKm, services: policy.services,
    } : policy };
  }
  app.get(`${root}/contexts/:country`, requireAuth, route(async (req, res) => {
    const country = countrySchema.parse(req.params.country);
    await finderActor(uid(req), country);
    const { rows } = await pool.query(`SELECT p.billing_company_id FROM provider_finder_policies p
      WHERE p.country=$1 AND p.settings->>'enabled'='true' ORDER BY p.billing_company_id`, [country]);
    const contexts = [];
    for (const row of rows) {
      try { contexts.push(await finderContext(row.billing_company_id, country)); }
      catch (e) { if (!(e instanceof FinderError && e.status === 404)) throw e; }
    }
    res.json(contexts);
  }));
  app.get(`${root}/config/:company/:country`, requireAuth, route(async (req, res) => {
    const { context } = await internal(req, true);
    const { rows: forms } = await pool.query(`SELECT w.id,w.name,b.billing_company_id AS "boundCompanyId"
      FROM web_forms w LEFT JOIN provider_finder_form_bindings b ON b.form_id=w.id
      WHERE w.country_code=$1 AND w.is_active=true ORDER BY w.name`, [context.country]);
    res.json({ ...context, forms, formIds: forms.filter(f => f.boundCompanyId === context.billingCompanyId).map(f => f.id) });
  }));
  app.put(`${root}/config/:company/:country`, requireAuth, route(async (req, res) => {
    const { context } = await internal(req, true);
    const body = z.object({ policy: finderPolicySchema, formIds: z.array(idSchema).max(100) }).strict().parse(req.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Lock the company, serializing same-company policy/form-binding saves.
      await client.query("SELECT id FROM billing_details WHERE id=$1 FOR UPDATE", [context.billingCompanyId]);
      if (body.formIds.length) {
        const valid = await client.query(`SELECT id FROM web_forms WHERE id=ANY($1::varchar[]) AND country_code=$2 AND is_active=true FOR UPDATE`, [body.formIds, context.country]);
        if (valid.rows.length !== new Set(body.formIds).size) throw new FinderError("invalid");
        const bound = await client.query(`SELECT form_id FROM provider_finder_form_bindings WHERE form_id=ANY($1::varchar[])
          AND billing_company_id<>$2`, [body.formIds, context.billingCompanyId]);
        if (bound.rows.length) throw new FinderError("form_already_bound", 409);
      }
      await client.query(`INSERT INTO provider_finder_policies(billing_company_id,country,settings,updated_by)
        VALUES($1,$2,$3,$4) ON CONFLICT(billing_company_id,country) DO UPDATE
        SET settings=EXCLUDED.settings,updated_by=EXCLUDED.updated_by,updated_at=now()`,
      [context.billingCompanyId, context.country, JSON.stringify(body.policy), uid(req)]);
      await client.query(`DELETE FROM provider_finder_form_bindings WHERE billing_company_id=$1 AND country=$2 AND NOT(form_id=ANY($3::varchar[]))`,
        [context.billingCompanyId, context.country, body.formIds]);
      for (const id of new Set(body.formIds)) {
        const result = await client.query(`INSERT INTO provider_finder_form_bindings(form_id,billing_company_id,country) VALUES($1,$2,$3)
          ON CONFLICT(form_id) DO UPDATE SET country=EXCLUDED.country
          WHERE provider_finder_form_bindings.billing_company_id=EXCLUDED.billing_company_id RETURNING form_id`,
        [id, context.billingCompanyId, context.country]);
        if (!result.rows.length) throw new FinderError("form_already_bound", 409);
      }
      await client.query("COMMIT");
      res.json({ saved: true });
    } catch (e) { await client.query("ROLLBACK"); throw e; }
    finally { client.release(); }
  }));
  app.get(`${root}/directory/:company/:country`, requireAuth, route(async (req, res) => {
    const { context, actor } = await internal(req, true);
    const q = z.string().max(100).parse(req.query.q || "").toLocaleLowerCase();
    const providers = await finderProviders(context.billingCompanyId, context.country, actor.canReadPeople);
    const matches = providers.filter(p => !q || `${p.name} ${p.city} ${p.address}`.toLocaleLowerCase().includes(q));
    res.json({ total: matches.length, providers: matches.slice(0, 100) });
  }));
  app.put(`${root}/profile/:company/:country`, requireAuth, route(async (req, res) => {
    const { context } = await internal(req, true);
    const profile = profileSchema.parse(req.body);
    const policyRow = await pool.query("SELECT 1 FROM provider_finder_policies WHERE billing_company_id=$1 AND country=$2", [context.billingCompanyId, context.country]);
    if (!policyRow.rows.length) throw new FinderError("not_configured", 409);
    if (profile.contractValidFrom && profile.contractValidTo && profile.contractValidFrom > profile.contractValidTo) throw new FinderError("invalid");
    if (profile.services.some(s => !context.policy.services.includes(s))) throw new FinderError("invalid");
    const table = profile.type === "clinic" ? "clinics" : "hospitals";
    const { rows } = await pool.query(`SELECT id FROM ${table} WHERE id=$1 AND country_code=$2`, [profile.id, context.country]);
    if (!rows.length) throw new FinderError("not_found", 404);
    if (profile.publicPersonIds.length) {
      const { rows: people } = await pool.query(`SELECT DISTINCT p.id FROM contact_assignments a JOIN collaborators p ON p.id=a.person_id
        WHERE a.entity_type=$1 AND a.entity_id=$2 AND a.is_active=true AND p.is_active=true
        AND (a.start_date IS NULL OR a.start_date<=now()) AND (a.end_date IS NULL OR a.end_date>now())
        AND (p.country_code=$3 OR $3=ANY(p.country_codes))`, [profile.type, profile.id, context.country]);
      if (profile.publicPersonIds.some(id => !people.some(p => p.id === id))) throw new FinderError("invalid");
      const actor = await finderActor(uid(req), context.country, true);
      if (!actor.canReadPeople) throw new FinderError("forbidden", 403);
    }
    await pool.query(`INSERT INTO provider_finder_profiles(billing_company_id,country,facility_type,facility_id,settings,updated_by)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(billing_company_id,country,facility_type,facility_id)
      DO UPDATE SET settings=EXCLUDED.settings,updated_by=EXCLUDED.updated_by,updated_at=now()`,
    [context.billingCompanyId, context.country, profile.type, profile.id, JSON.stringify(profile), uid(req)]);
    res.json({ saved: true });
  }));
  app.get(`${publicRoot}/config`, route(async (req, res) => res.json(await outputConfig(await publicFinderContext(req.params.slug), true))));
  app.get(`${root}/context/:company/:country`, requireAuth, route(async (req, res) => {
    const { context } = await internal(req);
    if (!context.policy.enabled) throw new FinderError("disabled", 409);
    res.json(context);
  }));
  for (const publicView of [false, true]) {
    const prefix = publicView ? publicRoot : `${root}/context/:company/:country`;
    const auth = publicView ? [] : [requireAuth];
    const scope = async (req: Request) => {
      if (publicView) return { context: await publicFinderContext(req.params.slug), actor: { canReadPeople: false } };
      const result = await internal(req);
      if (!result.context.policy.enabled) throw new FinderError("disabled", 409);
      return result;
    };
    app.get(`${prefix}/map-config`, ...auth, route(async (req, res) => {
      await scope(req);
      if (!process.env.GOOGLE_MAPS_BROWSER_API_KEY) throw new FinderError("maps_not_configured", 503);
      // The browser-only key MUST have HTTP referrer + Maps JS API restrictions.
      res.json({ browserKey: process.env.GOOGLE_MAPS_BROWSER_API_KEY });
    }));
    app.post(`${prefix}/geocode`, ...auth, route(async (req, res) => {
      const { context } = await scope(req);
      limited(`geo:${publicView ? req.ip : uid(req)}`, 10);
      limited("geo:global", 120);
      const body = addressSchema.parse(req.body);
      res.json({ candidates: await geocodeFinderAddress(body.address, context.country, body.language) });
    }));
    app.post(`${prefix}/search`, ...auth, route(async (req, res) => {
      const { context, actor } = await scope(req);
      limited(`search:${publicView ? req.ip : uid(req)}`, 60);
      const body = searchSchema.parse(req.body);
      if (body.radiusKm > context.policy.maxRadiusKm || (body.service && !context.policy.services.includes(body.service))) throw new FinderError("invalid");
      const providers = await finderProviders(context.billingCompanyId, context.country, actor.canReadPeople, publicView);
      res.json({ results: rankProviders(providers, context.policy, body, publicView),
        ...(!publicView ? { missingLocations: providers.filter(p => p.active && p.enabled && (p.lat === null || p.lng === null)).length } : {}) });
    }));
  }
  app.get(`${root}/customers/:customerId`, requireAuth, route(async (req, res) => {
    const { rows } = await pool.query(`SELECT country FROM customers WHERE id=$1`, [idSchema.parse(req.params.customerId)]);
    if (!rows[0]) throw new FinderError("not_found", 404);
    const actor = await finderActor(uid(req), rows[0].country);
    const saved = await pool.query("SELECT selection FROM provider_finder_selections WHERE customer_id=$1", [req.params.customerId]);
    if (!saved.rows[0]) { res.json(null); return; }
    const selection = selectionSchema.parse(saved.rows[0].selection);
    if (!actor.canReadPeople) delete selection.personId;
    try { res.json(await validateFinderSelection(selection, false, actor.canReadPeople)); }
    catch (e) { if (e instanceof FinderError && ["selection_unavailable", "disabled", "not_configured", "not_found"].includes(e.code)) res.json({ unavailable: true }); else throw e; }
  }));
  app.put(`${root}/customers/:customerId`, requireAuth, route(async (req, res) => {
    const { rows } = await pool.query(`SELECT country FROM customers WHERE id=$1`, [idSchema.parse(req.params.customerId)]);
    if (!rows[0]) throw new FinderError("not_found", 404);
    const actor = await finderActor(uid(req), rows[0].country);
    if (!actor.canEditCustomer) throw new FinderError("forbidden", 403);
    const selection = selectionSchema.parse(req.body);
    if (selection.country !== rows[0].country) throw new FinderError("forbidden", 403);
    const validated = await validateFinderSelection(selection, false, actor.canReadPeople);
    await pool.query(`INSERT INTO provider_finder_selections(customer_id,selection,selected_by) VALUES($1,$2,$3)
      ON CONFLICT(customer_id) DO UPDATE SET selection=EXCLUDED.selection,selected_by=EXCLUDED.selected_by,selected_at=now()`,
    [req.params.customerId, JSON.stringify(selection), uid(req)]);
    res.json(validated);
  }));
  app.delete(`${root}/customers/:customerId`, requireAuth, route(async (req, res) => {
    const { rows } = await pool.query("SELECT country FROM customers WHERE id=$1", [idSchema.parse(req.params.customerId)]);
    if (!rows[0]) throw new FinderError("not_found", 404);
    const actor = await finderActor(uid(req), rows[0].country);
    if (!actor.canEditCustomer) throw new FinderError("forbidden", 403);
    await pool.query("DELETE FROM provider_finder_selections WHERE customer_id=$1", [req.params.customerId]);
    res.json({ saved: true });
  }));
}

// Called by the existing public submission route, never trusts client labels or country/company scope.
export async function normalizePublicFinderSelection(slug: string, input: unknown) {
  const context = await publicFinderContext(slug);
  const selection = selectionSchema.parse(input);
  if (selection.country !== context.country || selection.billingCompanyId !== context.billingCompanyId)
    throw new FinderError("forbidden", 403);
  return validateFinderSelection(selection, true, false);
}
