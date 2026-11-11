import assert from "node:assert/strict";
import { test } from "node:test";
import OpenAI from "openai";
import { createInternalAIAdapter, type InternalAIConfiguration } from "./internal-adapter";
import { InternalAIError, validateInternalDiscovery, validateInternalRequest } from "./internal-contract";
import { createAIRouter, validateAIRoutes, type AITechnicalEvent } from "./router";
import type { AIProviderAdapter } from "./openai-adapter";
import type { AIRoutingOverrides } from "./service-catalog";
import { AI_ROUTING_OVERRIDES } from "../../config/ai-routing";

const model = "indexus-document-audio:latest";
const token = "synthetic-unit-token-not-a-real-secret";
const body = () => ({ model, messages: [{ role: "user" as const, content: "SYNTHETIC_PRIVATE_INPUT" }],
  response_format: { type: "json_object" as const }, max_tokens: 128, stream: false as const });
const completion = () => ({ id: "gw-unit", object: "chat.completion", model,
  choices: [{ index: 0, message: { role: "assistant", content: '{"ok":true}' }, finish_reason: "stop" }] });
const models = () => ({ object: "list", data: [{ id: model, object: "model" }] });
const capabilities = () => ({ apiVersion: "1", models: [{ id: model, revision: "unit-revision",
  operations: ["chat.completions"], inputModalities: ["text"], outputFormats: ["text", "json_object"],
  streaming: false, maxInputTokens: null, maxOutputTokens: 1024 }] });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value),
  { status, headers: { "content-type": "application/json" } });
const configuration = (): InternalAIConfiguration => ({
  enabled: true, production: true, replit: false, baseURL: "https://gateway.unit.invalid/prefix/", token,
});

function harness(change?: (path: string, init?: RequestInit) => Response | Promise<Response> | undefined,
  config: InternalAIConfiguration = configuration()) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const adapter = createInternalAIAdapter({
    readConfiguration: () => config,
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      const path = new URL(String(url)).pathname.replace("/prefix/", "");
      const changed = await change?.(path, init);
      if (changed) return changed;
      if (path === "health/ready") return new Response(null);
      if (path === "v1/models") return json(models());
      if (path === "indexus/v1/capabilities") return json(capabilities());
      if (path === "v1/chat/completions") return json(completion());
      throw new Error("Unexpected unit request");
    },
  });
  return { adapter, calls };
}

test("default routes remain empty; internal adapter creation/readiness is network-free", () => {
  assert.deepEqual(AI_ROUTING_OVERRIDES, {});
  const h = harness();
  assert.equal(h.adapter.isAvailable(), true);
  h.adapter.createClient({});
  assert.equal(h.calls.length, 0);
});

for (const [name, patch] of Object.entries({
  replit: { replit: true }, nonproduction: { production: false }, disabled: { enabled: false },
  missingURL: { baseURL: undefined }, missingToken: { token: undefined },
  plaintext: { baseURL: "http://gateway.unit.invalid" }, URLcredentials: { baseURL: "https://user:pass@gateway.unit.invalid" },
  URLquery: { baseURL: "https://gateway.unit.invalid/?token=unit" }, URLfragment: { baseURL: "https://gateway.unit.invalid/#unit" },
  audioProduction: { baseURL: "https://gateway.unit.invalid:8765" },
  audioTest: { baseURL: "https://gateway.unit.invalid:8766" },
  analyzer: { baseURL: "https://gateway.unit.invalid:8780" },
  ollama: { baseURL: "https://gateway.unit.invalid:11434" },
  headerInjection: { token: "unit\r\nunsafe" },
})) test(`configuration ${name} fails closed without any network request`, async () => {
  const h = harness(undefined, { ...configuration(), ...patch });
  assert.equal(h.adapter.isAvailable(), false);
  assert.throws(() => h.adapter.createClient({}), InternalAIError);
  await assert.rejects(h.adapter.inspect(), InternalAIError);
  assert.equal(h.calls.length, 0);
});

