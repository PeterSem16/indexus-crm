import { internalAIAdapter } from "./internal-adapter";
import { openAIAdapter } from "./openai-adapter";
import { InternalAIError } from "./internal-contract";
import { AISettingsError } from "./settings-policy";
import type { AIVerification } from "../../../shared/ai-settings";

type InternalAdapter = typeof internalAIAdapter;
export function assertInternalRuntime(adapter: InternalAdapter) {
  const runtime = adapter.runtimeStatus();
  if (!runtime.production || runtime.replit) throw new AISettingsError("ai_internal_production_only", 503);
  if (!runtime.serverAllowed) throw new AISettingsError("ai_internal_disabled", 503);
  if (!runtime.tokenConfigured) throw new AISettingsError("ai_internal_configuration_missing", 503);
}
/** No raw vendor messages, response content, URLs, request bodies, or headers escape. */
export function safeCheckCode(error: unknown) {
  if (error instanceof AISettingsError || error instanceof InternalAIError) return error.code;
  const code = (error as any)?.code;
  if (typeof code === "string" && /^ai_internal_[a-z_]+$/.test(code)) return code;
  return "ai_test_failed";
}
export async function checkAIProvider(kind: AIVerification["kind"], version: number,
  dependencies: { internal?: InternalAdapter; openai?: typeof openAIAdapter; now?: () => number } = {}): Promise<AIVerification> {
  const internal = dependencies.internal ?? internalAIAdapter, openai = dependencies.openai ?? openAIAdapter;
  const now = dependencies.now ?? Date.now, started = now();
  const result: AIVerification = { state: "checking", kind, settingsVersion: version,
    checkedAt: new Date(started).toISOString(), durationMs: 0, textVerified: false, jsonVerified: false, models: [] };
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 90_000);
  try {
    if (kind === "openai") {
      if (!openai.isAvailable()) throw new AISettingsError("openai_not_configured", 503);
      const client = openai.createClient({ timeout: 20_000, maxRetries: 0 });
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini", messages: [{ role: "user", content: "Synthetic connection test. Reply exactly INDEXUS_TEST_OK." }],
        temperature: 0, max_tokens: 32, stream: false,
      }, { signal: controller.signal });
      if (response.choices[0]?.message.content?.trim() !== "INDEXUS_TEST_OK") throw new AISettingsError("ai_test_failed", 502);
      result.textVerified = true;
    } else {
      assertInternalRuntime(internal); // Must run before *any* network request.
      const discovery = await internal.inspect({ signal: controller.signal, timeoutMs: 15_000 });
      result.models = discovery.models;
      if (kind === "smoke") {
        const client = internal.createClient({ timeout: 30_000, maxRetries: 0 });
        const plain = await client.chat.completions.create({
          model: "indexus-document-audio:latest", messages: [{ role: "user",
            content: "Synthetic connection test. Reply exactly INDEXUS_TEST_OK." }],
          temperature: 0, max_tokens: 64, stream: false,
        }, { signal: controller.signal });
        if (plain.choices[0]?.message.content?.trim() !== "INDEXUS_TEST_OK")
          throw new AISettingsError("ai_internal_text_smoke_failed", 502);
        result.textVerified = true;
        const json = await client.chat.completions.create({
          model: "indexus-document-audio:latest", messages: [
            { role: "system", content: 'Return only JSON {"marker":"indexus-test","sum":5}.' },
            { role: "user", content: "Synthetic arithmetic check: compute 2 + 3." },
          ], response_format: { type: "json_object" }, temperature: 0, max_tokens: 128, stream: false,
        }, { signal: controller.signal });
        let value: any;
        try { value = JSON.parse(json.choices[0]?.message.content ?? "null"); } catch {}
        if (!value || value.marker !== "indexus-test" || value.sum !== 5 ||
          Object.keys(value).sort().join(",") !== "marker,sum")
          throw new AISettingsError("ai_internal_json_smoke_failed", 502);
        result.jsonVerified = true;
      }
    }
    result.state = "ready";
  } catch (error) {
    result.code = controller.signal.aborted ? "ai_test_timeout" : safeCheckCode(error);
    result.state = ["ai_internal_production_only", "ai_internal_disabled", "ai_internal_configuration_missing",
      "openai_not_configured"].includes(result.code) ? "blocked" : "failed";
  } finally { clearTimeout(timer); }
  result.durationMs = Math.max(0, now() - started);
  return result;
}
