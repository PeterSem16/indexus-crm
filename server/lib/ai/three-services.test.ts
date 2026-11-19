import test from "node:test";
import assert from "node:assert/strict";
import { createInternalAIAdapter } from "./internal-adapter";
import { createAIRouter } from "./router";
import { internalModelsForService, INTERNAL_TEXT_MODELS } from "./internal-contract";
import { THREE_SERVICE_PROFILES as profiles, THREE_SERVICE_CANDIDATE_ROUTES as routes } from "./three-services-profile";
import { DEFAULT_AI_SETTINGS, parseRoute } from "./settings-policy";
import { AI_SERVICES } from "./service-catalog";
import { AI_ROUTING_OVERRIDES } from "../../config/ai-routing";
import { originalBoundaries } from "../../../script/ai-three-services/source";
import { acceptanceCorpus, LANGUAGES } from "../../../script/ai-three-services/corpus";
import { acceptanceContract, latencyStats } from "../../../script/ai-three-services/evaluate";
import { runAcceptance } from "../../../script/ai-three-services/run";

const token = "SYNTHETIC_THREE_SERVICE_TOKEN";
function harness(options: { httpStatus?: number; finish?: string; reply?: string; delay?: boolean } = {}) {
  const calls: any[] = [], cloud: any[] = [];
  const adapter = createInternalAIAdapter({
    readConfiguration: () => ({ production: true, replit: false, enabled: true,
      baseURL: "https://ai.cordbloodcenter.com/gateway/", token }),
    readSettings: () => ({ ...DEFAULT_AI_SETTINGS.gateway, maxTokens: 8192,
      temperature: 1.8, timeoutMs: 120000, maxRetries: 2 }),
    fetch: (async (url: any, init: any) => {
      calls.push({ url: String(url), init });
      if (options.delay) await new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
      if (String(url).endsWith("health/ready")) return new Response(null);
      if (String(url).endsWith("v1/models")) return Response.json({
        object: "list", data: Object.values(profiles).map(p => ({ id: p.model })),
      });
      if (String(url).endsWith("capabilities")) return Response.json({
        apiVersion: "1", models: Object.values(profiles).map(p => ({
          id: p.model, revision: "SYNTHETIC-1", operations: ["chat.completions"],
          inputModalities: ["text"], outputFormats: ["text", "json_object"],
          streaming: false, maxInputTokens: 16000, maxOutputTokens: 8192,
        })),
      });
      if (options.httpStatus) return Response.json({ private: "DO_NOT_LEAK" }, { status: options.httpStatus });
      const body = JSON.parse(init.body);
      const content = options.reply ?? (body.model === profiles["email.summary"].model
        ? "<p>Chýba potvrdenie. Termín nebol dohodnutý.</p>"
        : body.model === profiles["task.checklist"].model
          ? JSON.stringify({ steps: ["Overiť chýbajúci dokument", "Vyžiadať chýbajúci podklad", "Zaznamenať výsledok kontroly"] })
          : JSON.stringify({ draft: "Bolo overené, že chýba potvrdenie. Žiadosť nebola odoslaná." }));
      return Response.json({ id: "synthetic-completion", object: "chat.completion", model: body.model,
        choices: [{ index: 0, finish_reason: options.finish ?? "stop", message: { role: "assistant", content } }] });
    }) as typeof fetch,
  });
  const router = createAIRouter({
    adapter: { id: "openai", isAvailable: () => true,
      createClient: () => ({ chat: { completions: { create(body: any) { cloud.push(body); return Promise.resolve({}); } } } }) as any,
      chatProbe: async () => new Response() },
    adapters: [adapter], mode: "routed", revision: "test-three", overrides: routes, emit() {},
  });
  return { calls, cloud, adapter, router };
}
const boundary = originalBoundaries(process.cwd());
test("81 fixed cases cover exactly 27 per service and 3 cases in every INDEXUS language", () => {
  const corpus = acceptanceCorpus();
  assert.equal(corpus.length, 81);
  assert.equal(new Set(corpus.map(c => c.id)).size, 81);
  for (const service of Object.keys(profiles)) {
    assert.equal(corpus.filter(c => c.service === service).length, 27);
    for (const lang of LANGUAGES)
      assert.equal(corpus.filter(c => c.service === service && c.language === lang.label &&
        !c.id.includes("-edge-")).length, 3);
  }
  assert.equal(corpus.filter(c => c.noInference).length, 1);
});
test("candidate routes are inert; default production routes and global model allowlist stay unchanged", () => {
  assert.deepEqual(AI_ROUTING_OVERRIDES, {});
  assert.deepEqual(DEFAULT_AI_SETTINGS.routes, {});
  assert.equal(DEFAULT_AI_SETTINGS.gateway.enabled, false);
  assert.deepEqual(INTERNAL_TEXT_MODELS, ["indexus-ai-solaris:v1", "indexus-document-audio:latest"]);
  for (const service of Object.keys(AI_SERVICES)) for (const [owner, profile] of Object.entries(profiles)) {
    assert.equal(internalModelsForService(service).includes(profile.model), service === owner);
    if (service !== owner)
      assert.throws(() => parseRoute(service, { provider: "internal", enabled: true, model: profile.model }));
    else assert.equal(parseRoute(service, routes[service]).model, profile.model);
  }
  const hostileBaseline = [...INTERNAL_TEXT_MODELS, ...Object.values(profiles).map(p => p.model)];
  assert.equal(internalModelsForService("email.monitoring", hostileBaseline).some(m =>
    Object.values(profiles).some(p => p.model === m)), false);
});
for (const service of Object.keys(profiles) as (keyof typeof profiles)[]) {
  test(`${service}: actual original request/parser through the existing router and authenticated HTTPS adapter`, async () => {
    const h = harness();
    const item = acceptanceCorpus().find(c => c.service === service)!;
    const originalRequests: any[] = [];
    await boundary.execute(service, item.input, () => ({
      chat: { completions: { create: async (body: any) => {
        originalRequests.push(body);
        const reply = service === "email.summary" ? "<p>Synthetic</p>" :
          service === "task.checklist" ? '{"steps":["First step","Second step","Third step"]}' : '{"draft":"Synthetic."}';
        return { choices: [{ message: { content: reply } }] };
      } } },
    }));
    const result = await boundary.execute(service, item.input,
      (id: any, options: any) => h.router.client(id, options));
    assert.deepEqual(acceptanceContract(service, result), []);
    const sent = JSON.parse(h.calls.at(-1).init.body);
    assert.deepEqual(sent, JSON.parse(JSON.stringify({ ...originalRequests[0], model: profiles[service].model })));
    assert.equal(h.cloud.length, 0);
    assert.equal(h.calls.length, 4);
    assert.ok(h.calls.every(c => c.url.startsWith("https://ai.cordbloodcenter.com/gateway/") &&
      c.init.redirect === "error" && c.init.headers.authorization === `Bearer ${token}`));
    const sdk = h.adapter.createClient({}, { service });
    assert.equal(sdk.timeout, service === "email.summary" ? 120000 : 15000);
    if (service !== "email.summary") assert.equal(sdk.maxRetries, 0);
  });
}
test("original language selectors receive cs for CZ and en for ENG, without modifying prompts", async () => {
  for (const service of ["email.summary", "task.checklist", "task.resolution"] as const) {
    for (const language of LANGUAGES) {
      const item = acceptanceCorpus().find(c => c.service === service && c.language === language.label)!;
      let prompt = "";
      await boundary.execute(service, item.input, () => ({
        chat: { completions: { create: async (body: any) => {
          prompt = JSON.stringify(body.messages);
          return { choices: [{ message: { content: service === "task.checklist"
            ? '{"steps":["First step","Second step","Third step"]}'
            : service === "task.resolution" ? '{"draft":"Synthetic."}' : "<p>Synthetic</p>" } }] };
        } } },
      }));
      if (service === "email.summary") {
        const names: Record<string, string> = { SK: "slovenčina", CZ: "čeština", ENG: "English",
          DE: "Deutsch", IT: "italiano", HU: "magyar", RO: "română" };
        assert.ok(prompt.includes(names[language.label]));
      } else assert.ok(prompt.includes(language.name));
    }
  }
});
test("no completed checklist means no inference, not a fabricated resolution", async () => {
  const h = harness();
  const item = acceptanceCorpus().find(c => c.noInference)!;
  const result = await boundary.execute(item.service, item.input, (id: any, opts: any) => h.router.client(id, opts));
  assert.equal(result.errorCode, "no_completed_items");
  assert.equal(h.calls.length, 0);
});
for (const status of [401, 403, 429, 500, 503, 504])
  test(`task HTTP ${status} has one inference attempt, no managed retries or cloud fallback`, async () => {
    const h = harness({ httpStatus: status });
    await assert.rejects(h.router.client("task.checklist", { timeout: 15000, maxRetries: 2 })
      .chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "user", content: "synthetic" }] },
        { timeout: 90000, maxRetries: 2 }), (error: any) => error.status === status &&
          !String(error).includes("DO_NOT_LEAK"));
    assert.equal(h.calls.filter(c => c.url.endsWith("chat/completions")).length, 1);
    assert.equal(h.cloud.length, 0);
  });
