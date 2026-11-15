// Test-only metadata. Never retains exception messages, URLs, headers or tokens.
function errorIdentity(error) {
  return Object.fromEntries(["name", "code"].flatMap(key => {
    const value = error?.[key];
    return typeof value === "string" && /^[A-Za-z0-9_]{1,80}$/.test(value) ? [[key, value]] : [];
  }));
}
function tokenLimits(request, declarations = null) {
  const model = declarations?.models?.find(m => m.id === request?.model);
  return {
    requestedMaxTokens: request?.max_tokens ?? null,
    declaredMaxOutputTokens: model?.maxOutputTokens ?? null,
    declaredMaxInputTokens: model?.maxInputTokens ?? null,
    declarationSource: model ? "CAPTURED_DISCOVERY" : "NOT_CAPTURED_IN_ORIGINAL_C1",
    automaticallyReduced: false,
  };
}
function declarationsFrom(body) {
  if (!body || !Array.isArray(body.models)) return null;
  return { apiVersion: body.apiVersion ?? null, models: body.models.map(m => ({
    id: m.id, revision: m.revision ?? null,
    maxOutputTokens: Number.isInteger(m.maxOutputTokens) ? m.maxOutputTokens : null,
    maxInputTokens: Number.isInteger(m.maxInputTokens) ? m.maxInputTokens : null,
    operations: Array.isArray(m.operations) ? m.operations.filter(x => typeof x === "string") : [],
    outputFormats: Array.isArray(m.outputFormats) ? m.outputFormats.filter(x => typeof x === "string") : [],
  })) };
}
function diagnose({ error, signal, localReason, traces = [], elapsedMs, historical = false }) {
  const identity = errorIdentity(error);
  const http = [...traces].reverse().find(t => Number.isInteger(t.status) && t.status >= 400);
  if (http) return { kind: [408, 504].includes(http.status) ? "HTTP_TIMEOUT" :
    http.status >= 500 ? "AI_SERVER_OR_GATEWAY_HTTP_ERROR" : "HTTP_ERROR",
    confirmed: true, httpStatus: http.status, stage: http.stage, identity,
    upstreamModelResponsibility: "UNDETERMINED" };
  if ((error?.code || error?.error?.code) === "ai_internal_token_limit_exceeded")
    return { kind: "LOCAL_ADAPTER_TOKEN_LIMIT", confirmed: true, httpStatus: null,
      inferenceHTTPResponse: false, identity };
  if (signal?.aborted) return { kind: localReason === "C11_LOCAL_DEADLINE" ? "LOCAL_DEADLINE" : "LOCAL_ABORT",
    confirmed: true, httpStatus: null, identity };
  if (["APIConnectionTimeoutError", "TimeoutError"].includes(identity.name))
    return { kind: "SDK_TIMEOUT", confirmed: true, httpStatus: null, identity };
  if (["AbortError", "APIUserAbortError"].includes(identity.name))
    return { kind: "ABORT_ORIGIN_UNDETERMINED", confirmed: false, httpStatus: null, identity };
  if (historical && error && elapsedMs >= 119_000 && elapsedMs <= 122_000)
    return { kind: "SUSPECTED_120S_TIMEOUT", confirmed: false, httpStatus: null,
      missingEvidence: "Original abort/error identity and discovery traces were not recorded." };
  const transport = [...traces].reverse().find(t => t.transportError);
  if (transport) return { kind: transport.aborted ? "TRANSPORT_ABORT_OR_SDK_TIMEOUT" : "TRANSPORT_ERROR",
    confirmed: !transport.aborted, stage: transport.stage, httpStatus: null,
    identity: transport.transportError };
  if (traces.some(t => t.stage === "INFERENCE" && t.status === 200))
    return { kind: "NO_TRANSPORT_FAILURE", confirmed: true, httpStatus: 200, identity };
  return { kind: error ? "UNCLASSIFIED_ERROR" : "NO_TRANSPORT_FAILURE", confirmed: !error, httpStatus: null, identity };
}
module.exports = { errorIdentity, tokenLimits, declarationsFrom, diagnose };
