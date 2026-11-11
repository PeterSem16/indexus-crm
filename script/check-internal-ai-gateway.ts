/**
 * Operator-only diagnostics on CORPCRM01, after separate deployment approval.
 * No DB/application import. Default adapter rejects all requests from Replit.
 */
import { internalAIAdapter } from "../server/lib/ai/internal-adapter";
import { INTERNAL_TEXT_MODELS, InternalAIError } from "../server/lib/ai/internal-contract";

async function main() {
  const mode = process.argv[2];
  if (process.argv.length !== 3 || !["--check", "--smoke"].includes(mode)) {
    console.error("Use --check for readiness/discovery, or --smoke for two synthetic text/JSON calls. CORPCRM01 only.");
    process.exitCode = 2;
    return;
  }
  const discovery = await internalAIAdapter.inspect();
  const model = INTERNAL_TEXT_MODELS[0];
  if (!discovery.models.some(item => item.id === model)) throw new InternalAIError("ai_internal_model_unavailable", 503);
  console.log(JSON.stringify({ check: "discovery", ...discovery }));
  if (mode === "--smoke") {
    const client = internalAIAdapter.createClient({ timeout: 30_000, maxRetries: 0 });
    const plain = await client.chat.completions.create({
      model, messages: [{ role: "user", content: "Synthetic connectivity check. Reply with exactly INDEXUS_TEST_OK." }],
      temperature: 0, max_tokens: 64, stream: false,
    });
    if (plain.choices[0]?.message.content?.trim() !== "INDEXUS_TEST_OK")
      throw new InternalAIError("ai_internal_text_smoke_failed");
    console.log(JSON.stringify({ check: "plain_text", passed: true }));
    const json = await client.chat.completions.create({
      model, messages: [
        { role: "system", content: 'Return only JSON {"marker":"indexus-test","sum":5}.' },
        { role: "user", content: "Synthetic arithmetic check: compute 2 + 3." },
      ], response_format: { type: "json_object" }, temperature: 0, max_tokens: 128, stream: false,
    });
    const value = JSON.parse(json.choices[0]?.message.content ?? "null");
    if (!value || value.marker !== "indexus-test" || value.sum !== 5 ||
      Object.keys(value).sort().join(",") !== "marker,sum")
      throw new InternalAIError("ai_internal_json_smoke_failed");
    console.log(JSON.stringify({ check: "json_object", passed: true, strictJsonSchemaVerified: false }));
  }
}
main().catch(error => {
  // Do not print SDK/raw network errors, response bodies, URLs or credentials.
  const code = error instanceof InternalAIError ? error.code : "ai_internal_diagnostic_failed";
  console.error(JSON.stringify({ passed: false, code }));
  process.exitCode = 1;
});
