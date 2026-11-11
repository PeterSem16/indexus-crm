import assert from "node:assert/strict";
import { test } from "node:test";
import OpenAI, { toFile } from "openai";
import { createAIRouter, parseAIRouterMode, validateAIRoutes, type AITechnicalEvent } from "./ai/router";
import { AI_SERVICES, type AIRoutingOverrides } from "./ai/service-catalog";
import type { AIClientOptions, AIProviderAdapter } from "./ai/openai-adapter";
import { AI_ROUTING_OVERRIDES } from "../config/ai-routing";

const flush = () => new Promise(resolve => setImmediate(resolve));
const completion = { id: "unit", object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content: '{"ok":true}' }, finish_reason: "stop" }] };
function harness(overrides: AIRoutingOverrides = {}, fetcher: typeof fetch = async () =>
  new Response(JSON.stringify(completion), { headers: { "content-type": "application/json" } }),
  mode: "routed" | "legacy" = "routed") {
  const events: AITechnicalEvent[] = [];
  const options: AIClientOptions[] = [];
  const requests: { url: string; init?: RequestInit }[] = [];
  const sdk: OpenAI[] = [];
  const adapter: AIProviderAdapter = {
    id: "openai",
    isAvailable: () => true,
    createClient: config => {
      options.push(config);
      const client = new OpenAI({
        apiKey: "unit-test-placeholder-not-a-real-key",
        maxRetries: 0,
        ...config,
        fetch: async (url, init) => {
          requests.push({ url: String(url), init });
          return fetcher(url, init);
        },
      });
      sdk.push(client);
      return client;
    },
    chatProbe: body => fetcher("https://unit.invalid/chat", { method: "POST", body: JSON.stringify(body) }),
  };
  return { router: createAIRouter({ adapter, overrides, mode, revision: "unit", emit: event => events.push(event) }),
    adapter, events, options, requests, sdk };
}

test("default configuration preserves every service and performs no network/key read during initialization", () => {
  assert.deepEqual(AI_ROUTING_OVERRIDES, {});
  const h = harness();
  for (const service of Object.keys(AI_SERVICES) as (keyof typeof AI_SERVICES)[])
    assert.equal(h.router.available(service), true, service);
  assert.equal(h.options.length, 0);
  assert.equal(h.requests.length, 0);
  assert.equal(h.events.filter(event => event.event === "ai.configuration").length, 1);
  h.adapter.isAvailable = () => false;
  assert.equal(h.router.available("email.sentiment"), false);
});

test("Chat Completions retains models, JSON schemas, options, asResponse and withResponse", async () => {
  const h = harness();
  const client = h.router.client("email.sentiment", { timeout: 15000, maxRetries: 0 });
  const body = { model: "gpt-4o", messages: [{ role: "user" as const, content: "synthetic data" }],
    response_format: { type: "json_object" as const }, temperature: 0.1, max_tokens: 300 };
  const controller = new AbortController();
  const first = client.chat.completions.create(body, { signal: controller.signal, headers: { "x-unit": "preserved" } });
  assert.equal(typeof first.asResponse, "function");
  const raw = await first.asResponse();
  assert.equal(raw.bodyUsed, false, "telemetry must not consume raw responses");
  assert.deepEqual(await raw.json(), completion);
  const second = await client.chat.completions.create(body).withResponse();
  assert.deepEqual(second.data, completion);
  assert.deepEqual(JSON.parse(String(h.requests[0].init?.body)), body);
  assert.equal(new Headers(h.requests[0].init?.headers).get("x-unit"), "preserved");
  assert.deepEqual(h.options, [{ timeout: 15000, maxRetries: 0 }]);
  await flush();
  assert.equal(h.events.filter(event => event.event === "ai.request").length, 2);
});

test("transparent wrapper returns the very same SDK promise and forwards body/options by identity", () => {
  const h = harness();
  const sentinel = { asResponse: () => Promise.resolve(new Response("{}")) };
  const body = { model: "gpt-4o", messages: [] };
  const opts = { signal: new AbortController().signal };
  h.adapter.createClient = () => ({
    chat: { completions: { create: (input: unknown, options: unknown) => {
      assert.strictEqual(input, body);
      assert.strictEqual(options, opts);
      return sentinel;
    } } },
  }) as unknown as OpenAI;
  assert.strictEqual(h.router.client("email.sentiment").chat.completions.create(body, opts), sentinel);
});

