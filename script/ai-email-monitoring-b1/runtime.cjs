"use strict";
/** Validate existing preload output; never load a token through another path. */
function assertRuntime(env) {
  if (env.NODE_ENV !== "production") throw Error("B1_PRODUCTION_PROCESS_REQUIRED");
  if (env.INDEXUS_AI_GATEWAY_ENABLED !== "true" || env.INDEXUS_AI_ROUTER_MODE !== "routed" ||
      env.INDEXUS_AI_GATEWAY_BASE_URL !== "https://ai.cordbloodcenter.com/gateway/" ||
      typeof env.INDEXUS_AI_GATEWAY_TOKEN !== "string" ||
      !/^[\x21-\x7e]{16,8192}$/.test(env.INDEXUS_AI_GATEWAY_TOKEN))
    throw Error("B1_EXISTING_RUNTIME_PRELOAD_REQUIRED");
}
function classifyTarget(input) {
  const url = String(input);
  if (url === "http://10.9.2.140/gateway/v1/chat/completions") return "INFERENCE";
  if (["health/ready", "v1/models", "indexus/v1/capabilities"]
    .some(p => url === "https://ai.cordbloodcenter.com/gateway/" + p)) return "DISCOVERY";
  throw Error("B1_UNEXPECTED_TARGET");
}
module.exports = { assertRuntime, classifyTarget };
