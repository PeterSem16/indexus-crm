import type { Express, RequestHandler, Request, Response } from "express";
import { AI_SERVICES } from "./service-catalog";
import { internalAIAdapter } from "./internal-adapter";
import { openAIAdapter } from "./openai-adapter";
import type { AISettingsStore } from "./settings-store";
import { AISettingsError, assertVersion, freshSmoke, internalEligible, parseGateway, parseRoute } from "./settings-policy";
import { assertInternalRuntime, checkAIProvider } from "./settings-check";
import { parseAIRouterMode } from "./router";
import type { AISettingsView, AIVerification } from "../../../shared/ai-settings";

type Dependencies = {
  store: AISettingsStore; requireAdmin: RequestHandler;
  internal?: typeof internalAIAdapter; openai?: typeof openAIAdapter;
  check?: typeof checkAIProvider;
};
export function registerAISettingsRoutes(app: Express, dependencies: Dependencies) {
  const { store, requireAdmin } = dependencies;
  const internal = dependencies.internal ?? internalAIAdapter, openai = dependencies.openai ?? openAIAdapter;
  const root = "/api/configurator/ai";
  const view = async (): Promise<AISettingsView> => {
    const state = await store.read();
    return { version: state.version, gateway: state.value.gateway,
      services: Object.entries(AI_SERVICES).map(([id, operation]) => ({
        id, operation, route: state.value.routes[id] ?? { provider: "openai", model: null, enabled: true },
        internalEligible: internalEligible(id),
      })),
      runtime: { ...internal.runtimeStatus(), openaiConfigured: openai.isAvailable(),
        mode: parseAIRouterMode(process.env.INDEXUS_AI_ROUTER_MODE) },
      gatewayCheck: state.gatewayCheck, openaiCheck: state.openaiCheck, audit: await store.audit() };
  };
  const wrap = (handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      try {
        // JSON-only writes and same-origin browser requests; no arbitrary fetch targets.
        if (req.method !== "GET") {
          if (!req.is("application/json")) throw new AISettingsError("request_invalid", 415);
          const origin = req.get("origin");
          if (origin && new URL(origin).host !== req.get("host")) throw new AISettingsError("forbidden", 403);
        }
        await handler(req, res);
      } catch (error) {
        const status = error instanceof AISettingsError ? error.status : 503;
        const code = error instanceof AISettingsError ? error.code : "settings_unavailable";
        res.status(status).json({ error: code, code });
      }
    };
  const actor = (req: Request) => (req.session as { user?: { id: string } }).user!.id;
  app.get(root, requireAdmin, wrap(async (_req, res) => res.json(await view())));
  app.put(root + "/gateway", requireAdmin, wrap(async (req, res) => {
    if (!req.body || Object.keys(req.body).some(key => !["expectedVersion", "gateway"].includes(key)))
      throw new AISettingsError("gateway_config_invalid");
    const gateway = parseGateway(req.body.gateway);
    await store.mutate(req.body.expectedVersion, actor(req), "gateway", state => {
      const changed = JSON.stringify(gateway) !== JSON.stringify(state.value.gateway);
      if (changed && gateway.enabled && Object.values(state.value.routes).some(route => route.enabled && route.provider === "internal"))
        throw new AISettingsError("switch_services_first", 409);
      return { ...state.value, gateway };
    });
    res.json(await view());
  }));
  app.put(root + "/route", requireAdmin, wrap(async (req, res) => {
    if (!req.body || Object.keys(req.body).some(key => !["expectedVersion", "service", "route", "confirmInternal"].includes(key)) ||
      typeof req.body.service !== "string") throw new AISettingsError("route_invalid");
    const service = req.body.service, route = parseRoute(service, req.body.route);
    await store.mutate(req.body.expectedVersion, actor(req), "route", state => {
      if (route.provider === "internal" && route.enabled) {
        assertInternalRuntime(internal);
        if (!state.value.gateway.enabled || req.body.confirmInternal !== true ||
          !freshSmoke(state.gatewayCheck, state.version)) throw new AISettingsError("verification_required", 409);
      }
      return { ...state.value, routes: { ...state.value.routes, [service]: route } };
    });
    res.json(await view());
  }));
  app.post(root + "/test", requireAdmin, wrap(async (req, res) => {
    if (!req.body || Object.keys(req.body).some(key => !["expectedVersion", "kind"].includes(key)) ||
      !["connectivity", "smoke", "openai"].includes(req.body.kind)) throw new AISettingsError("request_invalid");
    assertVersion(req.body.expectedVersion);
    // Session advisory lock coordinates PM2 workers; always release the same client.
    const lock = await store.pool.connect();
    let locked = false;
    try {
      locked = (await lock.query("SELECT pg_try_advisory_lock(1991202612) AS locked")).rows[0].locked;
      if (!locked) throw new AISettingsError("test_busy", 429);
      const state = await store.read();
      if (state.version !== req.body.expectedVersion) throw new AISettingsError("version_conflict", 409);
      const previous = [state.gatewayCheck, state.openaiCheck].filter(Boolean) as AIVerification[];
      if (previous.some(check => Date.now() - Date.parse(check.checkedAt) < 30_000)) throw new AISettingsError("test_cooldown", 429);
      const checking: AIVerification = { state: "checking", kind: req.body.kind, settingsVersion: state.version,
        checkedAt: new Date().toISOString(), durationMs: 0, textVerified: false, jsonVerified: false, models: [] };
      await store.recordCheck(state.version, actor(req), checking);
      const result = await (dependencies.check ?? checkAIProvider)(req.body.kind, state.version, { internal, openai });
      await store.recordCheck(state.version, actor(req), result);
      res.json(await view());
    } finally {
      if (locked) await lock.query("SELECT pg_advisory_unlock(1991202612)").catch(() => {});
      lock.release();
    }
  }));
}