test("Responses API forwards multimodal input and preserves SDK output_text and completion status", async () => {
  const expected = { id: "resp_unit", object: "response", status: "completed", output: [
    { type: "message", role: "assistant", content: [{ type: "output_text", text: '{"summary":"unit"}', annotations: [] }] },
  ] };
  const h = harness({}, async () => new Response(JSON.stringify(expected), { headers: { "content-type": "application/json" } }));
  const input = [{ role: "user" as const, content: [
    { type: "input_image" as const, image_url: "data:image/png;base64,dW5pdA==", detail: "auto" as const },
    { type: "input_file" as const, filename: "document.pdf", file_data: "data:application/pdf;base64,dW5pdA==" },
  ] }];
  const response = await h.router.client("automation.analysis", { timeout: 90000, maxRetries: 1 }).responses.create({
    model: "gpt-4o", input, text: { format: { type: "json_object" } }, max_output_tokens: 700,
  });
  assert.equal(response.output_text, '{"summary":"unit"}');
  assert.equal(response.status, "completed");
  assert.deepEqual(JSON.parse(String(h.requests[0].init?.body)).input, input);
  assert.deepEqual(h.options[0], { timeout: 90000, maxRetries: 1 });
});

test("audio transcription keeps multipart file bytes, language and text response", async () => {
  const h = harness({}, async (_url, init) => {
    const form = init?.body as FormData;
    assert.equal(form.get("model"), "whisper-1");
    assert.equal(form.get("language"), "sk");
    assert.equal(form.get("response_format"), "text");
    assert.equal(await (form.get("file") as File).text(), "synthetic audio");
    return new Response("unit transcript", { headers: { "content-type": "text/plain" } });
  });
  const result = await h.router.client("voicemail.transcription").audio.transcriptions.create({
    model: "whisper-1", file: await toFile(Buffer.from("synthetic audio"), "unit.wav"),
    response_format: "text", language: "sk",
  });
  assert.equal(result, "unit transcript");
});

test("speech binary response stays readable, without telemetry consuming its body", async () => {
  const bytes = Buffer.from([0, 1, 2, 255]);
  const h = harness({}, async () => new Response(bytes, { headers: { "content-type": "audio/wav" } }));
  const response = await h.router.client("ivr.speech").audio.speech.create({
    model: "tts-1", voice: "alloy", input: "unit", response_format: "wav",
  });
  assert.equal(response.bodyUsed, false);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
});

