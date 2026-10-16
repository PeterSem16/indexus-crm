import type { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { pool } from "../db";
import { finderPolicySchema, rankProviders, searchSchema, selectionSchema, type FinderContext } from "../../shared/provider-finder";
import { FinderError, finderActor, finderContext, finderProviders, publicFinderContext, validateFinderSelection } from "./provider-finder-store";
import { addressSchema, createFinderGeocoder } from "./provider-finder-geocode";
import { finderMapsReadiness } from "./provider-finder-maps-config";

const geocodeFinderAddress = createFinderGeocoder({
  key: () => finderMapsReadiness().geocodingReady ? process.env.GOOGLE_MAPS_SERVER_API_KEY : undefined,
  fetcher: (...args) => fetch(...args),
});

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
    const context = await finderContext("country", country, true);
    res.json(context.policy.enabled ? [context] : []);
  }));
  const getCountryConfig = route(async (req, res) => {
    const country = countrySchema.parse(req.params.country);
    await finderActor(uid(req), country, true);
    const context = await finderContext("country", country, true);
    const { rows: forms } = await pool.query(`SELECT w.id,w.name,b.country AS "boundCountry"
      FROM web_forms w LEFT JOIN provider_finder_country_forms b ON b.form_id=w.id
      WHERE w.country_code=$1 AND w.is_active=true ORDER BY w.name`, [context.country]);
    res.json({ ...context, forms: forms.map(({ id, name }) => ({ id, name })),
      formIds: forms.filter(f => f.boundCountry === context.country).map(f => f.id) });
  });
  const putCountryConfig = route(async (req, res) => {
    const country = countrySchema.parse(req.params.country);
    await finderActor(uid(req), country, true);
    const body = z.object({ policy: finderPolicySchema, formIds: z.array(idSchema).max(100) }).strict().parse(req.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`provider-finder:${country}`]);
      if (body.formIds.length) {
        const valid = await client.query(`SELECT id FROM web_forms WHERE id=ANY($1::varchar[]) AND country_code=$2 AND is_active=true FOR UPDATE`, [body.formIds, country]);
        if (valid.rows.length !== new Set(body.formIds).size) throw new FinderError("invalid");
      }
      // The retired per-site service/publication controls no longer determine eligibility.
      const policy = { ...body.policy, services: [], requireContract: false, preferContract: false, preferRecentContact: false };
      await client.query(`INSERT INTO provider_finder_country_policies(country,settings,updated_by)
        VALUES($1,$2,$3) ON CONFLICT(country) DO UPDATE
        SET settings=EXCLUDED.settings,updated_by=EXCLUDED.updated_by,updated_at=now()`,
      [country, JSON.stringify(policy), uid(req)]);
      await client.query(`DELETE FROM provider_finder_country_forms WHERE country=$1 AND NOT(form_id=ANY($2::varchar[]))`,
        [country, body.formIds]);
      for (const id of new Set(body.formIds)) {
        await client.query(`INSERT INTO provider_finder_country_forms(form_id,country) VALUES($1,$2)
          ON CONFLICT(form_id) DO UPDATE SET country=EXCLUDED.country`, [id, country]);
      }
      await client.query("COMMIT");
      res.json({ saved: true });
    } catch (e) { await client.query("ROLLBACK"); throw e; }
    finally { client.release(); }
  });
  app.get(`${root}/country-config/:country`, requireAuth, getCountryConfig);
  app.put(`${root}/country-config/:country`, requireAuth, putCountryConfig);
  app.get(`${root}/config/:company/:country`, requireAuth, getCountryConfig);
  app.put(`${root}/config/:company/:country`, requireAuth, putCountryConfig);
  app.get(`${root}/directory/:company/:country`, requireAuth, route(async (req, res) => {
    const { context, actor } = await internal(req, true);
    const q = z.string().max(100).parse(req.query.q || "").toLocaleLowerCase();
    const providers = await finderProviders(context.billingCompanyId, context.country, actor.canReadPeople);
    const matches = providers.filter(p => !q || `${p.name} ${p.city} ${p.address}`.toLocaleLowerCase().includes(q));
    res.json({ total: matches.length, providers: matches.slice(0, 100) });
  }));
  app.put(`${root}/profile/:company/:country`, requireAuth, route(async (req, res) => {
    await finderActor(uid(req), countrySchema.parse(req.params.country), true);
    throw new FinderError("site_profiles_retired", 410);
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
      if (!finderMapsReadiness().mapReady) throw new FinderError("maps_not_configured", 503);
      res.json({ provider: "google", browserKey: process.env.GOOGLE_MAPS_BROWSER_API_KEY?.trim() });
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
