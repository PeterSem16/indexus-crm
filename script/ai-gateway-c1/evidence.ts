import { performance } from "node:perf_hooks";
import { validateInternalRequest, INTERNAL_TEXT_MODELS } from "../../server/lib/ai/internal-contract";
import { replay } from "./replay.cjs";

export type C1Status = "COMPATIBLE" | "REQUIRES_FIX" | "UNSUPPORTED";
export const MODEL = INTERNAL_TEXT_MODELS[0];
export const BASE = "https://ai.cordbloodcenter.com/gateway/";
const REASONS: Record<string, string> = {
  C1_LIVE_EXECUTION_REQUIRED: "Pripravený syntetický textový test; živé volanie a vecná kontrola zatiaľ neboli vykonané.",
  C1_AUDIO_NOT_SUPPORTED_BY_CURRENT_ADAPTER: "Aktuálny INDEXUS adaptér nemá audio operácie. Potrebný je potvrdený kontrakt existujúceho Audio API a syntetické médiá; schopnosť servera sa týmto nehodnotí.",
  ai_internal_unsupported_operation: "Aktuálny INDEXUS adaptér odmieta túto operáciu pred inferenciou (Responses alebo diagnostický chatProbe).",
  ai_internal_text_only: "Požiadavka obsahuje obrazový vstup; aktuálny adaptér prijíma iba content typu string.",
  ai_internal_output_format_not_verified: "Pôvodná požiadavka vyžaduje strict json_schema; aktuálny adaptér pripúšťa iba text/json_object.",
  C1_SOURCE_CONTRACT_ARRAY_VS_JSON_OBJECT: "Pôvodný request žiada json_object, ale pôvodný prompt žiada JSON pole; aktuálny adaptér pole odmietne.",
  C1_AUDIO_RUNTIME_AND_FIXTURE_REQUIRED: "Mapovanie na existujúce Audio API je pripravené. Chýba potvrdená runtime autentifikácia/kodek a syntetická rečová nahrávka so známym prepisom; živý beh nebol vykonaný.",
  C1_TTS_CAPABILITY_NOT_VERIFIED: "Syntéza reči nebola potvrdená. Existencia Whisper prepisu nedokazuje podporu TTS; nový hlasový systém sa nevytvára.",
};

export function safeFailure(error: any) {
  const code = error?.code || error?.error?.code;
  if (typeof code === "string" && /^ai_internal_[a-z_]+$/.test(code)) {
    const adapter = ["unsupported_request", "model_not_allowed", "streaming_not_supported", "text_only",
      "output_format_not_verified", "unsupported_operation", "invalid_temperature", "invalid_token_limit",
      "request_too_large"].some(c => code === "ai_internal_" + c);
    const transport = ["ai_internal_transport_error", "ai_internal_http_error"].includes(code);
    return { code, owner: adapter ? "INDEXUS_ADAPTER" : transport ? "TRANSPORT_OR_GATEWAY" : "GATEWAY_CONTRACT",
      // Invalid JSON alone does not prove that the local model, rather than Gateway serialization, failed.
      responsibilityConfirmed: adapter, httpStatus: Number.isInteger(error?.status) ? error.status : null };
  }
  return { code: ["AbortError", "APIUserAbortError", "APIConnectionTimeoutError"].includes(error?.name)
    ? "C1_ABORT_OR_TIMEOUT" : "C1_UNEXPECTED_HARNESS_ERROR",
    owner: "UNDETERMINED", responsibilityConfirmed: false, httpStatus: null };
}

export function preparedRow(service: any) {
  let reason = "C1_LIVE_EXECUTION_REQUIRED", owner = "INDEXUS_TEST_EXECUTION";
  let status: C1Status = "REQUIRES_FIX";
  if (service.operation === "transcription") {
    reason = "C1_AUDIO_RUNTIME_AND_FIXTURE_REQUIRED"; owner = "INDEXUS_AUDIO_RUNTIME_EVIDENCE";
  } else if (service.operation === "speech") {
    status = "UNSUPPORTED"; reason = "C1_TTS_CAPABILITY_NOT_VERIFIED";
    owner = "AI_SERVER_TTS_CAPABILITY_VERIFICATION";
  } else if (service.operation !== "chat") {
    status = "UNSUPPORTED"; reason = "ai_internal_unsupported_operation"; owner = "INDEXUS_ADAPTER_AND_AI_SERVER_API";
  } else {
    for (const variant of service.variants) {
      if (variant.error) { reason = variant.error; owner = "INDEXUS_TEST_FIXTURE"; continue; }
      try { validateInternalRequest({ ...variant.request, model: MODEL }, [MODEL]); } catch (error) {
        const failure = safeFailure(error);
        status = "UNSUPPORTED"; reason = failure.code; owner = failure.owner;
      }
    }
    if (service.id === "lead_sources.suggestion") {
      status = "REQUIRES_FIX"; reason = "C1_SOURCE_CONTRACT_ARRAY_VS_JSON_OBJECT"; owner = "INDEXUS_SERVICE_CONTRACT";
    }
  }
  return { id: service.id, name: service.name, operation: service.operation, status, reason, owner,
    explanation: REASONS[reason] || reason,
    testTransport: service.operation === "transcription" ? "EXISTING_AUDIO_API" : "EXISTING_GATEWAY_ADAPTER",
    evidenceKind: "STATIC_CONTRACT_ONLY", execution: "NOT_EXECUTED", inferenceMs: null,
    modelCorrectness: "NOT_MEASURED", stability: "NOT_MEASURED",
    parser: "NOT_REPLAYED", validationError: null, attempts: [] as any[],
    coverage: "One synthetic scenario per SDK call-site; not all runtime branches or languages.",
    serverCapabilityConclusion: "NOT_ESTABLISHED" };
}

