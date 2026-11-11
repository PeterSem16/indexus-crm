import assert from "node:assert/strict";
import { test } from "node:test";
import OpenAI from "openai";
import { AI_SERVICES } from "./service-catalog";
import { AISettingsError, DEFAULT_AI_SETTINGS, freshSmoke, internalEligible, parseGateway, parseRoute, parseSettings } from "./settings-policy";
import { createAdminAIRouter } from "./admin-router";
import { createInternalAIAdapter } from "./internal-adapter";
import { checkAIProvider } from "./settings-check";
import type { AIVerification } from "../../../shared/ai-settings";
import type { AIProviderAdapter } from "./openai-adapter";

const model = "indexus-document-audio:latest";
const verified = (): AIVerification => ({ kind: "smoke", state: "ready", settingsVersion: 1,
  checkedAt: new Date().toISOString(), durationMs: 5, textVerified: true, jsonVerified: true,
  models: [{ id: model, revision: "unit", outputFormats: ["text", "json_object"], maxInputTokens: null, maxOutputTokens: 1024 }] });
test("new installation has no provider overrides and Gateway is off", () => {
  assert.deepEqual(parseSettings(DEFAULT_AI_SETTINGS), DEFAULT_AI_SETTINGS);
  assert.equal(DEFAULT_AI_SETTINGS.gateway.enabled, false);
  assert.deepEqual(DEFAULT_AI_SETTINGS.routes, {});
  for (const service of Object.keys(AI_SERVICES)) assert.deepEqual(
    parseRoute(service, { provider: "openai", model: null, enabled: true }),
    { provider: "openai", model: null, enabled: true });
});
for (const url of [
  "http://ai.cordbloodcenter.com/gateway/", "https://attacker.invalid/gateway/",
  "https://ai.cordbloodcenter.com/gateway/?token=x", "https://ai.cordbloodcenter.com/gateway/#x",
  "https://user:password@ai.cordbloodcenter.com/gateway/", "https://ai.cordbloodcenter.com:8770/gateway/",
  "https://ai.cordbloodcenter.com/", "https://ai.cordbloodcenter.com/gateway/../",
  "https://ai.cordbloodcenter.com.evil.invalid/gateway/",
]) test(`administration refuses unapproved destination ${url}`, () => {
  assert.throws(() => parseGateway({ ...DEFAULT_AI_SETTINGS.gateway, baseURL: url }), AISettingsError);
});
test("canonical slash normalization and strict secret-free/numeric settings", () => {
  assert.equal(parseGateway({ ...DEFAULT_AI_SETTINGS.gateway, baseURL: "https://ai.cordbloodcenter.com/gateway" }).baseURL,
    DEFAULT_AI_SETTINGS.gateway.baseURL);
  for (const patch of [{ token: "DO_NOT_STORE" }, { timeoutMs: 1 }, { timeoutMs: 120001 }, { maxRetries: 3 },
    { temperature: -1 }, { temperature: Infinity }, { maxTokens: 8193 }, { enabled: "true" }])
    assert.throws(() => parseGateway({ ...DEFAULT_AI_SETTINGS.gateway, ...patch }), AISettingsError);
  assert.throws(() => parseSettings({ ...DEFAULT_AI_SETTINGS, token: "DO_NOT_STORE" }), AISettingsError);
});
for (const service of ["collection.document", "geography.priority", "automation.analysis", "mobile.voice_note", "ivr.speech", "beratung.health", "unknown"])
  test(`unsupported service ${service} cannot use internal text routing`, () => {
    assert.equal(internalEligible(service), false);
    assert.throws(() => parseRoute(service, { provider: "internal", model, enabled: true }), AISettingsError);
  });
test("internal routes require the approved model and service ID", () => {
  assert.equal(parseRoute("email.summary", { provider: "internal", model, enabled: true }).model, model);
  for (const bad of [null, "unknown:model", "token\r\ninjection"])
    assert.throws(() => parseRoute("email.summary", { provider: "internal", model: bad, enabled: true }));
});
test("only a fresh current-version complete text+JSON smoke permits activation", () => {
  assert.equal(freshSmoke(verified(), 1), true);
  for (const patch of [
    { state: "failed" }, { kind: "connectivity" }, { settingsVersion: 2 }, { jsonVerified: false }, { textVerified: false },
    { checkedAt: new Date(Date.now() - 16 * 60_000).toISOString() },
    { checkedAt: new Date(Date.now() + 60_000).toISOString() }, { checkedAt: "bad" }, { models: [] },
  ]) assert.equal(freshSmoke({ ...verified(), ...patch } as AIVerification, 1), false);
});

