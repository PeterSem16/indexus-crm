import test from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import { createInternalAIAdapter } from "./internal-adapter";
import { DEFAULT_AI_SETTINGS } from "./settings-policy";
import { AI_SERVICES } from "./service-catalog";
import { EMAIL_MONITORING_PROFILE as profile } from "./email-monitoring-profile";

const baseURL = "https://ai.cordbloodcenter.com/gateway/";
const valid = { sentiment: "neutral", hasInappropriateContent: false, hasAngryTone: false,
  hasRudeExpressions: false, wantsToCancel: false, wantsConsent: true,
  doesNotAcceptContract: false, alertLevel: "none", note: "Súhlasí s termínom stretnutia." };
const body = { model: profile.model, messages: [{ role: "user" as const, content: "SYNTHETIC" }],
  response_format: { type: "json_object" as const }, max_tokens: 200 };
function adapter(fetch?: typeof globalThis.fetch) {
  return createInternalAIAdapter({
    readConfiguration: () => ({ production: true, replit: false, enabled: true,
      baseURL, token: "SYNTHETIC_B112_NO_REAL_CREDENTIAL" }),
    readSettings: () => ({ ...DEFAULT_AI_SETTINGS.gateway, timeoutMs: 30_000, maxRetries: 0 }),
    fetch,
  });
}
test("only email.monitoring overrides managed/client timeout, without mutating configuration", () => {
  const internal = adapter();
  assert.equal(internal.createClient({ timeout: 1000 }, { service: "email.monitoring" }).timeout, 120_000);
  assert.equal(internal.createClient({}).timeout, 30_000);
  for (const service of Object.keys(AI_SERVICES).filter(s => s !== profile.service)) {
    assert.equal(internal.createClient({}, { service: service as keyof typeof AI_SERVICES }).timeout, 30_000);
  }
  assert.equal(DEFAULT_AI_SETTINGS.gateway.timeoutMs, 30_000);
  assert.equal(DEFAULT_AI_SETTINGS.gateway.enabled, false);
  assert.deepEqual(DEFAULT_AI_SETTINGS.routes, {});
});
test("a response later than 30 seconds succeeds with the real SDK service timeout", { timeout: 40_000 }, async () => {
  let posts = 0;
  const internal = adapter(async (input, init) => {
    const url = String(input);
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer SYNTHETIC_B112_NO_REAL_CREDENTIAL");
    assert.equal(init?.redirect, "error");
    assert.ok(url.startsWith(baseURL));
    if (url.endsWith("health/ready")) return new Response(null);
    if (url.endsWith("v1/models")) return Response.json({ object: "list", data: [{ id: profile.model }] });
    if (url.endsWith("indexus/v1/capabilities")) return Response.json({ apiVersion: "1", models: [{
      id: profile.model, revision: "SYNTHETIC_NOT_SERVER_ATTESTATION", operations: ["chat.completions"],
      inputModalities: ["text"], outputFormats: ["json_object"], streaming: false,
      maxInputTokens: 8192, maxOutputTokens: 200,
    }] });
    assert.equal(url, baseURL + "v1/chat/completions");
    posts++;
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
      const timer = setTimeout(() => { init?.signal?.removeEventListener("abort", onAbort); resolve(); }, 31_000);
      if (init?.signal?.aborted) onAbort();
      else init?.signal?.addEventListener("abort", onAbort, { once: true });
    });
    return Response.json({ id: "SYN-B112", object: "chat.completion", model: profile.model,
      choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(valid) }, finish_reason: "stop" }] });
  });
  const started = performance.now();
  const result = await internal.createClient({}, { service: profile.service }).chat.completions.create(body);
  assert.ok(performance.now() - started > 30_000);
  assert.deepEqual(JSON.parse(result.choices[0].message.content!), valid);
  assert.equal(posts, 1);
});
test("SDK deadline aborts transport without retries or fabricated results", async () => {
  let attempts = 0;
  const internal = adapter(async (_input, init) => {
    attempts++;
    await new Promise<void>((_resolve, reject) => {
      const abort = () => reject(new DOMException("Aborted", "AbortError"));
      if (init?.signal?.aborted) abort();
      else init?.signal?.addEventListener("abort", abort, { once: true });
    });
    throw Error("UNREACHABLE");
  });
  const client = internal.createClient({}, { service: profile.service });
  // Accelerate only this request's deadline; the production client stays at 120s.
  await assert.rejects(client.chat.completions.create(body, { timeout: 15, maxRetries: 0 }),
    (error: any) => error instanceof OpenAI.APIConnectionTimeoutError);
  assert.equal(attempts, 1);
  assert.equal(client.timeout, 120_000);
});
