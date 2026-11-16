import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { Client } from "pg";
import { createAIRouter } from "./router";
import { createInternalAIAdapter } from "./internal-adapter";
import { AI_SERVICES } from "./service-catalog";
import { AI_ROUTING_OVERRIDES } from "../../config/ai-routing";
import { DEFAULT_AI_SETTINGS, parseRoute, freshSmoke } from "./settings-policy";
import { EMAIL_MONITORING_PROFILE as profile } from "./email-monitoring-profile";
import { INTERNAL_TEXT_MODELS, internalModelsForService } from "./internal-contract";
import { emailMonitoringSchema, parseEmailMonitoringAnalysis } from "./email-monitoring-contract";
import { analyzeSource, bindAnalyzer } from "../../../script/ai-email-monitoring-b1/source.cjs";
import { B1_EMAIL_CASES } from "../../../script/ai-email-monitoring-b1/corpus";
import { createTestTable, verifyPersistence } from "../../../script/ai-email-monitoring-b1/persistence";

const source = analyzeSource(path.resolve("server/lib/email-monitoring-service.ts"));
const token = "SYNTHETIC_B1_TOKEN";
const valid = { sentiment: "neutral", hasInappropriateContent: false, hasAngryTone: false,
  hasRudeExpressions: false, wantsToCancel: false, wantsConsent: false,
  doesNotAcceptContract: false, alertLevel: "none", note: "Syntetická analýza." };