function routingHarness(mode: "routed" | "legacy" = "routed") {
  let version = 1, routes = {}, reads = 0, unavailable = false, failInternal = false;
  const calls: { provider: string; body: any }[] = [], events: any[] = [];
  const adapter = (id: "openai" | "internal"): AIProviderAdapter => ({
    id, isAvailable: () => true, chatProbe: async body => { calls.push({ provider: id, body }); return new Response("ok"); },
    createClient: options => new OpenAI({ apiKey: "unit-test-placeholder", ...options, maxRetries: 0,
      fetch: async (_url, init) => {
        const body = JSON.parse(init?.body as string);
        calls.push({ provider: id, body });
        if (id === "internal" && failInternal) return new Response("UNSAFE_VENDOR_DETAIL", { status: 503 });
        return new Response(JSON.stringify({ id: "test", model: body.model, object: "chat.completion",
          choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "ok" } }] }),
          { headers: { "content-type": "application/json", "x-request-id": "unit-request-id" } });
      } }),
  });
  const router = createAdminAIRouter({ adapter: adapter("openai"), adapters: [adapter("internal")],
    overrides: {}, revision: "unit", mode, emit: event => events.push(event) }, {
    reload: async () => { reads++; if (unavailable) throw new Error("DB unavailable"); },
    snapshot: () => ({ version, value: { ...DEFAULT_AI_SETTINGS, routes } }),
  });
  return { router, calls, events, reads: () => reads,
    change(route: any) { version++; routes = { "email.summary": route }; },
    failDB() { unavailable = true; }, failInternal() { failInternal = true; } };
}
const request = () => ({ model: "gpt-4o", messages: [{ role: "user" as const, content: "synthetic" }], temperature: 0.2 });
test("a previously created client observes provider/model/disable changes on the next request", async () => {
  const h = routingHarness(), client = h.router.client("email.summary"), original = request();
  await client.chat.completions.create(original);
  h.change({ provider: "internal", model, enabled: true });
  await client.chat.completions.create(original);
  h.change({ provider: "openai", model: "gpt-4o-mini", enabled: true });
  await client.chat.completions.create(original);
  assert.deepEqual(h.calls.map(call => [call.provider, call.body.model]),
    [["openai", "gpt-4o"], ["internal", model], ["openai", "gpt-4o-mini"]]);
  assert.deepEqual(original, request());
  h.change({ provider: "openai", model: null, enabled: false });
  await assert.rejects(client.chat.completions.create(original), { code: "ai_service_disabled" });
  assert.equal(h.calls.length, 3);
  assert.equal(h.reads(), 4);
});
test("raw asResponse stays unread; withResponse and await retain SDK metadata", async () => {
  const h = routingHarness(), client = h.router.client("email.summary");
  const raw = await client.chat.completions.create(request()).asResponse();
  assert.equal(raw.bodyUsed, false);
  assert.equal((await raw.json()).choices[0].message.content, "ok");
  const combined = await client.chat.completions.create(request()).withResponse();
  assert.equal(combined.request_id, "unit-request-id");
  assert.equal(combined.data.choices[0].message.content, "ok");
  assert.equal((await client.chat.completions.create(request())).choices[0].message.content, "ok");
});
test("DB admission failure blocks outgoing requests instead of using a cached cloud route", async () => {
  const h = routingHarness(), client = h.router.client("email.summary");
  await client.chat.completions.create(request());
  h.failDB();
  await assert.rejects(client.chat.completions.create(request()), /DB unavailable/);
  assert.equal(h.calls.length, 1);
});
test("internal error never retries with OpenAI", async () => {
  const h = routingHarness(); h.change({ provider: "internal", model, enabled: true }); h.failInternal();
  await assert.rejects(h.router.client("email.summary").chat.completions.create(request()));
  assert.deepEqual(h.calls.map(call => call.provider), ["internal"]);
  assert.equal(JSON.stringify(h.events).includes("UNSAFE_VENDOR_DETAIL"), false);
});
test("legacy rollback bypasses persisted overrides and DB admission entirely", async () => {
  const h = routingHarness("legacy"); h.change({ provider: "internal", model, enabled: false }); h.failDB();
  await h.router.client("email.summary").chat.completions.create(request());
  assert.deepEqual(h.calls.map(call => [call.provider, call.body.model]), [["openai", "gpt-4o"]]);
  assert.equal(h.reads(), 0);
});