/** No automatic COMPATIBLE: schema success and parser defaults are not semantic acceptance. */
export function aggregateRow(row: any) {
  const attempts = row.attempts;
  if (!attempts.length) return row;
  row.execution = "EXECUTED";
  row.evidenceKind = "LIVE_ISOLATED_SYNTHETIC";
  const times = attempts.filter((a: any) => typeof a.inferenceMs === "number").map((a: any) => a.inferenceMs);
  row.inferenceMs = times.length ? {
    min: Math.min(...times), mean: times.reduce((a: number, b: number) => a + b, 0) / times.length,
    max: Math.max(...times), samples: times.length,
  } : null;
  const failed = attempts.find((a: any) => a.failure);
  row.parser = [...new Set(attempts.map((a: any) => a.applicationParser?.state || "NOT_REPLAYED"))].join(",");
  row.stability = {
    attempted: attempts.length,
    adapterAccepted: attempts.filter((a: any) => a.adapterOutput !== null).length,
    applicationParserAccepted: attempts.filter((a: any) => a.applicationParser?.state === "ACCEPTED").length,
    perVariant: [...new Set(attempts.map((a: any) => a.variant))].map(variant => {
      const rows = attempts.filter((a: any) => a.variant === variant);
      return { variant, repetitions: rows.length, completeThreeRepetitions: rows.length === 3,
        rawDistinctOutputs: new Set(rows.filter((a: any) => a.modelOutput !== null).map((a: any) => a.modelOutput)).size,
        parserDistinctResults: new Set(rows.filter((a: any) => a.applicationParser?.state === "ACCEPTED")
          .map((a: any) => JSON.stringify(a.applicationParser.value))).size };
    }),
    semanticStability: "NOT_MEASURED",
    note: "Different valid creative outputs are not automatically a failure; exact equality is diagnostic only.",
  };
  if (failed) {
    row.status = "REQUIRES_FIX"; row.reason = failed.failure.code; row.owner = failed.failure.owner;
    row.validationError = failed.failure.code;
  } else if (row.reason !== "C1_SOURCE_CONTRACT_ARRAY_VS_JSON_OBJECT") {
    row.status = "REQUIRES_FIX";
    row.reason = attempts.some((a: any) => a.applicationParser?.state !== "ACCEPTED")
      ? "C1_APPLICATION_PARSER_REPLAY_REQUIRED" : "C1_SEMANTIC_AND_COVERAGE_REVIEW_REQUIRED";
    row.owner = "INDEXUS_COMPATIBILITY_REVIEW";
  }
  row.explanation = REASONS[row.reason] || row.reason;
  return row;
}

