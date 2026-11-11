import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import express, { type RequestHandler } from "express";
import pg from "pg";
import { pool } from "../../db";
import { AISettingsStore } from "./settings-store";
import { aiSettingsAdminGuard } from "./settings-authorization";
import { registerAISettingsRoutes } from "./settings-controller";
import { createInternalAIAdapter } from "./internal-adapter";
import { AISettingsError, DEFAULT_AI_SETTINGS } from "./settings-policy";
import type { AIVerification } from "../../../shared/ai-settings";

test("AI administration: isolated development DB, real HTTP, persistence, concurrency and revocation",
  { skip: !(process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN) ? "DB integration is Replit-development-only; never run on CORPCRM01" : false },
  async t => {
    const schema = "ai_settings_test_" + randomUUID().replaceAll("-", "");
    await pool.query(`CREATE SCHEMA ${schema}`);
    const database = new pg.Pool({ ...pool.options, max: 5, options: `-c search_path=${schema}` });
    const store = new AISettingsStore(database);
    let authorized = true, checks = 0, providerCalls = 0, authReads = 0;
    let releaseCheck: (() => void) | undefined, blocking = false;
    const runtime = { enabled: true, production: true, replit: false,
      baseURL: DEFAULT_AI_SETTINGS.gateway.baseURL, token: "synthetic-test-placeholder" };
    const internal = createInternalAIAdapter({ readConfiguration: () => runtime,
      fetch: async () => { providerCalls++; throw new Error("No network allowed in HTTP/persistence fixtures"); } });
    const requireAuth: RequestHandler = (req, res, next) => {
      if (req.get("x-unit-user") !== "admin-fixture") { res.status(401).json({ code: "unauthorized" }); return; }
      (req as any).session = { user: { id: "admin-fixture", role: "admin" } }; next();
    };
    const guard = aiSettingsAdminGuard({ query: async (sql: string, values: string[]) => {
      authReads++; assert.match(sql, /u\.is_active=true/); assert.match(sql, /r\.legacy_role='admin'/);
      assert.deepEqual(values, ["admin-fixture"]);
      return { rows: authorized ? [{ id: "admin-fixture" }] : [] };
    } } as any, requireAuth);
    const app = express(); app.use(express.json());
    registerAISettingsRoutes(app, { store, requireAdmin: guard, internal,
      openai: { id: "openai", isAvailable: () => true, createClient() { throw new Error("No provider calls"); },
        chatProbe() { throw new Error("No provider calls"); } },
      check: async (kind, version) => {
        checks++; if (blocking) await new Promise<void>(resolve => { releaseCheck = resolve; });
        return { kind, state: "ready", settingsVersion: version, checkedAt: new Date().toISOString(),
          durationMs: 3, textVerified: kind !== "connectivity", jsonVerified: kind === "smoke",
          models: [{ id: "indexus-document-audio:latest", revision: "unit", outputFormats: ["text", "json_object"],
            maxInputTokens: 4096, maxOutputTokens: 1024 }] };
      } });
    const server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const root = `http://127.0.0.1:${(server.address() as any).port}/api/configurator/ai`;
    const call = async (path = "", method = "GET", body?: any, headers: Record<string, string> = {}) => {
      const response = await fetch(root + path, { method,
        headers: { "x-unit-user": "admin-fixture", ...(body ? { "content-type": "application/json" } : {}), ...headers },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, body: await response.json(), response };
    };
    const ageCheck = async () => {
      const current = await store.read();
      const check = current.gatewayCheck;
      if (check) await store.recordCheck(current.version, "admin-fixture",
        { ...check, checkedAt: new Date(Date.now() - 40_000).toISOString() });
    };
    try {
      await store.initialize(); await store.initialize();
      let view = (await call()).body;
      await t.test("startup is idempotent and every service defaults to unchanged OpenAI", async () => {
        assert.equal(view.version, 1); assert.equal(view.gateway.enabled, false);
        assert.equal(view.services.length, 65);
        assert(view.services.every((s: any) => s.route.provider === "openai" && s.route.model === null && s.route.enabled));
        assert.equal(providerCalls, 0);
        assert.equal((await call()).response.headers.get("cache-control"), "no-store");
      });
      await t.test("unauthenticated and revoked/inactive administrators cannot read or mutate settings", async () => {
        assert.equal((await call("", "GET", undefined, { "x-unit-user": "" })).status, 401);
        authorized = false;
        assert.equal((await call()).status, 403);
        assert.equal((await call("/gateway", "PUT", { expectedVersion: 1, gateway: view.gateway })).status, 403);
        authorized = true;
        assert(authReads >= 3);
      });
      await t.test("unapproved URL, tokens in JSON and cross-origin writes are rejected", async () => {
        assert.equal((await call("/gateway", "PUT", { expectedVersion: 1,
          gateway: { ...view.gateway, baseURL: "https://evil.invalid/" } })).status, 400);
        assert.equal((await call("/gateway", "PUT", { expectedVersion: 1,
          gateway: { ...view.gateway, token: "do-not-store" } })).status, 400);
        assert.equal((await call("/gateway", "PUT", { expectedVersion: 1, gateway: view.gateway },
          { origin: "https://evil.invalid" })).status, 403);
        assert.equal((await store.read()).version, 1);
      });
      view = (await call("/gateway", "PUT", { expectedVersion: 1, gateway: { ...view.gateway, enabled: true } })).body;
      const route = { provider: "internal", model: "indexus-document-audio:latest", enabled: true };
      const activate = () => call("/route", "PUT", { expectedVersion: view.version, service: "email.summary", route, confirmInternal: true });
      await t.test("persisted Gateway configuration survives another store instance; activation requires inference proof", async () => {
        const second = new AISettingsStore(database); await second.initialize();
        assert.equal((await second.read()).value.gateway.enabled, true);
        assert.equal((await activate()).body.code, "verification_required");
        const result = await call("/test", "POST", { expectedVersion: view.version, kind: "connectivity" });
        assert.equal(result.status, 200); view = result.body;
        assert.equal((await activate()).body.code, "verification_required");
        assert.equal((await call("/test", "POST", { expectedVersion: view.version, kind: "smoke" })).body.code, "test_cooldown");
      });
      await ageCheck();
      view = (await call("/test", "POST", { expectedVersion: view.version, kind: "smoke" })).body;
      await t.test("explicit confirmation and fresh smoke enable one service, never the others", async () => {
        assert.equal((await call("/route", "PUT", { expectedVersion: view.version, service: "email.summary", route })).status, 409);
        const result = await activate(); assert.equal(result.status, 200); view = result.body;
        assert.equal(view.services.find((s: any) => s.id === "email.summary").route.provider, "internal");
        assert(view.services.filter((s: any) => s.id !== "email.summary").every((s: any) => s.route.provider === "openai"));
        assert.equal(view.gatewayCheck.settingsVersion, view.version);
        assert.equal((await call("/gateway", "PUT", { expectedVersion: view.version,
          gateway: { ...view.gateway, temperature: 0.2 } })).body.code, "switch_services_first");
        assert.equal(providerCalls, 0);
      });
      await t.test("concurrent updates have one winner; failed callbacks roll back without audit loss", async () => {
        const request = { expectedVersion: view.version, service: "email.reply",
          route: { provider: "openai", model: null, enabled: false } };
        const results = await Promise.all([call("/route", "PUT", request), call("/route", "PUT", request)]);
        assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
        view = (await call()).body;
        const count = (await store.audit()).length;
        await assert.rejects(store.mutate(view.version, "admin-fixture", "route", () => {
          throw new AISettingsError("unit_rollback");
        }), { code: "unit_rollback" });
        assert.equal((await store.read()).version, view.version);
        assert.equal((await store.audit()).length, count);
      });
      await t.test("emergency disable invalidates readiness and returning to original OpenAI stays possible", async () => {
        view = (await call("/gateway", "PUT", { expectedVersion: view.version,
          gateway: { ...view.gateway, enabled: false } })).body;
        assert.equal(view.gatewayCheck, null);
        view = (await call("/route", "PUT", { expectedVersion: view.version, service: "email.summary",
          route: { provider: "openai", model: null, enabled: true } })).body;
        assert.equal(view.services.find((s: any) => s.id === "email.summary").route.model, null);
        assert.equal((await store.read()).value.routes["email.summary"].provider, "openai");
      });
      await t.test("test lock coordinates workers and config changes reject obsolete in-flight results", async () => {
        blocking = true;
        const pending = call("/test", "POST", { expectedVersion: view.version, kind: "smoke" });
        for (let i = 0; i < 100 && !releaseCheck; i++) await new Promise(resolve => setTimeout(resolve, 10));
        assert(releaseCheck);
        assert.equal((await call("/test", "POST", { expectedVersion: view.version, kind: "smoke" })).body.code, "test_busy");
        view = (await call("/route", "PUT", { expectedVersion: view.version, service: "email.reply",
          route: { provider: "openai", model: null, enabled: true } })).body;
        releaseCheck(); blocking = false;
        assert.equal((await pending).body.code, "version_conflict");
        assert.equal((await store.read()).gatewayCheck, null);
        assert(checks >= 3); assert.equal(providerCalls, 0);
        const serialized = JSON.stringify((await call()).body);
        assert.equal(serialized.includes("synthetic-test-placeholder"), false);
        assert.equal(serialized.includes("do-not-store"), false);
        assert((await store.audit()).length >= 5);
      });
    } finally {
      releaseCheck?.();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await database.end();
      await pool.query(`DROP SCHEMA ${schema} CASCADE`);
      await pool.end();
    }
  });
