import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { AI_SERVICES } from "../../server/lib/ai/service-catalog";
import { snapshot } from "../ai-gateway-b4-pilot.cjs";
import { analyzeSource } from "./source.cjs";
import { B12, executeB12 } from "./b12-test";
const source = analyzeSource(path.resolve("server/lib/email-monitoring-service.ts"));
const valid = { sentiment: "neutral", hasInappropriateContent: false, hasAngryTone: false,
  hasRudeExpressions: false, wantsToCancel: false, wantsConsent: false,
  doesNotAcceptContract: false, alertLevel: "none", note: "Žiadosť o potvrdenie prijatia." };
const token = "SYNTHETIC_B12_CREDENTIAL";
function current() {
  return snapshot({ version: 7, value: { routes: {}, gateway: {
    enabled: false, baseURL: "https://ai.cordbloodcenter.com/gateway/",
    timeoutMs: 30000, maxRetries: 0, maxTokens: null, temperature: null,
  } } }, Object.keys(AI_SERVICES));
}
async function run(options: { reply?: unknown; status?: number; model?: string; claimError?: boolean;
  finalError?: boolean; changedBefore?: boolean; changedAfter?: boolean; unavailable?: boolean } = {}) {
  const calls: any[] = []; let claims = 0, reads = 0;
  const result = await executeB12({ source, token, reference: current(),
    readSnapshot: async () => {
      reads++;
      if (reads === 2 && options.finalError) throw Error("SYNTHETIC_PRIVATE_DB_ERROR");
      return { ...current(), version: (reads === 1 && options.changedBefore || reads === 2 && options.changedAfter) ? 8 : 7 };
    },
    claimOnce() { claims++; if (options.claimError) throw Error("B12_RUN_ALREADY_STARTED"); },
    fetch: (async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("health/ready")) return new Response(null);
      if (String(url).endsWith("v1/models")) return Response.json({ object: "list", data: options.unavailable ? [] : [{ id: B12.model }] });
      if (String(url).endsWith("indexus/v1/capabilities")) return Response.json({ apiVersion: "1", models: [{
        id: B12.model, revision: "SYNTHETIC_B12", operations: ["chat.completions"],
        inputModalities: ["text"], outputFormats: ["text", "json_object"], streaming: false,
        maxInputTokens: 8192, maxOutputTokens: 200,
      }] });
      if (options.status && options.status !== 200) return new Response(null, { status: options.status });
      return Response.json({ id: "SYNTHETIC_B12_COMPLETION", object: "chat.completion",
        model: options.model ?? B12.model, choices: [{ index: 0,
          message: { role: "assistant", content: typeof options.reply === "string" ? options.reply : JSON.stringify(options.reply ?? valid) },
          finish_reason: "stop" }] });
    }) as typeof fetch,
  });
  return { result, calls, claims, reads };
}
test("B1.2 executes exactly one canonical HTTPS inference using the real CRM layer and the exact approved input", async () => {
  const h = await run();
  assert.equal(h.result.verdict, "PASS"); assert.equal(h.calls.length, 4);
  assert.equal(h.claims, 1); assert.equal(h.reads, 2);
  assert.equal(h.result.httpStatus, 200); assert.equal(h.result.usedModel, B12.model);
  assert.deepEqual(h.result.result, valid); assert.equal(Object.keys(h.result.result).length, 9);
  assert.equal(h.result.integrationProcessed, true);
  assert.equal(h.result.inferenceAttempts, 1); assert.equal(h.result.cloudCalls, 0);
  assert.equal(h.result.production.afterMatchesOriginal, true);
  assert.equal(h.result.historicalModelInventory, "UNVERIFIED_NON_BLOCKING_PER_B12");
  assert.equal(h.result.productionRecordWrites, 0);
  assert.equal(h.result.originalRequestSha256, "b2bedf7cfecf6e23d6bac89fdd6cb899b0c93a0dba3ee36376d87d9323adcb2d");
  assert.ok(h.calls.every(c => c.url.startsWith("https://ai.cordbloodcenter.com/gateway/") &&
    c.init.redirect === "error" && new Headers(c.init.headers).get("authorization") === `Bearer ${token}`));
  const inference = h.calls.filter(c => c.init.method === "POST");
  assert.equal(inference.length, 1); assert.equal(inference[0].url, B12.endpoint);
  const body = JSON.parse(inference[0].init.body);
  assert.equal(body.messages.find((m: any) => m.role === "user").content, "Prosím potvrďte prijatie správy. Ďakujem.");
  assert.equal(body.max_tokens, 200); assert.equal(body.temperature, 0.1);
  assert.deepEqual(body.response_format, { type: "json_object" }); assert.equal(body.stream, false);
  assert.equal(JSON.stringify(h.result).includes(token), false);
});
for (const status of [301, 401, 500, 504]) test(`B1.2 HTTP ${status} fails without retry, redirect follow or cloud fallback`, async () => {
  const h = await run({ status });
  assert.equal(h.result.verdict, "FAIL"); assert.equal(h.result.httpStatus, status);
  assert.equal(h.result.inferenceAttempts, 1); assert.equal(h.calls.length, 4);
  assert.equal(h.result.cloudCalls, 0); assert.equal(h.reads, 2);
});
for (const [name, reply] of Object.entries({
  missingFields: { sentiment: "neutral" }, invalidJson: "{broken",
  wrongBoolean: { ...valid, wantsConsent: "false" },
})) test(`B1.2 rejects ${name} through the actual CRM parser`, async () => {
  const h = await run({ reply });
  assert.equal(h.result.verdict, "FAIL"); assert.equal(h.result.integrationProcessed, false);
  assert.equal(h.result.result, null); assert.equal(h.result.inferenceAttempts, 1);
});
test("wrong consent classification fails rather than being repaired", async () => {
  const h = await run({ reply: { ...valid, wantsConsent: true } });
  assert.equal(h.result.verdict, "FAIL"); assert.equal(h.result.error, "B12_SEMANTIC_MISMATCH");
  assert.equal(h.result.result.wantsConsent, true);
});
test("wrong returned model cannot pass", async () => {
  const h = await run({ model: "indexus-document-audio:latest" });
  assert.equal(h.result.verdict, "FAIL"); assert.equal(h.result.usedModel, "UNEXPECTED_MODEL");
});
test("B1.2 does not bypass a previous B1.2 marker or a changed production reference", async () => {
  const duplicate = await run({ claimError: true });
  assert.equal(duplicate.result.error, "B12_RUN_ALREADY_STARTED"); assert.equal(duplicate.calls.length, 0);
  const changed = await run({ changedBefore: true });
  assert.equal(changed.result.error, "B12_PRODUCTION_CHANGED_BEFORE_TEST");
  assert.equal(changed.calls.length, 0); assert.equal(changed.claims, 0);
});
test("unavailable model blocks inference, and a failed final production check blocks PASS", async () => {
  const unavailable = await run({ unavailable: true });
  assert.equal(unavailable.result.verdict, "FAIL"); assert.equal(unavailable.result.inferenceAttempts, 0);
  const final = await run({ finalError: true });
  assert.equal(final.result.verdict, "FAIL"); assert.equal(final.result.error, "B12_FINAL_PRODUCTION_UNVERIFIED");
  const changed = await run({ changedAfter: true });
  assert.equal(changed.result.verdict, "FAIL"); assert.equal(changed.result.error, "B12_PRODUCTION_CHANGED_OR_UNVERIFIED");
});
