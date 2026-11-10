import type { Express, RequestHandler } from "express";
import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "./db";
import { completeTerritorySuggestion, recommendTerritories, regionCatalogue } from "./lib/representative-region-suggestions";
import {
  DistributionError, parseDistributionInput, tables, representativeUsers, selectionRows,
  regionGroups, buildDistribution, saveDistribution, processDistribution,
} from "./lib/representative-distribution";

type Dependencies = {
  requireAuth: RequestHandler; requireManagerOrAdmin: RequestHandler;
  parseCriteria: (raw: unknown) => any; countryScopeForRequest: (req: any, requested: unknown) => string[] | undefined;
  resolveBulkSelection: (input: any) => Promise<{ ids: string[] }>;
};
const suggestionRequests = new Map<string, number[]>();
export function registerRepresentativeDistributionRoutes(app: Express, deps: Dependencies) {
  const auth = [deps.requireAuth, deps.requireManagerOrAdmin];
  const endpoint = (handler: (req: any, client: any) => Promise<any>, write = false): RequestHandler => async (req, res) => {
    let client: any;
    try {
      client = await pool.connect();
      await client.query("BEGIN");
      if (write) await client.query(`SELECT pg_advisory_xact_lock(hashtext('representative-distribution'))`);
      const result = await handler(req, client);
      await client.query("COMMIT"); res.json(result);
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      if (error instanceof DistributionError) res.status(error.status).json({ code: error.code });
      else if (error instanceof Error && /criteria|filterRules|countryScope|Unsupported/.test(error.message)) res.status(400).json({ code: "invalid" });
      else { console.error("[representative-distribution] request failed"); res.status(500).json({ code: "error" }); }
    } finally { client?.release(); }
  };
  const scope = (req: any, criteria?: any) => deps.countryScopeForRequest(req,
    criteria?.countryScope ?? (typeof req.query.countries === "string" ? req.query.countries.split(",") : undefined));
  async function rowsFor(req: any, client: any, input: ReturnType<typeof parseDistributionInput>) {
    const criteria = deps.parseCriteria(input.criteria);
    input.criteria = criteria;
    const result = await deps.resolveBulkSelection({ entity: input.entity, criteria, req, executor: drizzle(client) });
    return selectionRows(client, input.entity, result.ids, input.fromUserId);
  }
  app.get("/api/representatives/distribution/users", ...auth, endpoint(async (req, client) =>
    representativeUsers(client, scope(req))));
  app.post("/api/representatives/distribution/suggestions", ...auth, endpoint(async (req, client) => {
    const { countryCode, mode, territories } = req.body || {};
    if (typeof countryCode !== "string" || !/^[A-Z]{2}$/.test(countryCode)
      || !["official", "balanced"].includes(mode)) throw new DistributionError("invalid");
    const criteria = deps.parseCriteria(req.body.criteria);
    const allowed = scope(req, criteria);
    if (allowed && !allowed.includes(countryCode)) throw new DistributionError("scope", 403);
    const t = tables(req.body.entity);
    regionCatalogue(countryCode, []); // Reject unsupported catalogues before querying or calling AI.
    if (mode === "balanced") {
      if (!Number.isInteger(territories) || territories < 2 || territories > 10) throw new DistributionError("invalid");
      const now = Date.now();
      for (const [id, times] of suggestionRequests) if (!times.some(at => at > now - 60000)) suggestionRequests.delete(id);
      const recent = (suggestionRequests.get(req.session.user.id) || []).filter(at => at > now - 60000);
      if (recent.length >= 6) throw new DistributionError("rate_limited", 429);
      suggestionRequests.set(req.session.user.id, [...recent, now]);
    }
    // The proposed country/regions replace those filters on Apply. Count the
    // same population, preserving all other search/AND/OR portfolio criteria.
    const result = await deps.resolveBulkSelection({ entity: req.body.entity, criteria: {
      ...criteria, country: countryCode, countries: undefined, region: undefined,
      filterRules: (criteria.filterRules || []).filter((rule: any) => rule.field !== "region" && rule.field !== "country"),
    }, req, executor: drizzle(client) });
    const { rows } = await client.query(`SELECT region,count(*)::int AS count FROM ${t.entity}
      WHERE id=ANY($1::varchar[]) AND country_code=$2 GROUP BY region ORDER BY region NULLS LAST`, [result.ids, countryCode]);
    const data = regionCatalogue(countryCode, rows);
    const groups = mode === "balanced" ? await recommendTerritories(data.catalogue, territories, completeTerritorySuggestion) : [];
    return { countryCode, mode, source: mode === "balanced" ? "ai" : "catalogue", ...data, groups };
  }));
  app.post("/api/representatives/distribution/regions", ...auth, endpoint(async (req, client) => {
    const input = parseDistributionInput({ ...req.body, kind: req.body.kind || "assign", regions: [] });
    const rows = await rowsFor(req, client, input);
    return { groups: regionGroups(rows), total: rows.length };
  }));
  app.post("/api/representatives/distribution/plans", ...auth, endpoint(async (req, client) => {
    const input = parseDistributionInput(req.body);
    const t = tables(input.entity);
    // Complete criteria, current assignments and the commit are protected together.
    await client.query(`LOCK TABLE ${t.entity},${t.assignments} IN SHARE ROW EXCLUSIVE MODE`);
    const rows = await rowsFor(req, client, input);
    const built = await buildDistribution(client, input, rows, req.session.user.id);
    const summary = {
      affected: built.affected, unchanged: built.unchanged, groups: built.groups, fingerprint: built.fingerprint,
      total: built.total, selected: built.selected, alreadyAssigned: built.alreadyAssigned,
      unselected: built.unselected, previewGroups: built.previewGroups,
    };
    if (req.body.dryRun === true) return summary;
    if (req.body.fingerprint !== built.fingerprint) throw new DistributionError("stale", 409);
    if (!built.affected) throw new DistributionError("empty");
    const planId = await saveDistribution(client, input, built, req.session.user.id);
    await processDistribution(client, planId);
    return { ...summary, planId };
  }, true));
  app.get("/api/representatives/distribution/plans", ...auth, endpoint(async (req, client) => {
    const t = tables(req.query.entity);
    const { rows } = await client.query(`
      SELECT p.id,p.kind,p.starts_at AS "startsAt",p.ends_at AS "endsAt",
        COALESCE(u.full_name,p.from_user_id) AS "sourceName",
        count(*)::int AS total,
        count(*) FILTER(WHERE i.status='pending')::int AS pending,
        count(*) FILTER(WHERE i.status='active')::int AS active,
        count(*) FILTER(WHERE i.status='completed')::int AS completed,
        count(*) FILTER(WHERE i.status='skipped')::int AS skipped,
        count(*) FILTER(WHERE i.status='conflict')::int AS conflict
      FROM representative_distribution_plans p
      JOIN representative_distribution_items i ON i.plan_id=p.id
      JOIN ${t.entity} e ON e.id=i.entity_id
      LEFT JOIN users u ON u.id=p.from_user_id
      WHERE p.entity_type=$1 AND ($2::text[] IS NULL OR e.country_code=ANY($2))
      GROUP BY p.id,u.full_name ORDER BY p.created_at DESC LIMIT 30`,
    [req.query.entity, scope(req) ?? null]);
    return rows;
  }));
  app.post("/api/representatives/distribution/plans/:id/end", ...auth, endpoint(async (req, client) => {
    if (!/^[a-f0-9-]{36}$/i.test(req.params.id)) throw new DistributionError("invalid");
    const { rows: [plan] } = await client.query(`SELECT * FROM representative_distribution_plans WHERE id=$1 FOR UPDATE`, [req.params.id]);
    if (!plan || plan.kind !== "temporary") throw new DistributionError("invalid", 404);
    const t = tables(plan.entity_type);
    const allowed = scope(req);
    const { rows } = await client.query(`SELECT e.country_code FROM representative_distribution_items i
      JOIN ${t.entity} e ON e.id=i.entity_id WHERE i.plan_id=$1`, [plan.id]);
    if (allowed && rows.some((r: any) => !allowed.includes(r.country_code))) throw new DistributionError("scope", 403);
    const now = new Date();
    await client.query(`UPDATE representative_distribution_plans SET ends_at=$2 WHERE id=$1`, [plan.id, now]);
    await client.query(`UPDATE representative_distribution_items SET status='skipped',reason='cancelled'
      WHERE plan_id=$1 AND status='pending'`, [plan.id]);
    await client.query(`UPDATE representative_distribution_items SET status='active',reason=NULL
      WHERE plan_id=$1 AND status='conflict'`, [plan.id]);
    await processDistribution(client, plan.id, now, req.session.user.id);
    return { ok: true };
  }, true));
}

let workerStarted = false;
/** Restart-safe, DB-backed timer. Each plan is atomic and serialized with manager changes. */
export function startRepresentativeDistributionWorker() {
  if (workerStarted) return;
  workerStarted = true;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const { rows } = await pool.query(`SELECT DISTINCT p.id FROM representative_distribution_plans p
        JOIN representative_distribution_items i ON i.plan_id=p.id
        WHERE (i.status='pending' AND p.starts_at<=now()) OR (i.status='active' AND p.ends_at<=now())
        LIMIT 25`);
      for (const plan of rows) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(`SELECT pg_advisory_xact_lock(hashtext('representative-distribution'))`);
          await processDistribution(client, plan.id);
          await client.query("COMMIT");
        } catch { await client.query("ROLLBACK"); console.error("[representative-distribution] scheduled processing failed"); }
        finally { client.release(); }
      }
    } catch { console.error("[representative-distribution] scheduled scan failed"); }
    finally { running = false; }
  };
  void tick();
  setInterval(() => void tick(), 30000).unref();
}
