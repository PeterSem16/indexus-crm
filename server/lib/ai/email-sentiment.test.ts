import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { parseEmailSentimentAnalysis, emailSentimentFailure } from "./email-sentiment-contract";
import { EMAIL_SENTIMENT_PROFILE as profile, EMAIL_SENTIMENT_MODEL } from "./email-sentiment-profile";
import { internalModelsForService, INTERNAL_TEXT_MODELS } from "./internal-contract";
import { AI_SERVICES } from "./service-catalog";
import { AI_ROUTING_OVERRIDES } from "../../config/ai-routing";
import { GATEWAY_URL, DEFAULT_AI_SETTINGS, parseRoute } from "./settings-policy";
import { createSentimentTestRouter } from "../../../script/ai-email-sentiment/test-configuration";
import { sentimentCorpus } from "../../../script/ai-email-sentiment/corpus";

const require = createRequire(import.meta.url);
const { extract, RECIPES, replay } = require("../../../script/ai-gateway-c1/replay.cjs");
const source = readFileSync(new URL("../../routes.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("routes.ts", source, ts.ScriptTarget.Latest, true);
let businessBranch = "";
function visit(node: ts.Node) {
  if (ts.isIfStatement(node) && node.expression.getText(ast) === "shouldAnalyzeWithAI && actualMailbox")
    businessBranch = node.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(businessBranch.includes("analysisResult"), "must test the actual caller's business-action guard");

function application(router: ReturnType<typeof createSentimentTestRouter>["router"],
  options?: Record<string, unknown>) {
  let effects = 0;
  const logs: unknown[][] = [];
  const forbidden = new Proxy({}, { get() { effects++; throw Error("BUSINESS_EFFECT_ATTEMPTED"); } });
  const context = vm.createContext({
    console: { log: (...args: unknown[]) => logs.push(args), warn: (...args: unknown[]) => logs.push(args),
      error: (...args: unknown[]) => logs.push(args) },
    isAIAvailable: () => router.available("email.sentiment"),
    aiClient: () => {
      const client = router.client("email.sentiment");
      return options ? { chat: { completions: { create: (body: any) =>
        client.chat.completions.create(body, options) } } } : client;
    },
    shouldAnalyzeWithAI: true, actualMailbox: "synthetic@example.test",
    email: { body: { content: "SYNTHETIC_PRIVATE_EMAIL" }, subject: "synthetic" },
    storage: forbidden, db: forbidden,
    process: undefined, fetch: undefined,
  }, { codeGeneration: { strings: false, wasm: false } });
  const js = ts.transpileModule(extract(RECIPES["email.sentiment"]) + `
    globalThis.analyze = analyzeEmailContent;
    globalThis.business = async () => { ${businessBranch} };`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  new vm.Script(js).runInContext(context, { timeout: 1000 });
  return {
    analyze: async (content = "SYNTHETIC_PRIVATE_EMAIL") =>
      JSON.parse(JSON.stringify(await context.analyze(content, "synthetic subject"))),
    business: () => context.business(),
    effects: () => effects, logs,
  };
}

type Call = { path: string; body: any; authorization: string | undefined };
type Handler = (call: Call, response: ServerResponse) => boolean | void | Promise<boolean | void>;
const valid = sentimentCorpus[0].expected;
const envelope = (content: unknown = valid) => ({
  id: "SYNTHETIC_SENTIMENT", object: "chat.completion", model: profile.model,
  choices: [{ index: 0, message: { role: "assistant",
    content: typeof content === "string" ? content : JSON.stringify(content) }, finish_reason: "stop" }],
});
function send(response: ServerResponse, data: unknown, status = 200) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(data));
}
async function harness(handler?: Handler) {
  const calls: Call[] = [];
  let externalCalls = 0;
  const server = createServer(async (request, response) => {
    try {
      let body = "";
      for await (const chunk of request) body += chunk;
      const call = { path: request.url!, body: body ? JSON.parse(body) : null,
        authorization: request.headers.authorization };
      calls.push(call);
      if (call.authorization !== "Bearer SYNTHETIC_SENTIMENT_NOT_A_CREDENTIAL")
        return send(response, {}, 401);
      if (await handler?.(call, response)) return;
      if (call.path === "/gateway/health/ready") { response.writeHead(200); response.end(); }
      else if (call.path === "/gateway/v1/models") send(response, {
        object: "list", data: [{ id: profile.model }],
      });
      else if (call.path === "/gateway/indexus/v1/capabilities") send(response, {
        apiVersion: "1", models: [{ id: profile.model, revision: "synthetic-not-live-evidence",
          operations: ["chat.completions"], inputModalities: ["text"],
          outputFormats: ["json_object"], streaming: false, maxInputTokens: 8192, maxOutputTokens: 300 }],
      });
      else if (call.path === "/gateway/v1/chat/completions") send(response, envelope());
      else send(response, {}, 404);
    } catch {
      if (!response.destroyed) send(response, {}, 500);
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  const h = createSentimentTestRouter(async (input, init) => {
    const url = new URL(String(input));
    assert.ok(url.href.startsWith(GATEWAY_URL));
    assert.equal(init?.redirect, "error");
    // Only this fixture transport maps the origin. No runtime URL/guard is changed.
    return fetch(`http://127.0.0.1:${address.port}${url.pathname}`, init);
  }, () => { externalCalls++; throw Error("EXTERNAL_PROVIDER_MUST_NOT_BE_CALLED"); });
  return { ...h, calls, app: application(h.router), externalCalls: () => externalCalls,
    close: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}

test("model permission is exclusive to email.sentiment, even with an overbroad injected baseline", () => {
  for (const service of Object.keys(AI_SERVICES)) {
    assert.equal(internalModelsForService(service).includes(EMAIL_SENTIMENT_MODEL), service === profile.service);
    assert.equal(internalModelsForService(service, [...INTERNAL_TEXT_MODELS, EMAIL_SENTIMENT_MODEL])
      .includes(EMAIL_SENTIMENT_MODEL), service === profile.service);
  }
  assert.ok(parseRoute(profile.service, { provider: "internal", model: profile.model, enabled: true }));
  assert.throws(() => parseRoute("email.monitoring", { provider: "internal", model: profile.model, enabled: true }));
  assert.deepEqual(AI_ROUTING_OVERRIDES, {});
  assert.deepEqual(DEFAULT_AI_SETTINGS.routes, {});
  assert.equal(DEFAULT_AI_SETTINGS.gateway.enabled, false);
});

test("strict contract preserves all nine fields, supports the original fenced JSON and rejects coercion", () => {
  assert.deepEqual(parseEmailSentimentAnalysis(JSON.stringify(valid)), valid);
  assert.deepEqual(parseEmailSentimentAnalysis("```json\n" + JSON.stringify(valid) + "\n```"), valid);
  for (const field of Object.keys(valid)) {
    const missing = { ...valid } as any; delete missing[field];
    assert.throws(() => parseEmailSentimentAnalysis(JSON.stringify(missing)), /email_sentiment_invalid_analysis/);
  }
  for (const bad of [
    { ...valid, wantsConsent: "false" }, { ...valid, wantsToCancel: 0 },
    { ...valid, sentiment: "unknown" }, { ...valid, alertLevel: "urgent" },
    { ...valid, note: "" }, { ...valid, note: " ".repeat(20) }, { ...valid, note: "x".repeat(1001) },
    { ...valid, wantsCancel: false }, null, [], 1, "not json",
  ]) assert.throws(() => parseEmailSentimentAnalysis(JSON.stringify(bad)), /email_sentiment_invalid_analysis/);
});

test("real HTTP fixture: CRM analyzer → Router → authenticated Gateway adapter → strict parser", async () => {
  const h = await harness();
  try {
    assert.deepEqual(await h.app.analyze(), valid);
    assert.deepEqual(h.calls.map(c => c.path), ["/gateway/health/ready", "/gateway/v1/models",
      "/gateway/indexus/v1/capabilities", "/gateway/v1/chat/completions"]);
    const body = h.calls[3].body;
    assert.equal(body.model, profile.model);
    assert.equal(body.max_tokens, 300);
    assert.equal(body.temperature, 0.1);
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.equal(body.stream, false);
    assert.equal(h.externalCalls(), 0);
    assert.equal(h.adapter.createClient({}, { service: profile.service }).timeout, 30_000);
    assert.equal(h.adapter.createClient({}, { service: "email.monitoring" }).timeout, 120_000);
    assert.equal(h.adapter.createClient({}, { service: "sms.sentiment" }).timeout, 120_000);
  } finally { await h.close(); }
});

for (const row of sentimentCorpus) test(`synthetic contract fixture ${row.id} (${row.language}), not model accuracy`, async () => {
  const h = await harness((call, res) => {
    if (!call.path.endsWith("/chat/completions")) return;
    if (row.expected === null) send(res, { error: { type: "review_required", code: "review_required",
      message: "SYNTHETIC_UPSTREAM_TEXT_MUST_NOT_LEAK" } }, 422);
    else send(res, envelope(row.expected));
    return true;
  });
  try {
    const result = await h.app.analyze(row.content);
    assert.deepEqual(result, row.expected ?? { status: "review_required", code: "review_required" });
    assert.equal(h.externalCalls(), 0);
    assert.ok(!JSON.stringify(h.app.logs).includes("SYNTHETIC_UPSTREAM_TEXT_MUST_NOT_LEAK"));
  } finally { await h.close(); }
});

const failures: Record<string, { status?: number; data: unknown; review?: boolean; path?: string }> = {
  review: { status: 422, data: { error: { type: "review_required", code: "review_required", message: "PRIVATE_VENDOR_TEXT" } }, review: true },
  generic422: { status: 422, data: { error: { type: "invalid_request", code: "invalid_request" } } },
  codeWithoutType: { status: 422, data: { error: { code: "review_required" } } },
  wrongStatus: { status: 500, data: { error: { type: "review_required", code: "review_required" } } },
  misleadingSuccess: { data: { error: { type: "review_required", code: "review_required" } } },
  oversizedError: { status: 422, data: { error: { type: "review_required", code: "review_required", message: "x".repeat(9000) } } },
  invalidJson: { data: envelope("{malformed") },
  missingField: { data: envelope({ ...valid, wantsToCancel: undefined }) },
  wrongType: { data: envelope({ ...valid, wantsConsent: "true" }) },
  unexpectedField: { data: envelope({ ...valid, status: "success" }) },
  truncated: { data: { ...envelope(), choices: [{ ...envelope().choices[0], finish_reason: "length" }] } },
  unauthorized: { status: 401, data: { error: "PRIVATE_VENDOR_TEXT" } },
  forbidden: { status: 403, data: {} },
  unavailable: { status: 503, data: {} },
  discoveryReview: { path: "/gateway/v1/models", status: 422,
    data: { error: { type: "review_required", code: "review_required" } } },
};
for (const [name, scenario] of Object.entries(failures)) test(`no business action / fallback / retry on ${name}`, async () => {
  const h = await harness((call, res) => {
    if (call.path !== (scenario.path ?? "/gateway/v1/chat/completions")) return;
    send(res, scenario.data, scenario.status); return true;
  });
  try {
    const result = await h.app.analyze();
    assert.equal(result.status, scenario.review ? "review_required" : "failed");
    assert.equal("wantsConsent" in result, false);
    h.calls.length = 0;
    await h.app.business(); // The actual route branch, not a test-authored substitute.
    assert.equal(h.app.effects(), 0);
    assert.equal(h.externalCalls(), 0);
    assert.equal(h.calls.filter(c => c.path.endsWith("/chat/completions")).length, scenario.path ? 0 : 1);
    const logs = JSON.stringify(h.app.logs);
    for (const secret of ["PRIVATE_VENDOR_TEXT", "SYNTHETIC_PRIVATE_EMAIL", "SYNTHETIC_SENTIMENT_NOT_A_CREDENTIAL"])
      assert.ok(!logs.includes(secret));
  } finally { await h.close(); }
});

test("connection failure is not a classification and cannot execute real business branch", async () => {
  let requests = 0;
  const h = createSentimentTestRouter(async () => { requests++; throw Error("PRIVATE_NETWORK_ERROR"); },
    () => { throw Error("external fallback"); });
  const app = application(h.router);
  await app.business();
  assert.equal(app.effects(), 0);
  assert.equal(requests, 1);
  assert.ok(!JSON.stringify(app.logs).includes("PRIVATE_NETWORK_ERROR"));
});

test("native fetch refuses redirects; no second endpoint receives authorization", async () => {
  let redirected = 0;
  const h = await harness((call, res) => {
    if (call.path === "/gateway/v1/models") {
      res.writeHead(307, { location: "/do-not-follow" }); res.end(); return true;
    }
    if (call.path === "/do-not-follow") redirected++;
  });
  try { await h.app.business(); assert.equal(h.app.effects(), 0); assert.equal(redirected, 0); }
  finally { await h.close(); }
});

test("caller cannot use the dedicated model on another service", async () => {
  const h = await harness();
  try {
    for (const service of ["email.monitoring", "sms.sentiment"] as const)
      assert.throws(() => h.adapter.createClient({}, { service }).chat.completions.create({
        model: profile.model, messages: [{ role: "user", content: "synthetic" }],
      }));
    assert.equal(h.calls.length, 0);
  } finally { await h.close(); }
});

test("shorter caller deadline aborts stalled discovery; no inference or retry", async () => {
  const h = await harness((call) => call.path.endsWith("/models") ? true : undefined);
  try {
    const app = application(h.router, { timeout: 100, maxRetries: 2 });
    const result = await app.analyze();
    assert.equal(result.status, "failed");
    assert.equal(h.calls.filter(c => c.path.endsWith("/models")).length, 1);
    assert.equal(h.calls.filter(c => c.path.endsWith("/chat/completions")).length, 0);
  } finally { await h.close(); }
});

test("actual 30-second shared deadline spans slow discovery + inference and cannot be extended",
  { timeout: 36_000 }, async () => {
  let aborted = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const h = await harness((call, response) => {
    if (call.path.endsWith("/health/ready")) {
      timers.push(setTimeout(() => { response.writeHead(200); response.end(); }, 8000)); return true;
    }
    if (call.path.endsWith("/chat/completions")) {
      response.on("close", () => { if (!response.writableEnded) aborted = true; });
      timers.push(setTimeout(() => send(response, envelope()), 25_000)); return true;
    }
  });
  try {
    const app = application(h.router, { timeout: 120_000, maxRetries: 2 });
    const start = performance.now();
    await app.business();
    const elapsed = performance.now() - start;
    assert.ok(elapsed >= 29_500 && elapsed < 31_500, `deadline elapsed=${elapsed}`);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.effects(), 0);
    assert.equal(h.externalCalls(), 0);
    assert.equal(h.calls.filter(c => c.path.endsWith("/chat/completions")).length, 1);
    // The client's observed deadline is authoritative; socket close can follow asynchronously.
    console.log(JSON.stringify({ check: "real-30-second-deadline", elapsedMs: Math.round(elapsed),
      inferenceAttempts: 1, businessEffects: app.effects(), serverSawAbortAtObservation: aborted }));
  } finally { for (const timer of timers) clearTimeout(timer); await h.close(); }
});

test("historical C1 parser replay uses the same strict parser, not the old success defaults", async () => {
  // The existing replay independently compares request messages before accepting a parser result.
  let originalRequest: any;
  const h = createSentimentTestRouter(async () => { throw Error("unused"); }, () => { throw Error("unused"); });
  const context = vm.createContext({ console: { log() {}, warn() {}, error() {} },
    isAIAvailable: () => true, aiClient: () => ({ chat: { completions: {
      create: async (body: unknown) => { originalRequest = body; return envelope(); },
    } } }),
  });
  const js = ts.transpileModule(extract(RECIPES["email.sentiment"]) +
    '\nglobalThis.run = () => analyzeEmailContent("synthetic", "synthetic");',
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  new vm.Script(js).runInContext(context);
  await context.run();
  const result = await replay("email.sentiment", '{"sentiment":"neutral"}',
    { content: "synthetic", subject: "synthetic" }, originalRequest);
  assert.equal(result.state, "REJECTED");
  assert.equal(emailSentimentFailure({ status: 422, code: "review_required", type: "review_required" }).status, "review_required");
  assert.ok(h.router); // No runtime or persisted setting is involved in source replay.
});