test("streaming survives HTTP-only observation", async () => {
  const chunk = { id: "unit", object: "chat.completion.chunk", choices: [{ index: 0, delta: { content: "unit" }, finish_reason: null }] };
  const h = harness({}, async () => new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`,
    { headers: { "content-type": "text/event-stream" } }));
  const stream = await h.router.client("virtual_agent.response").chat.completions.create({
    model: "gpt-4o-mini", stream: true, messages: [{ role: "user", content: "unit" }],
  });
  const chunks = [];
  for await (const value of stream) chunks.push(value);
  assert.deepEqual(chunks, [chunk]);
});

test("original SDK HTTP errors and retry policy survive, without leaking error bodies or prompts", async () => {
  const marker = "SYNTHETIC_PRIVATE_CONTENT";
  const h = harness({}, async () => new Response(JSON.stringify({ error: { message: marker, type: "invalid_request_error", code: "unit" } }),
    { status: 400, headers: { "content-type": "application/json" } }));
  await assert.rejects(h.router.client("email.sentiment", { maxRetries: 0 }).chat.completions.create({
    model: "gpt-4o", messages: [{ role: "user", content: marker }],
  }), error => error instanceof OpenAI.APIError && error.status === 400 && error.message.includes(marker));
  await flush();
  assert.equal(h.requests.length, 1, "no fallback or added retries");
  assert.equal(JSON.stringify(h.events).includes(marker), false);
  assert.equal(JSON.stringify(h.events).includes("unit-test-placeholder"), false);
  const event = h.events.find(event => event.event === "ai.request")!;
  assert.equal(event.outcome, "error");
  assert.equal(event.httpStatus, 400);
  assert.equal(event.service, "email.sentiment");
});

test("AbortSignal preserves SDK user-abort behavior with no fallback", async () => {
  const h = harness();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(h.router.client("task.resolution").chat.completions.create({
    model: "gpt-4o-mini", messages: [],
  }, { signal: controller.signal }), error => error instanceof OpenAI.APIUserAbortError);
  assert.equal(h.requests.length, 0);
});

test("per-service override is isolated and never mutates input; operation capability is checked", async () => {
  const h = harness({ "email.sentiment": { provider: "openai", model: "gpt-4o-mini", enabled: true } });
  const body = { model: "gpt-4o", messages: [] };
  await h.router.client("email.sentiment").chat.completions.create(body);
  await h.router.client("sms.sentiment").chat.completions.create(body);
  assert.equal(JSON.parse(String(h.requests[0].init?.body)).model, "gpt-4o-mini");
  assert.equal(JSON.parse(String(h.requests[1].init?.body)).model, "gpt-4o");
  assert.equal(body.model, "gpt-4o");
  assert.throws(() => h.router.client("email.sentiment").audio.speech.create({
    model: "tts-1", voice: "alloy", input: "unit",
  }), /ai_router_unsupported_operation/);
});

test("invalid providers, fallback, keys, URLs, service IDs and unknown fields are rejected", () => {
  for (const value of [
    { "email.sentiment": { provider: "internal", model: null, enabled: true } },
    { "email.sentiment": { provider: "openai", model: null, enabled: true, fallback: "openai" } },
    { "email.sentiment": { provider: "openai", model: null, enabled: true, apiKey: "unit" } },
    { "email.sentiment": { provider: "openai", model: null, enabled: true, baseURL: "http://unit.invalid" } },
    { "unknown": { provider: "openai", model: null, enabled: true } },
    { "email.sentiment": { provider: "openai", model: "bad model", enabled: true } },
  ]) assert.throws(() => validateAIRoutes(value as AIRoutingOverrides), /ai_router_invalid_configuration/);
  const h = harness({ "email.sentiment": { provider: "openai", model: null, enabled: false } });
  assert.equal(h.router.available("email.sentiment"), false);
  assert.throws(() => h.router.client("email.sentiment").chat.completions.create({
    model: "gpt-4o", messages: [],
  }), /ai_service_disabled/);
  assert.equal(h.requests.length, 0);
});

test("legacy mode ignores even broken routing config and returns the unwrapped SDK", async () => {
  const h = harness({ invalid: { provider: "internal" } } as unknown as AIRoutingOverrides, undefined, "legacy");
  const raw = h.router.client("email.sentiment", { maxRetries: 0 });
  assert.strictEqual(raw, h.sdk[0]);
  const response = await raw.chat.completions.create({ model: "gpt-4o", messages: [] });
  assert.deepEqual(response, completion);
  assert.equal(h.events.some(event => event.event === "ai.request"), false);
});

test("raw health probe preserves HTTP status/body and does not parse the response", async () => {
  const h = harness({}, async () => new Response('{"error":{"code":"unit"}}', { status: 401 }));
  const response = await h.router.chatProbe("beratung.health", {
    model: "gpt-4o-mini", messages: [{ role: "user", content: "ok" }], max_tokens: 1,
  });
  assert.equal(response.status, 401);
  assert.equal(response.bodyUsed, false);
  assert.deepEqual(await response.json(), { error: { code: "unit" } });
});

test("configuration fingerprint is stable and changes on a routing change", () => {
  const a = harness(), b = harness();
  a.router.initialize(); b.router.initialize();
  assert.equal(a.events[0].configurationHash, b.events[0].configurationHash);
  const changed = harness({ "email.sentiment": { provider: "openai", model: "gpt-4o-mini", enabled: true } });
  changed.router.initialize();
  assert.notEqual(a.events[0].configurationHash, changed.events[0].configurationHash);
});

test("invalid rollback modes fail explicitly; logging errors never break requests", async () => {
  assert.equal(parseAIRouterMode(undefined), "routed");
  assert.equal(parseAIRouterMode("legacy"), "legacy");
  assert.throws(() => parseAIRouterMode("typo"), /ai_router_invalid_mode/);
  const h = harness();
  const router = createAIRouter({ adapter: h.adapter, overrides: {}, mode: "routed", revision: "unit",
    emit: () => { throw new Error("logging failed"); } });
  assert.deepEqual(await router.client("email.sentiment").chat.completions.create({
    model: "gpt-4o", messages: [],
  }), completion);
});
