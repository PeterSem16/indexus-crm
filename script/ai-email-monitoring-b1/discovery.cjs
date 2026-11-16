"use strict";
// Read-only diagnostic: three HTTPS GETs, no inference, DB, files or run marker.
const os = require("node:os");
const { assertRuntime, classifyTarget } = require("./runtime.cjs");
const MODEL = "indexus-email-monitoring:v1";
const BASE = "https://ai.cordbloodcenter.com/gateway/";
async function readJson(response) {
  const reader = response.body?.getReader();
  if (!reader) throw Error("B1_DISCOVERY_BODY_MISSING");
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 256 * 1024) throw Error("B1_DISCOVERY_BODY_TOO_LARGE");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { await reader.cancel().catch(() => {}); }
}
async function checkDiscovery({ fetch: transport, token }) {
  const result = { kind: "B1_HTTPS_DISCOVERY_ONLY", inferenceCalls: 0, checks: [],
    model: MODEL, listed: false, declared: false, declaredMaxOutputTokens: null, error: null };
  const documents = {};
  for (const route of ["health/ready", "v1/models", "indexus/v1/capabilities"]) {
    const url = BASE + route;
    if (classifyTarget(url) !== "DISCOVERY") throw Error("B1_UNEXPECTED_TARGET");
    let response;
    try {
      response = await transport(url, { method: "GET", redirect: "error",
        signal: AbortSignal.timeout(8000),
        headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
      result.checks.push({ route, status: response.status });
      if (response.status !== 200) { result.error = "B1_DISCOVERY_HTTP_ERROR"; break; }
      if (route !== "health/ready") documents[route] = await readJson(response);
    } catch (error) {
      result.error = "B1_DISCOVERY_REQUEST_FAILED";
      // Never expose raw exception messages, response bodies or credentials.
      const code = error?.cause?.code ?? error?.code;
      if (typeof code === "string" && /^[A-Z0-9_]{1,80}$/.test(code) && !code.includes(token))
        result.transportCode = code;
      break;
    } finally { await response?.body?.cancel().catch(() => {}); }
  }
  if (!result.error) {
    const models = documents["v1/models"], capabilities = documents["indexus/v1/capabilities"];
    const model = Array.isArray(capabilities?.models) ? capabilities.models.find(m => m?.id === MODEL) : null;
    result.listed = Array.isArray(models?.data) && models.data.some(m => m?.id === MODEL);
    result.declared = !!model;
    result.declaredMaxOutputTokens = Number.isInteger(model?.maxOutputTokens) ? model.maxOutputTokens : null;
    result.jsonObject = Array.isArray(model?.outputFormats) && model.outputFormats.includes("json_object");
    result.chatCompletions = Array.isArray(model?.operations) && model.operations.includes("chat.completions");
    result.textInput = Array.isArray(model?.inputModalities) && model.inputModalities.includes("text");
    result.apiVersion1 = capabilities?.apiVersion === "1";
    if (!result.listed || !result.declared) result.error = "B1_DISCOVERY_MODEL_UNAVAILABLE";
    else if (!result.apiVersion1 || !result.jsonObject || !result.chatCompletions || !result.textInput ||
      result.declaredMaxOutputTokens === null || result.declaredMaxOutputTokens < 200)
      result.error = "B1_DISCOVERY_CAPABILITY_MISMATCH";
  }
  return result;
}
module.exports = { checkDiscovery };
if (require.main === module) (async () => {
  if (process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN || process.platform !== "linux" ||
      os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" || process.getuid?.() !== 1001)
    throw Error("B1_CORPCRM01_AS_SEMAN_REQUIRED");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw Error("B1_TLS_VERIFICATION_REQUIRED");
  assertRuntime(process.env);
  const result = await checkDiscovery({ fetch, token: process.env.INDEXUS_AI_GATEWAY_TOKEN });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.error ? 2 : 0;
})().catch(error => {
  console.error(/^B1_[A-Z0-9_]+$/.test(error?.message) ? error.message : "B1_DISCOVERY_FAILED");
  process.exitCode = 1;
});