test("discovery uses authenticated agreed paths and never follows redirects", async () => {
  const h = harness();
  const result = await h.adapter.inspect();
  assert.equal(result.ready, true);
  assert.deepEqual(result.models[0], { id: model, revision: "unit-revision",
    outputFormats: ["text", "json_object"], maxInputTokens: null, maxOutputTokens: 1024 });
  assert.deepEqual(h.calls.map(call => new URL(call.url).pathname),
    ["/prefix/health/ready", "/prefix/v1/models", "/prefix/indexus/v1/capabilities"]);
  for (const call of h.calls) {
    assert.equal(call.init?.redirect, "error");
    assert.equal(new Headers(call.init?.headers).get("authorization"), `Bearer ${token}`);
    assert.ok(call.url.startsWith("https://gateway.unit.invalid/"));
  }
});

test("text and JSON normalize to existing SDK contracts and retain APIPromise helpers", async () => {
  const h = harness(() => undefined);
  const client = h.adapter.createClient({});
  const input = body();
  const promise = client.chat.completions.create(input);
  assert.equal(typeof promise.asResponse, "function");
  assert.equal(typeof promise.withResponse, "function");
  const { data, response } = await promise.withResponse();
  assert.equal(response.status, 200);
  assert.equal(data.choices[0].message.content, '{"ok":true}');
  assert.equal(h.calls.length, 4);
  assert.deepEqual(JSON.parse(String(h.calls[3].init?.body)), input);
  assert.equal(input.model, model);
  const plain = { ...body(), response_format: { type: "text" as const } };
  assert.equal((await client.chat.completions.create(plain)).model, model);
});

for (const [name, patch] of Object.entries({
  unapprovedModel: { model: "unknown-model" },
  streaming: { stream: true },
  strictSchema: { response_format: { type: "json_schema", json_schema: {} } },
  tools: { tools: [] },
  temperature: { temperature: 3 },
  invalidTokens: { max_tokens: 0 },
  multimodal: { messages: [{ role: "user", content: [{ type: "input_image" }] }] },
  toolRole: { messages: [{ role: "tool", content: "unit" }] },
})) test(`unsupported ${name} is rejected before contacting Gateway`, () => {
  const h = harness(), client = h.adapter.createClient({});
  assert.throws(() => client.chat.completions.create({ ...body(), ...patch } as any), InternalAIError);
  assert.equal(h.calls.length, 0);
});

for (const status of [401, 403, 404, 422, 429, 503, 504, 302]) {
  test(`HTTP ${status} remains explicit, sanitized and never falls back`, async () => {
    const marker = `SENSITIVE_${token}_SYNTHETIC_PRIVATE_INPUT`;
    const h = harness(path => path === "health/ready" ? new Response(marker, { status }) : undefined);
    await assert.rejects(h.adapter.createClient({ maxRetries: 0 }).chat.completions.create(body()), error => {
      assert.ok(error instanceof OpenAI.APIError);
      assert.equal(error.status, status === 302 ? 502 : status);
      assert.equal(error.message.includes(marker), false);
      assert.equal(JSON.stringify(error).includes(token), false);
      return true;
    });
    assert.equal(h.calls.length, 1);
  });
}

test("truncated, malformed, wrong-model and invalid JSON completions are not success", async () => {
  for (const result of [
    { ...completion(), model: "wrong" },
    { ...completion(), choices: [] },
    { ...completion(), choices: [{ ...completion().choices[0], finish_reason: "length" }] },
    { ...completion(), choices: [{ ...completion().choices[0], message: { role: "assistant", content: "not JSON" } }] },
    { ...completion(), choices: [{ ...completion().choices[0], message: { role: "assistant", content: "[]" } }] },
  ]) {
    const h = harness(path => path === "v1/chat/completions" ? json(result) : undefined);
    await assert.rejects(h.adapter.createClient({}).chat.completions.create(body()), OpenAI.APIError);
    assert.equal(h.calls.length, 4);
  }
});

test("capability claims do not enable strict schemas; token limits fail before inference", async () => {
  const h = harness(path => {
    if (path !== "indexus/v1/capabilities") return;
    const value = capabilities(); value.models[0].outputFormats = ["text", "json_schema"];
    return json(value);
  });
  await assert.rejects(h.adapter.createClient({}).chat.completions.create(body()), /ai_internal_output_format_unavailable/);
  assert.equal(h.calls.length, 3);
  const limits = harness();
  await assert.rejects(limits.adapter.createClient({}).chat.completions.create({ ...body(), max_tokens: 2048 }),
    /ai_internal_token_limit_exceeded/);
  assert.equal(limits.calls.length, 3);
});