function gatewayHarness(patch: Record<string, any> = {}, wrongJSON = false) {
  const calls: string[] = [];
  const adapter = createInternalAIAdapter({ readConfiguration: () => ({
    enabled: true, production: true, replit: false, baseURL: "https://gateway.unit.invalid/gateway/",
    token: "synthetic-unit-token", ...patch,
  }), fetch: async (input, init) => {
    const path = new URL(String(input)).pathname; calls.push(path);
    let value: any = {};
    if (path.endsWith("/v1/models")) value = { object: "list", data: [{ id: model }] };
    else if (path.endsWith("/capabilities")) value = { apiVersion: "1", models: [{ id: model, revision: "unit",
      operations: ["chat.completions"], inputModalities: ["text"], outputFormats: ["text", "json_object"],
      streaming: false, maxInputTokens: 4096, maxOutputTokens: 1024 }] };
    else if (path.endsWith("/completions")) {
      const body = JSON.parse(init?.body as string);
      value = { id: "unit", object: "chat.completion", model, choices: [{ index: 0, finish_reason: "stop",
        message: { role: "assistant", content: body.response_format ?
          JSON.stringify({ marker: "indexus-test", sum: wrongJSON ? 6 : 5 }) : "INDEXUS_TEST_OK" } }] };
    }
    return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
  } });
  return { adapter, calls };
}
test("connectivity discovery makes zero inference calls and cannot count as smoke", async () => {
  const h = gatewayHarness(), result = await checkAIProvider("connectivity", 1, { internal: h.adapter });
  assert.equal(result.state, "ready"); assert.equal(result.textVerified, false);
  assert.equal(h.calls.length, 3); assert.equal(freshSmoke(result, 1), false);
});
test("synthetic smoke validates exact text and JSON and reports model capabilities", async () => {
  const h = gatewayHarness(), result = await checkAIProvider("smoke", 1, { internal: h.adapter });
  assert.equal(result.state, "ready"); assert.equal(freshSmoke(result, 1), true);
  assert.equal(h.calls.filter(call => call.endsWith("/completions")).length, 2);
  assert.equal(JSON.stringify(result).includes("synthetic-unit-token"), false);
  assert.equal(JSON.stringify(result).includes("INDEXUS_TEST_OK"), false);
});
test("incorrect model arithmetic is not a green connection/activation result", async () => {
  const h = gatewayHarness({}, true), result = await checkAIProvider("smoke", 1, { internal: h.adapter });
  assert.equal(result.state, "failed"); assert.equal(result.code, "ai_internal_json_smoke_failed");
  assert.equal(result.textVerified, true); assert.equal(result.jsonVerified, false);
});
test("managed internal parameters replace only explicitly configured defaults without mutating caller data", async () => {
  const bodies: any[] = [];
  const gateway = { ...DEFAULT_AI_SETTINGS.gateway, enabled: true, temperature: 0.1, maxTokens: 100, maxRetries: 1, timeoutMs: 7000 };
  const adapter = createInternalAIAdapter({
    readSettings: () => gateway,
    readConfiguration: () => ({ enabled: true, production: true, replit: false,
      baseURL: "https://unit.invalid/gateway/", token: "synthetic-unit-token" }),
    fetch: async (url, init) => {
      const path = new URL(String(url)).pathname;
      let value: any = {};
      if (path.endsWith("/models")) value = { object: "list", data: [{ id: model }] };
      if (path.endsWith("/capabilities")) value = { apiVersion: "1", models: [{ id: model, revision: "unit",
        operations: ["chat.completions"], inputModalities: ["text"], outputFormats: ["text", "json_object"],
        streaming: false, maxInputTokens: 4096, maxOutputTokens: 1024 }] };
      if (path.endsWith("/completions")) {
        bodies.push(JSON.parse(init?.body as string));
        value = { id: "unit", object: "chat.completion", model, choices: [{ index: 0, finish_reason: "stop",
          message: { role: "assistant", content: "ok" } }] };
      }
      return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
    },
  });
  const original = { ...request(), model, max_tokens: 64 }, copy = structuredClone(original);
  const client = adapter.createClient({ timeout: 99000, maxRetries: 0 });
  await client.chat.completions.create(original);
  assert.equal(client.timeout, 7000); assert.equal(client.maxRetries, 1);
  assert.equal(bodies[0].temperature, 0.1); assert.equal(bodies[0].max_tokens, 100);
  assert.deepEqual(original, copy);
});
for (const [name, patch] of Object.entries({ replit: { replit: true }, development: { production: false },
  secretMissing: { token: undefined }, transportOff: { enabled: false } }))
  test(`diagnostics ${name} are blocked before network`, async () => {
    const h = gatewayHarness(patch), result = await checkAIProvider("smoke", 1, { internal: h.adapter });
    assert.equal(result.state, "blocked"); assert.equal(h.calls.length, 0);
  });
