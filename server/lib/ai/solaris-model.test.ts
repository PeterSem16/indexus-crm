import test from "node:test";
import assert from "node:assert/strict";
import { SOLARIS_MODEL, LEGACY_INTERNAL_MODEL } from "../../../shared/ai-settings";
import { parseRoute } from "./settings-policy";
import { createInternalAIAdapter } from "./internal-adapter";
import { aiSettingsTranslations } from "../../../client/src/i18n/ai-settings-translations";
import { internalModelsForService } from "./internal-contract";
import { EMAIL_MONITORING_MODEL } from "../../../shared/ai-settings";

test("canonical routing keeps the dedicated monitoring model scoped to monitoring", () => {
  assert.equal(parseRoute("email.monitoring", {
    provider: "internal", enabled: true, model: EMAIL_MONITORING_MODEL,
  }).model, EMAIL_MONITORING_MODEL);
  assert.ok(internalModelsForService("email.monitoring").includes(EMAIL_MONITORING_MODEL));
  for (const service of ["email.translation", "email.reply", "email.compose"]) {
    assert.equal(internalModelsForService(service).includes(EMAIL_MONITORING_MODEL), false);
    assert.throws(() => parseRoute(service, {
      provider: "internal", enabled: true, model: EMAIL_MONITORING_MODEL,
    }));
  }
});

for (const service of ["email.translation", "email.reply", "email.compose"] as const) {
  test(`${service}: Solaris uses its explicit model ID without rewriting the prompt`, async () => {
    const sent: any[] = [];
    const adapter = createInternalAIAdapter({
      readConfiguration: () => ({ production: true, replit: false, enabled: true,
        baseURL: "https://synthetic.invalid/gateway/", token: "SYNTHETIC" }),
      fetch: async (url, init) => {
        if (String(url).endsWith("health/ready")) return new Response(null);
        if (String(url).endsWith("v1/models"))
          return Response.json({ object: "list", data: [{ id: SOLARIS_MODEL }] });
        if (String(url).endsWith("capabilities"))
          return Response.json({ apiVersion: "1", models: [{
            id: SOLARIS_MODEL, revision: "synthetic", operations: ["chat.completions"],
            inputModalities: ["text"], outputFormats: ["text", "json_object"],
            streaming: false, maxInputTokens: 8192, maxOutputTokens: 2000,
          }] });
        const body = JSON.parse(String(init?.body));
        sent.push(body);
        return Response.json({ id: "synthetic", object: "chat.completion", model: SOLARIS_MODEL,
          choices: [{ index: 0, finish_reason: "stop",
            message: { role: "assistant", content: "<p>Synthetic</p>" } }] });
      },
    });
    const request = { model: SOLARIS_MODEL, temperature: 0.3, max_tokens: 1000,
      messages: [{ role: "system" as const, content: "Synthetic Slovak instruction" },
        { role: "user" as const, content: "<p>Synthetic source</p>" }] };
    assert.equal(parseRoute(service, { provider: "internal", enabled: true, model: SOLARIS_MODEL }).model, SOLARIS_MODEL);
    await adapter.createClient({}, { service }).chat.completions.create(request);
    assert.deepEqual(sent, [request]);
    // A pending job or persisted legacy route must not become invalid at deployment.
    assert.equal(parseRoute(service, { provider: "internal", enabled: true,
      model: LEGACY_INTERNAL_MODEL }).model, LEGACY_INTERNAL_MODEL);
  });
}

test("Solaris legacy-alias explanation is translated in all seven languages", () => {
  assert.deepEqual(Object.keys(aiSettingsTranslations).sort(), ["cs", "de", "en", "hu", "it", "ro", "sk"]);
  for (const copy of Object.values(aiSettingsTranslations))
    assert.match(copy.solarisLegacyAlias, /^Solaris /);
  assert.equal(new Set(Object.values(aiSettingsTranslations).map(copy => copy.solarisLegacyAlias)).size, 7);
});

test("Solaris is not silently replaced by the old alias when Gateway does not declare it", async () => {
  let posts = 0;
  const adapter = createInternalAIAdapter({
    readConfiguration: () => ({ production: true, replit: false, enabled: true,
      baseURL: "https://synthetic.invalid/gateway/", token: "SYNTHETIC" }),
    fetch: async (url, init) => {
      if (init?.method === "POST") posts++;
      if (String(url).endsWith("health/ready")) return new Response(null);
      if (String(url).endsWith("v1/models"))
        return Response.json({ object: "list", data: [{ id: LEGACY_INTERNAL_MODEL }] });
      return Response.json({ apiVersion: "1", models: [{
        id: LEGACY_INTERNAL_MODEL, revision: "synthetic", operations: ["chat.completions"],
        inputModalities: ["text"], outputFormats: ["text"], streaming: false,
      }] });
    },
  });
  await assert.rejects(adapter.createClient({}, { service: "email.translation" }).chat.completions.create({
    model: SOLARIS_MODEL, messages: [{ role: "user", content: "Synthetic" }],
  }), (error: any) => error.code === "ai_internal_model_unavailable");
  assert.equal(posts, 0);
});