test("discovery never grants an unlisted model and rejects malformed version/limits", async () => {
  assert.deepEqual(validateInternalDiscovery({ object: "list", data: [] }, capabilities(), [model]), []);
  for (const value of [
    { ...capabilities(), apiVersion: "2" },
    { ...capabilities(), models: [...capabilities().models, ...capabilities().models] },
    { ...capabilities(), models: [{ ...capabilities().models[0], maxOutputTokens: -1 }] },
  ]) assert.throws(() => validateInternalDiscovery(models(), value, [model]), InternalAIError);
  assert.throws(() => validateInternalRequest({ ...body(), messages: [] }, [model]), InternalAIError);
});

test("network failures and oversized/malformed metadata never leak raw errors", async () => {
  const h = harness(() => { throw new Error(`private ${token}`); });
  await assert.rejects(h.adapter.inspect(), error => error instanceof InternalAIError &&
    error.code === "ai_internal_transport_error" && !error.message.includes(token));
  const big = harness(path => path === "v1/models" ? new Response("x".repeat(256 * 1024 + 1)) : undefined);
  await assert.rejects(big.adapter.inspect(), /ai_internal_response_too_large/);
  const malformed = harness(path => path === "v1/models" ? json("not-a-list") : undefined);
  await assert.rejects(malformed.adapter.inspect(), /ai_internal_invalid_discovery/);
});

test("abort and bounded discovery timeout stop requests without fallback", async () => {
  const h = harness();
  const controller = new AbortController(); controller.abort();
  await assert.rejects(h.adapter.createClient({}).chat.completions.create(body(), { signal: controller.signal }),
    OpenAI.APIUserAbortError);
  assert.equal(h.calls.length, 0);
  const pending = harness((_path, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("synthetic aborted")), { once: true });
  }));
  await assert.rejects(pending.adapter.inspect({ timeoutMs: 10 }), { name: "AbortError" });
  assert.equal(pending.calls.length, 1);
});

test("router selects internal only for explicit text routes; legacy skips the internal provider", async () => {
  const events: AITechnicalEvent[] = [];
  let external = 0;
  const openai: AIProviderAdapter = { id: "openai", isAvailable: () => true,
    createClient: () => { external++; throw new Error("unit external call"); },
    chatProbe: async () => { external++; throw new Error("unit external probe"); } };
  const h = harness();
  const overrides: AIRoutingOverrides = { "email.sentiment": { provider: "internal", model, enabled: true } };
  const router = createAIRouter({ adapter: openai, adapters: [h.adapter], overrides, revision: "unit",
    mode: "routed", emit: event => events.push(event) });
  assert.equal(router.available("email.sentiment"), true);
  const original = { ...body(), model: "gpt-4o" };
  await router.client("email.sentiment").chat.completions.create(original);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(original.model, "gpt-4o");
  assert.equal(external, 0);
  assert.equal(events.find(event => event.event === "ai.request")?.provider, "internal");
  assert.equal(JSON.stringify(events).includes(token), false);
  assert.equal(JSON.stringify(events).includes("SYNTHETIC_PRIVATE_INPUT"), false);
  for (const service of ["automation.analysis", "ivr.speech", "beratung.health"])
    assert.throws(() => validateAIRoutes({ [service]: { provider: "internal", model, enabled: true } } as any));
  const legacy = createAIRouter({ adapter: openai, adapters: [h.adapter], overrides, revision: "unit",
    mode: "legacy", emit: () => {} });
  assert.throws(() => legacy.client("email.sentiment"), /unit external call/);
  assert.equal(external, 1);
  assert.equal(h.calls.length, 4);
});

test("internal error cannot invoke OpenAI even when that provider is healthy", async () => {
  let external = 0;
  const openai: AIProviderAdapter = { id: "openai", isAvailable: () => true,
    createClient: () => { external++; throw new Error("must not run"); },
    chatProbe: async () => { external++; throw new Error("must not run"); } };
  const h = harness(() => json({ error: "private" }, 503));
  const router = createAIRouter({ adapter: openai, adapters: [h.adapter], revision: "unit", mode: "routed",
    overrides: { "email.sentiment": { provider: "internal", model, enabled: true } }, emit: () => {} });
  await assert.rejects(router.client("email.sentiment", { maxRetries: 0 }).chat.completions.create(body()), OpenAI.APIError);
  assert.equal(external, 0);
  assert.equal(h.calls.length, 1);
});