function harness(options: { reply?: unknown; httpStatus?: number; noOverride?: boolean;
  offline?: boolean; managed?: boolean; unavailableModel?: boolean; capTokens?: number; discoveryStatus?: number } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const openaiRequests: any[] = [];
  const fakeOpenAI: any = { id: "openai", isAvailable: () => true,
    createClient: () => ({ chat: { completions: { create: async (body: any) => {
      openaiRequests.push(body); return { choices: [{ message: { content: JSON.stringify(valid) } }] };
    } } } }), chatProbe: async () => new Response() };
  const adapter = createInternalAIAdapter({
    readConfiguration: () => ({ enabled: true, production: true, replit: false, token,
      baseURL: "https://ai.cordbloodcenter.com/gateway/" }),
    ...(options.managed ? { readSettings: () => ({ ...DEFAULT_AI_SETTINGS.gateway,
      enabled: true, maxTokens: 4096, temperature: 1.2 }) } : {}),
    fetch: (async (url: any, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (options.offline) throw Error("SYNTHETIC_PRIVATE_ERROR");
      const pathname = new URL(String(url)).pathname.replace("/gateway/", "");
      if (pathname === "health/ready") return new Response(null, { status: options.discoveryStatus ?? 200 });
      if (pathname === "v1/models") return Response.json({ object: "list", data: options.unavailableModel ? [] : [{ id: profile.model }] });
      if (pathname === "indexus/v1/capabilities") return Response.json({ apiVersion: "1", models: [{
        id: profile.model, revision: "SYN-B1", operations: ["chat.completions"], inputModalities: ["text"],
        outputFormats: ["json_object"], streaming: false, maxInputTokens: 8192, maxOutputTokens: options.capTokens ?? 200,
      }] });
      if (options.httpStatus) return Response.json({ secret: "DO_NOT_LEAK_SYNTHETIC" }, { status: options.httpStatus });
      const content = typeof options.reply === "string" ? options.reply : JSON.stringify(options.reply ?? valid);
      return Response.json({ id: "SYN-B1-completion", object: "chat.completion", model: profile.model,
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] });
    }) as typeof fetch,
  });
  const router = createAIRouter({ adapter: fakeOpenAI, adapters: [adapter],
    overrides: options.noOverride ? {} : { "email.monitoring": { provider: "internal", model: profile.model, enabled: true } },
    revision: "isolated-B1-test", mode: "routed", emit() {} });
  const analyze = bindAnalyzer(source, (service: any) => router.client(service, { maxRetries: 0, timeout: 1000 }),
    parseEmailMonitoringAnalysis);
  return { router, analyze, adapter, calls, openaiRequests };
}
test("isolated route uses the exact B1 endpoint/model/parameters and unchanged original system prompt", async () => {
  const h = harness({ managed: true });
  assert.deepEqual(await h.analyze(B1_EMAIL_CASES[0].content), valid);
  assert.equal(h.openaiRequests.length, 0);
  assert.equal(h.calls.length, 4);
  assert.ok(h.calls.every(call => call.init?.redirect === "error"));
  assert.deepEqual(h.calls.slice(0, 3).map(call => call.url), [
    "https://ai.cordbloodcenter.com/gateway/health/ready",
    "https://ai.cordbloodcenter.com/gateway/v1/models",
    "https://ai.cordbloodcenter.com/gateway/indexus/v1/capabilities",
  ]);
  assert.ok(h.calls.slice(0, 3).every(call => call.init?.method === "GET"));
  assert.equal(h.calls[3].init?.method, "POST");
  const sent = JSON.parse(String(h.calls.at(-1)!.init!.body));
  assert.equal(h.calls.at(-1)!.url, "http://10.9.2.140/gateway/v1/chat/completions");
  assert.equal(sent.model, profile.model);
  assert.equal(sent.temperature, 0.1); assert.equal(sent.max_tokens, 200);
  assert.equal(sent.stream, false); assert.deepEqual(sent.response_format, { type: "json_object" });
  const original = harness({ noOverride: true }); await original.analyze(B1_EMAIL_CASES[0].content);
  assert.equal(JSON.stringify(sent.messages), JSON.stringify(original.openaiRequests[0].messages));
  assert.ok(h.calls.every(call => new Headers(call.init?.headers).get("authorization") === `Bearer ${token}`));
});
test("a discovery redirect stops B1 before private inference and never enables cloud fallback", async () => {
  const h = harness({ discoveryStatus: 301 });
  await assert.rejects(h.analyze("SYNTHETIC EMAIL"));
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, "https://ai.cordbloodcenter.com/gateway/health/ready");
  assert.equal(h.calls[0].init?.redirect, "error");
  assert.equal(h.openaiRequests.length, 0);
});
test("production defaults remain OpenAI, Gateway remains off, all 64 other service routes stay unchanged", async () => {
  assert.deepEqual(AI_ROUTING_OVERRIDES, {});
  assert.equal(DEFAULT_AI_SETTINGS.gateway.enabled, false);
  assert.deepEqual(DEFAULT_AI_SETTINGS.routes, {});
  assert.deepEqual(INTERNAL_TEXT_MODELS, ["indexus-document-audio:latest"]);
  for (const service of Object.keys(AI_SERVICES).filter(s => s !== "email.monitoring")) {
    assert.equal(internalModelsForService(service).includes(profile.model), false);
    assert.throws(() => parseRoute(service, { provider: "internal", model: profile.model, enabled: true }));
  }
  const h = harness({ noOverride: true }); await h.analyze("SYNTHETIC EMAIL");
  assert.equal(h.calls.length, 0); assert.equal(h.openaiRequests[0].model, "gpt-4o-mini");
  assert.equal(h.openaiRequests[0].response_format, undefined);
  const unaffected = harness();
  await unaffected.router.client("email.sentiment").chat.completions.create({ model: "gpt-4o-mini", messages: [] });
  assert.equal(unaffected.calls.length, 0);
  assert.equal(unaffected.openaiRequests.length, 1);
});
test("dedicated model cannot be used by an unscoped adapter or another service", () => {
  const h = harness();
  const request = { model: profile.model, messages: [{ role: "user" as const, content: "SYNTHETIC" }] };
  assert.throws(() => h.adapter.createClient({}).chat.completions.create(request));
  assert.throws(() => h.adapter.createClient({}, { service: "email.sentiment" }).chat.completions.create(request));
  assert.equal(h.calls.length, 0);
  assert.equal(parseRoute("email.monitoring", { provider: "internal", model: profile.model, enabled: true }).model, profile.model);
});
test("a smoke check for the original model cannot authorize the dedicated model", () => {
  const check: any = { kind: "smoke", state: "ready", settingsVersion: 1, textVerified: true,
    jsonVerified: true, checkedAt: new Date().toISOString(), models: [{
      id: "indexus-document-audio:latest", outputFormats: ["text", "json_object"],
    }] };
  assert.equal(freshSmoke(check, 1), true);
  assert.equal(freshSmoke(check, 1, Date.now(), profile.model), false);
  const dedicated = { ...check, textVerified: false, models: [{
    id: profile.model, outputFormats: ["json_object"],
  }] };
  assert.equal(freshSmoke(dedicated, 1, Date.now(), profile.model), true);
});
for (const [label, reply] of Object.entries({
  incomplete: { sentiment: "neutral" }, wrongBoolean: { ...valid, wantsConsent: "false" },
  unknownField: { ...valid, consent: true }, unknownSentiment: { ...valid, sentiment: "happy" },
  oversizedNote: { ...valid, note: "x".repeat(101) }, malformed: '{"sentiment":',
})) test(`invalid nine-field response ${label} is rejected before persistence with no cloud fallback`, async () => {
  const h = harness({ reply });
  await assert.rejects(h.analyze("SYNTHETIC EMAIL"));
  assert.equal(h.openaiRequests.length, 0);
});
for (const status of [401, 403, 429, 500, 504])
  test(`Gateway HTTP ${status} fails safely without retry, fabricated analysis or OpenAI fallback`, async () => {
    const h = harness({ httpStatus: status });
    await assert.rejects(h.analyze("SYNTHETIC EMAIL"), (e: any) => {
      assert.equal(e.status, status);
      assert.equal(String(e).includes("DO_NOT_LEAK_SYNTHETIC"), false);
      return true;
    });
    assert.equal(h.calls.filter(c => c.url.endsWith("/chat/completions")).length, 1);
    assert.equal(h.openaiRequests.length, 0);
  });