export async function executeAttempt(service: any, variant: any, repetition: number, client: any,
  capture: { reset(): void; result(): Promise<any> }, signal?: AbortSignal) {
  const started = performance.now();
  capture.reset();
  const attempt: any = { variant: variant.id, repetition, originalModel: variant.request.model,
    targetModel: MODEL, originalRequest: variant.request, request: { ...variant.request, model: MODEL },
    rawGatewayResponse: null, modelOutput: null, adapterOutput: null, applicationParser: null,
    failure: null, inferenceMs: null, totalMs: null };
  try {
    const completion = await client.chat.completions.create(attempt.request, { signal });
    attempt.adapterOutput = completion;
    attempt.modelOutput = completion.choices[0]?.message?.content ?? null;
    // Generic JSON decode is explicitly not presented as the application's parser.
    try { attempt.rawJsonDecode = { state: "DECODED", value: JSON.parse(attempt.modelOutput) }; }
    catch { attempt.rawJsonDecode = { state: "NOT_JSON", value: null }; }
    attempt.applicationParser = await replay(service.id, attempt.modelOutput, variant.bindings, variant.request, variant);
    if (attempt.applicationParser.state === "REJECTED") attempt.failure = {
      code: attempt.applicationParser.validationError, owner: "MODEL_OUTPUT_OR_APPLICATION_CONTRACT",
      responsibilityConfirmed: false, httpStatus: null,
    };
    else if (["REPLAY_ERROR", "HARNESS_ERROR"].includes(attempt.applicationParser.state)) attempt.failure = {
      code: attempt.applicationParser.validationError, owner: "INDEXUS_TEST_HARNESS",
      responsibilityConfirmed: true, httpStatus: null,
    };
  } catch (error) {
    attempt.failure = safeFailure(error);
    attempt.applicationParser = { state: "NOT_INVOKED", value: null,
      validationError: "C1_ADAPTER_REJECTED_BEFORE_APPLICATION" };
  }
  finally {
    const raw = await capture.result();
    attempt.rawGatewayResponse = raw;
    attempt.inferenceMs = raw?.elapsedMs ?? null;
    // Preserve model text even when the adapter rejects its envelope/JSON.
    if (attempt.modelOutput === null && raw?.body) {
      try { attempt.modelOutput = JSON.parse(raw.body)?.choices?.[0]?.message?.content ?? null; } catch {}
    }
    attempt.totalMs = performance.now() - started;
  }
  return attempt;
}

const escape = (value: any) => String(value ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function csv(report: any) {
  const keys = ["id", "name", "operation", "status", "reason", "explanation", "owner", "evidenceKind", "execution",
    "inferenceMs", "parser", "validationError", "modelCorrectness", "stability"];
  return "\uFEFF" + [keys, ...report.rows.map((r: any) => keys.map(k =>
    typeof r[k] === "object" && r[k] !== null ? JSON.stringify(r[k]) : r[k] ?? ""))]
    .map(row => row.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
}
export function html(report: any) {
  return `<!doctype html><html lang="sk"><meta charset="utf-8"><title>INDEXUS AI Gateway C1</title>
<style>body{font:14px system-ui;margin:30px;color:#192a3e}table{border-collapse:collapse;width:100%}td,th{border:1px solid #d9e0e8;padding:9px;text-align:left;vertical-align:top}th{background:#edf2f7;position:sticky;top:0}input{padding:10px;width:440px;max-width:90%}.UNSUPPORTED{color:#93450b}.REQUIRES_FIX{color:#9e202b}details{max-width:720px}pre{white-space:pre-wrap;overflow-wrap:anywhere}small{color:#516176}</style>
<h1>INDEXUS AI Gateway — fáza C1</h1><p><b>${escape(report.kind)}</b></p>
<p>65 služieb. Produkčné smerovanie sa týmto dokumentom nemení. Gateway musí zostať vypnutá.</p>
<p>UNSUPPORTED znamená nepodporované aktuálnou testovacou cestou alebo nepotvrdenú podporu operácie, nie preukázanú nemožnosť interného servera.
REQUIRES_FIX môže znamenať chýbajúci dôkaz, nie chybu modelu. COMPATIBLE vyžaduje vecnú kontrolu a pokrytie kontraktu.</p>
<p>Modelový text, raw odpoveď Gateway alebo Audio API, výsledok adaptéra a aplikačný parser sú samostatné položky. Čas inferencie je trvanie HTTP volania príslušného API, nie čistý čas generovania modelu.</p>
<input id="search" aria-label="Hľadať službu" placeholder="Hľadať službu, stav, dôvod alebo zodpovednosť">
<table><thead><tr><th>Služba</th><th>Stav / vykonanie</th><th>Dôvod / zodpovednosť</th><th>Meranie a dôkazy</th></tr></thead><tbody>
${report.rows.map((r: any) => `<tr><td><b>${escape(r.id)}</b><br>${escape(r.name)}<br><small>${escape(r.operation)}</small></td>
<td class="${escape(r.status)}">${escape(r.status)}<br><small>${escape(r.execution)}</small></td>
<td>${escape(r.explanation)}<br><small>${escape(r.reason)}<br>${escape(r.owner)}</small></td><td>${r.inferenceMs === null ? "Živé meranie nebolo vykonané" : escape(JSON.stringify(r.inferenceMs))}
<details><summary>Úplný záznam služby</summary><pre>${escape(JSON.stringify(r, null, 2))}</pre></details></td></tr>`).join("")}
</tbody></table><h2>Metadáta a hranice overenia</h2><pre>${escape(JSON.stringify({ ...report, rows: undefined }, null, 2))}</pre>
<script>document.querySelector('#search').addEventListener('input',e=>{for(const r of document.querySelectorAll('tbody tr'))r.hidden=!r.textContent.toLowerCase().includes(e.target.value.toLowerCase())})</script></html>`;
}