test("task deadline covers discovery and cannot be extended per request", async () => {
  const h = harness({ delay: true });
  const started = Date.now();
  await assert.rejects(h.router.client("task.checklist", { timeout: 30 })
    .chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "user", content: "synthetic" }] },
      { timeout: 90000, maxRetries: 2 }));
  assert.ok(Date.now() - started < 2000);
  assert.equal(h.calls.length, 1); assert.equal(h.cloud.length, 0);
});
for (const reply of [
  '{"steps":["Duplicate label","DUPLICATE LABEL","Third step"]}',
  '{"steps":["short","Second step","Third step"]}',
  '{"steps":["First step","Second step","Third step"],"extra":true}',
  '```json\n{"steps":["First step","Second step","Third step"]}\n```',
]) test(`checklist original parser rejects invalid output: ${reply.slice(0, 42)}`, async () => {
  const h = harness({ reply });
  const item = acceptanceCorpus().find(c => c.service === "task.checklist")!;
  await assert.rejects(boundary.execute(item.service, item.input, (id: any, opts: any) => h.router.client(id, opts)));
});
test("incomplete model output is rejected before application parser", async () => {
  const h = harness({ finish: "length" });
  const item = acceptanceCorpus().find(c => c.service === "task.resolution")!;
  const result = await boundary.execute(item.service, item.input, (id: any, opts: any) => h.router.client(id, opts));
  assert.equal(result.status, "failed");
  assert.equal(h.cloud.length, 0);
});
test("acceptance checks reject active HTML, attributes, unsupported tags and excessive draft length/words", () => {
  for (const summary of ["<p onclick='alert(1)'>X</p>", "<script>x</script><p>x</p>", "<p><img src=x></p>",
    "<p>unclosed", "<p><ul><li>x</li></ul></p>", "<p>x</p><think>hidden reasoning</think>"])
    assert.notEqual(acceptanceContract("email.summary", { status: "generated", summary }).length, 0);
  assert.equal(acceptanceContract("email.summary", { status: "generated", summary: "<p>Text.</p><ul><li>Item</li></ul>" }).length, 0);
  assert.notEqual(acceptanceContract("task.resolution", { status: "generated", draft: "word ".repeat(61) }).length, 0);
  assert.notEqual(acceptanceContract("task.resolution", { status: "generated", draft: "a".repeat(501) }).length, 0);
  assert.deepEqual(latencyStats([10, 20, 30, 40]), { count: 4, meanMs: 25, medianMs: 25, p95Ms: 40, maxMs: 40 });
});
test("full offline 81-case rehearsal never claims multilingual AI quality or changes production configuration", async () => {
  const h = harness();
  let saved: any;
  const report = await runAcceptance({ root: process.cwd(), adapter: h.adapter,
    readSnapshot: async () => ({ version: 9, fullConfigurationSha256: "synthetic-unchanged" }),
    save: value => { saved = value; } });
  assert.equal(report.results.length, 81);
  assert.equal(h.calls.filter(c => c.url.endsWith("chat/completions")).length, 80);
  assert.equal(report.verdict, "NOT_READY");
  assert.equal(report.productionUnchanged, true);
  assert.equal(report.sourcesUnchanged, true);
  assert.equal(report.results.filter((r: any) => r.status === "PASS_NO_INFERENCE").length, 1);
  assert.ok(report.results.filter((r: any) => r.attempted).every((r: any) =>
    r.languageReview === "REVIEW_REQUIRED" && r.rawOutput && r.promptHash));
  assert.equal(saved, report); assert.equal(h.cloud.length, 0);
});
test("approved smoke profile makes exactly one original request per service, not the full acceptance suite", async () => {
  const h = harness();
  const report = await runAcceptance({
    root: process.cwd(), adapter: h.adapter, profile: "smoke-three",
    readSnapshot: async () => ({ version: 9, fullConfigurationSha256: "synthetic-unchanged" }),
    save() {},
  });
  assert.equal(report.planned, 3);
  assert.equal(report.results.length, 3);
  assert.equal(report.kind, "LIVE_ISOLATED_SMOKE_THREE_SERVICES");
  assert.deepEqual(report.languageCoverage, ["SK"]);
  assert.deepEqual(report.results.map((row: any) => row.service), Object.keys(profiles));
  assert.equal(h.calls.filter(c => c.url.endsWith("chat/completions")).length, 3);
  assert.equal(h.cloud.length, 0);
  assert.equal(report.productionUnchanged, true);
  for (const row of report.results) {
    assert.equal(row.status, "REVIEW_REQUIRED");
    assert.equal(row.httpStatus, 200);
    assert.ok(row.rawOutput);
    assert.equal(report.summary[row.service].planned, 1);
  }
  assert.equal(report.verdict, "NOT_READY");
});
test("checklist Slovak retest sends only the original failed case and preserves its exact request and 15-second deadline", async () => {
  const h = harness();
  const original = acceptanceCorpus().find(item => item.id === "task.checklist-SK-1")!;
  const reference = harness();
  await boundary.execute(original.service, original.input,
    (service: any, options: any) => reference.router.client(service, options));
  const originalRequest = JSON.parse(reference.calls.at(-1).init.body);
  const report = await runAcceptance({
    root: process.cwd(), adapter: h.adapter, profile: "checklist-sk-retest",
    readSnapshot: async () => ({ version: 9, fullConfigurationSha256: "synthetic-unchanged" }),
    save() {},
  });
  assert.equal(report.planned, 1); assert.equal(report.results.length, 1);
  const result = report.results[0];
  assert.equal(result.id, "task.checklist-SK-1");
  assert.equal(result.service, "task.checklist");
  assert.deepEqual(result.input, original.input);
  const posts = h.calls.filter(c => c.url.endsWith("chat/completions"));
  assert.equal(posts.length, 1);
  assert.deepEqual(JSON.parse(posts[0].init.body), originalRequest);
  assert.ok(originalRequest.messages[1].content.includes("Supported language: Slovak."));
  assert.equal(h.adapter.createClient({}, { service: "task.checklist" }).timeout, 15000);
  assert.equal(h.adapter.createClient({}, { service: "task.checklist" }).maxRetries, 0);
  assert.equal(h.cloud.length, 0);
  assert.equal(report.productionUnchanged, true);
  assert.equal(report.summary["email.summary"].planned, 0);
  assert.equal(report.summary["task.resolution"].planned, 0);
  assert.equal(report.kind, "LIVE_ISOLATED_CHECKLIST_SK_RETEST");
});
test("checklist Gateway HTTP 503 is a failed single attempt, never a valid or repaired checklist", async () => {
  const h = harness({ httpStatus: 503 });
  const report = await runAcceptance({
    root: process.cwd(), adapter: h.adapter, profile: "checklist-sk-retest",
    readSnapshot: async () => ({ version: 9, fullConfigurationSha256: "synthetic-unchanged" }),
    save() {},
  });
  assert.equal(report.results.length, 1);
  const row = report.results[0];
  assert.equal(row.status, "FAIL");
  assert.equal(row.httpStatus, 503);
  assert.equal(row.transportError, "ai_internal_http_error");
  assert.equal(row.rawOutput, undefined);
  assert.equal(row.result, undefined);
  assert.equal(h.calls.filter(c => c.url.endsWith("chat/completions")).length, 1);
  assert.equal(h.cloud.length, 0);
  assert.equal(report.productionUnchanged, true);
  assert.equal(report.verdict, "NOT_READY");
});