test("unavailable Gateway does not fall back to OpenAI", async () => {
  const h = harness({ offline: true });
  await assert.rejects(h.analyze("SYNTHETIC EMAIL"), (e: any) =>
    e.code === "ai_internal_transport_error" && !String(e).includes("SYNTHETIC_PRIVATE_ERROR"));
  assert.equal(h.calls.length, 1); assert.equal(h.openaiRequests.length, 0);
});
for (const [label, options, code] of [
  ["missing model", { unavailableModel: true }, "ai_internal_model_unavailable"],
  ["insufficient declared output limit", { capTokens: 199 }, "ai_internal_token_limit_exceeded"],
] as const) test(`${label} blocks inference instead of silently changing the requested model or token budget`, async () => {
  const h = harness(options);
  await assert.rejects(h.analyze("SYNTHETIC EMAIL"), (error: any) => error.code === code);
  assert.equal(h.calls.some(call => call.url.endsWith("/chat/completions")), false);
  assert.equal(h.openaiRequests.length, 0);
});
test("receipt and consent booleans are preserved, never repaired by a text heuristic", async () => {
  for (const wantsConsent of [false, true]) {
    const h = harness({ reply: { ...valid, wantsConsent } });
    assert.equal((await h.analyze("SYNTHETIC EMAIL")).wantsConsent, wantsConsent);
  }
  assert.equal(Object.keys(emailMonitoringSchema.shape).length, 9);
});
test("actual PostgreSQL persistence stores all nine fields without touching CRM rows", async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 });
  try {
    await db.connect(); await db.query("BEGIN"); await createTestTable(db);
    for (const wantsConsent of [false, true]) {
      const h = harness({ reply: { ...valid, wantsConsent } });
      const result = await verifyPersistence(db, `SYN-B1-${wantsConsent}`, await h.analyze("SYNTHETIC EMAIL"));
      assert.equal(result.nineFieldSnapshot, true);
    }
    const angry: any = { ...valid, sentiment: "angry", alertLevel: "critical", wantsToCancel: true,
      hasInappropriateContent: true, hasAngryTone: true, hasRudeExpressions: true, doesNotAcceptContract: true };
    await verifyPersistence(db, "SYN-B1-ALL-FLAGS", angry);
  } finally { await db.query("ROLLBACK").catch(() => {}); await db.end(); }
});
