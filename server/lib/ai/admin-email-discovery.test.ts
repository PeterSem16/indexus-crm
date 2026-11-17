import test from "node:test";
import assert from "node:assert/strict";
import { createInternalAIAdapter } from "./internal-adapter";
import { checkAIProvider } from "./settings-check";
import { freshSmoke } from "./settings-policy";
import { AI_SERVICES } from "./service-catalog";
import { EMAIL_MONITORING_MODEL } from "../../../shared/ai-settings";

const baseline = "indexus-document-audio:latest";
function harness(includeEmail = true) {
  const posts: string[] = [];
  const gets: string[] = [];
  const ids = includeEmail ? [baseline, EMAIL_MONITORING_MODEL] : [baseline];
  const adapter = createInternalAIAdapter({
    readConfiguration: () => ({ enabled: true, production: true, replit: false,
      baseURL: "https://ai.cordbloodcenter.com/gateway/", token: "SYNTHETIC_DISCOVERY_TOKEN" }),
    fetch: async (input, init) => {
      const url = String(input);
      assert.equal(init?.redirect, "error");
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer SYNTHETIC_DISCOVERY_TOKEN");
      if (init?.method === "GET") gets.push(url);
      if (url.endsWith("health/ready")) return new Response(null);
      if (url.endsWith("v1/models")) return Response.json({ object: "list", data: ids.map(id => ({ id })) });
      if (url.endsWith("indexus/v1/capabilities")) return Response.json({ apiVersion: "1",
        models: ids.map(id => ({ id, revision: "SYNTHETIC", operations: ["chat.completions"],
          inputModalities: ["text"], outputFormats: id === baseline ? ["text", "json_object"] : ["json_object"],
          streaming: false, maxInputTokens: 8192, maxOutputTokens: id === baseline ? 8192 : 200 })) });
      assert.ok(url.endsWith("v1/chat/completions"));
      const body = JSON.parse(String(init?.body));
      posts.push(body.model);
      assert.equal(body.model, baseline, "the existing administrative smoke must not add an email inference");
      return Response.json({ id: "synthetic-admin-smoke", object: "chat.completion", model: body.model,
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant",
          content: body.response_format ? '{"marker":"indexus-test","sum":5}' : "INDEXUS_TEST_OK" } }] });
    },
  });
  return { adapter, posts, gets };
}
test("default discovery stays restricted; email-scoped discovery lists the declared email alias without inference", async () => {
  const h = harness();
  assert.deepEqual((await h.adapter.inspect()).models.map(m => m.id), [baseline]);
  assert.deepEqual((await h.adapter.inspect({ service: "email.monitoring" })).models.map(m => m.id),
    [baseline, EMAIL_MONITORING_MODEL]);
  assert.equal(h.posts.length, 0);
  assert.equal(h.gets.length, 6);
});
test("admin smoke retains both model declarations and satisfies the existing email model gate", async () => {
  const h = harness();
  const check = await checkAIProvider("smoke", 6, { internal: h.adapter });
  assert.equal(check.state, "ready");
  assert.equal(check.settingsVersion, 6);
  assert.equal(freshSmoke(check, 6, Date.now(), EMAIL_MONITORING_MODEL), true);
  assert.equal(freshSmoke(check, 6, Date.now(), baseline), true);
  assert.deepEqual(h.posts, [baseline, baseline]);
  assert.equal(JSON.stringify(check).includes("SYNTHETIC_DISCOVERY_TOKEN"), false);
});
test("missing email declaration is never fabricated into an activation grant", async () => {
  const h = harness(false);
  const check = await checkAIProvider("smoke", 6, { internal: h.adapter });
  assert.equal(check.state, "ready");
  assert.equal(freshSmoke(check, 6, Date.now(), EMAIL_MONITORING_MODEL), false);
  assert.equal(check.models.some(m => m.id === EMAIL_MONITORING_MODEL), false);
});
test("connectivity alone still cannot authorize internal routing", async () => {
  const h = harness();
  const check = await checkAIProvider("connectivity", 6, { internal: h.adapter });
  assert.deepEqual(h.posts, []);
  assert.equal(freshSmoke(check, 6, Date.now(), EMAIL_MONITORING_MODEL), false);
});
test("all other 64 services still reject email model inference before any network request", () => {
  const h = harness();
  for (const service of Object.keys(AI_SERVICES).filter(id => id !== "email.monitoring")) {
    const client = h.adapter.createClient({}, { service: service as keyof typeof AI_SERVICES });
    assert.throws(() => client.chat.completions.create({ model: EMAIL_MONITORING_MODEL,
      messages: [{ role: "user", content: "SYNTHETIC" }], response_format: { type: "json_object" } }),
    (error: any) => error.code === "ai_internal_model_not_allowed");
    assert.equal(client.timeout, 30000);
  }
  assert.deepEqual(h.posts, []);
  assert.deepEqual(h.gets, []);
});
