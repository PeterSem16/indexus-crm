#!/usr/bin/env node
// OFFLINE ONLY. Reads immutable C1 evidence and hash-pinned source; no SDK client,
// DB connection, environment credentials, production app import or network calls.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { replay } = require("./replay.cjs");
const { tokenLimits, diagnose } = require("./diagnostics.cjs");
const definitions = require("./c11-findings.json");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw Error(code); };
const same = (a, b) => assert.deepEqual(a, b);
function verifySources(plan, root) {
  if (plan.phase !== "C1" || plan.policy?.syntheticOnly !== true ||
      plan.policy.gatewayEnabled !== false || plan.policy.productionProvider !== "openai" ||
      plan.policy.fallback !== false || plan.policy.automaticMigration !== false ||
      plan.services?.length !== 65 || new Set(plan.services.map(s => s.id)).size !== 65)
    fail("C11_PLAN_INVALID");
  for (const required of ["server/lib/ai/internal-contract.ts", "server/lib/ai/internal-adapter.ts",
    "server/lib/ai/service-catalog.ts"]) if (!plan.sourceHashes[required]) fail("C11_SOURCE_PIN_REQUIRED");
  for (const [file, expected] of Object.entries(plan.sourceHashes)) {
    const full = path.resolve(root, file);
    if (!full.startsWith(root + path.sep) || !fs.realpathSync(full).startsWith(root + path.sep) ||
        hash(fs.readFileSync(full)) !== expected) fail("C11_SOURCE_HASH_MISMATCH");
  }
}
function validateEvidence(report, plan) {
  if (report.kind !== "LIVE_ISOLATED_SYNTHETIC" || report.planSha256 !== hash(JSON.stringify(plan)) ||
      report.rows?.length !== 65 || new Set(report.rows.map(r => r.id)).size !== 65)
    fail("C11_EVIDENCE_PLAN_MISMATCH");
  same(report.rows.map(r => r.id).sort(), plan.services.map(s => s.id).sort());
  for (const row of report.rows) {
    const service = plan.services.find(s => s.id === row.id);
    for (const a of row.attempts) {
      const variant = service.variants.find(v => v.id === a.variant);
      if (!variant || ![1, 2, 3].includes(a.repetition)) fail("C11_ATTEMPT_IDENTITY_INVALID");
      same(a.originalRequest, variant.request);
      same(a.request, { ...variant.request, model: "indexus-document-audio:latest" });
      if (a.rawGatewayResponse?.body) {
        const raw = JSON.parse(a.rawGatewayResponse.body);
        if (raw.choices?.[0]?.message?.content !== a.modelOutput) fail("C11_RAW_MODEL_MISMATCH");
      }
    }
  }
}
async function build(plan, root, reports) {
  verifySources(plan, root);
  // Pure original adapter validators only, never the SDK/adapter transport.
  const { validateInternalRequest, validateInternalCompletion } =
    require(path.join(root, "server/lib/ai/internal-contract.ts"));
  const measured = new Map();
  for (const report of reports) {
    validateEvidence(report, plan);
    for (const row of report.rows.filter(r => r.attempts.length)) {
      if (measured.has(row.id)) fail("C11_DUPLICATE_SERVICE_EVIDENCE");
      measured.set(row.id, row);
    }
  }
  const result = {
    phase: "C1.1", kind: "OFFLINE_REPLAY_OF_IMMUTABLE_C1_EVIDENCE",
    generatedAtUtc: new Date().toISOString(), planSha256: hash(JSON.stringify(plan)),
    liveCallsDuringC11: 0, productionWrites: 0, promptsModified: false,
    sourceValidation: "ALL_PLAN_SOURCE_HASHES_VERIFIED",
    toolSourceHashes: Object.fromEntries(["offline-c11.cjs", "replay.cjs", "boundary-replay.cjs",
      "diagnostics.cjs", "c11-findings.json"].map(f => [f, hash(fs.readFileSync(path.join(__dirname, f)))])),
    productionState: "NOT_OBSERVED_DURING_OFFLINE_C11",
    originalConfigurationEvidence: reports.map(r => ({ before: r.before, after: r.after,
      finalVerified: r.finalVerified, sourceKind: "UPLOADED_C1_NOT_CURRENT_OBSERVATION" })),
    rows: [], limitations: [
      "ACCEPTED is only acceptance by the declared original pure parser boundary, not semantic correctness or completed integration.",
      "Captured original prefixes stop before IO/enrichment/mapping. omittedDownstream explicitly marks incomplete route coverage.",
      "Missing historical model declarations remain null; no discovery request is made to fill them.",
      "Historical ~120-second failures are suspected timeouts only; original local abort/HTTP status/server root cause is unknown.",
      "No original attempt, original failure, prompt, max_tokens or original parser result is overwritten.",
      "Model content is observed after Gateway; model-only responsibility requires upstream evidence.",
    ],
  };
  for (const base of reports[0].rows) {
    const source = measured.get(base.id) || base;
    const service = plan.services.find(s => s.id === source.id);
    const row = { id: source.id, name: source.name, operation: source.operation,
      status: source.status, originalReason: source.reason, replayAttempts: [] };
    for (const original of source.attempts) {
      const variant = service.variants.find(v => v.id === original.variant);
      const immutable = hash(JSON.stringify(original));
      let adapter = { state: "NOT_INVOKED", value: null };
      if (original.rawGatewayResponse?.status === 200 && original.rawGatewayResponse.body) {
        try {
          const spec = validateInternalRequest(original.request, ["indexus-document-audio:latest"]);
          adapter = { state: "ACCEPTED", value: validateInternalCompletion(
            JSON.parse(original.rawGatewayResponse.body), spec) };
          same(adapter.value, original.adapterOutput);
        } catch (error) {
          if (error?.code === "ERR_ASSERTION") fail("C11_ADAPTER_REPLAY_MISMATCH");
          adapter = { state: "REJECTED", value: null,
            code: /^[a-z_]+$/.test(error?.code || "") ? error.code : "C11_ADAPTER_VALIDATION_FAILED" };
        }
      }
      let parser = { state: "NOT_INVOKED", value: null, validationError: "C11_NO_ACCEPTED_ADAPTER_OUTPUT" };
      if (adapter.state === "ACCEPTED") {
        parser = await replay(source.id, original.modelOutput, variant.bindings, variant.request, variant,
          { sourceRoot: root, bounded: true });
      }
      if (hash(JSON.stringify(original)) !== immutable) fail("C11_ORIGINAL_EVIDENCE_MUTATED");
      row.replayAttempts.push({
        variant: original.variant, repetition: original.repetition,
        originalAttemptSha256: immutable, originalAttempt: original,
        model: { state: original.modelOutput === null ? "NOT_CAPTURED" : "RECORDED",
          value: original.modelOutput, transformed: false },
        adapter: { recordedOutput: original.adapterOutput, offlineReplay: adapter },
        applicationParser: { recorded: original.applicationParser, offlineReplay: parser },
        tokenLimits: { ...tokenLimits(original.request, original.modelDeclarations || null),
          originalRequestedMaxTokens: original.originalRequest.max_tokens ?? null,
          exceedsDeclaredMaximum: original.failure?.code === "ai_internal_token_limit_exceeded" ? true : null,
          declarationProvenance: original.modelDeclarations ? "ORIGINAL_CAPTURE" : "UNKNOWN_NOT_RECONSTRUCTED" },
        diagnostic: original.transportDiagnostic || diagnose({ historical: true,
          error: original.failure, elapsedMs: original.totalMs,
          traces: original.rawGatewayResponse ? [{ stage: "INFERENCE", status: original.rawGatewayResponse.status }] : [] }),
        originalFailureInterpretation: source.id === "task.sentiment" && parser.returnKind === "undefined"
          ? "CONFIRMED_WRAPPER_FALSE_REJECTION_NOT_MODEL_JSON_ERROR"
          : original.failure?.code === "ai_internal_token_limit_exceeded"
            ? "CONFIRMED_LOCAL_ADAPTER_PREINFERENCE_TOKEN_REJECTION" : null,
      });
    }
    result.rows.push(row);
  }
  const attempts = result.rows.flatMap(r => r.replayAttempts);
  result.summary = {
    services: result.rows.length, testedServices: result.rows.filter(r => r.replayAttempts.length).length,
    attempts: attempts.length,
    adapterStates: count(attempts.map(a => a.adapter.offlineReplay.state)),
    parserStates: count(attempts.map(a => a.applicationParser.offlineReplay.state)),
    parserBoundaries: count(attempts.map(a => a.applicationParser.offlineReplay.boundary || "NONE")),
    blockedEffects: attempts.reduce((n, a) => n + (a.applicationParser.offlineReplay.blockedEffects?.length || 0), 0),
    unknownDeclaredLimitCount: attempts.filter(a => a.tokenLimits.declaredMaxOutputTokens === null).length,
    compatible: result.rows.filter(r => r.status === "COMPATIBLE").length,
  };
  result.issues = issueEvidence(result);
  result.targetedValidation = {
    liveExecutionAuthorized: false, automaticExecution: false,
    productionGatewayEnabled: false, productionProvider: "openai",
    promptsMayBeChanged: false, automaticTokenReduction: false,
    baselinePlanSha256: result.planSha256,
    prerequisites: [
      "Separate explicit approval before any live request; no bulk replay is started by C1.1.",
      "Retain exact original synthetic requests and preserve before/after read-only routing checks.",
      "Record per-attempt discovery declarations, requested token budgets, abort origin, HTTP status and upstream correlation.",
      "Resolve INDEXUS source-contract contradictions separately; preserve the original baseline and label any approved revised contract.",
    ],
    groups: [
      { purpose: "Content regressions", services: [...new Set(definitions.confirmedOutputIssues.map(i => i.service))],
        action: "Select exact recorded failing variants first; evaluate semantics, not JSON validity alone." },
      { purpose: "Capability mismatch", services: definitions.capabilityMismatches.map(i => i.service),
        action: "Obtain actual declared limits in the authorized test and reconcile with unchanged 16000/12000 requests; do not silently reduce." },
      { purpose: "Timeout attribution", services: ["executive.summary", "cbu_report.analysis"],
        action: "Start with one separately approved instrumented request per affected call-site, not another 49-service run. Preserve original timeout budget." },
      { purpose: "Contract blockers", services: definitions.sourceContractConflicts.map(i => i.service),
        action: "INDEXUS must choose the consistent contract before treating server behavior as a pass/fail target." },
    ],
    excludedUntilSeparateEvidence: ["All seven transcription services", "All four speech/TTS services",
      "Strict schema / image / Responses / diagnostic probe unsupported test paths"],
  };
  return result;
}
function count(values) { return values.reduce((m, v) => { m[v] = (m[v] || 0) + 1; return m; }, {}); }
function issueEvidence(result) {
  return Object.fromEntries(Object.entries(definitions).map(([category, issues]) => [category, issues.map(issue => {
    const row = result.rows.find(r => r.id === issue.service);
    const evidence = row?.replayAttempts.filter(a =>
      (!issue.variant || a.variant === issue.variant) && (!issue.repetition || a.repetition === issue.repetition)) || [];
    return { ...issue, evidenceAvailable: evidence.length > 0,
      attribution: category === "confirmedOutputIssues"
        ? "CONFIRMED_GATEWAY_OBSERVED_CONTENT_NOT_EXCLUSIVE_LOCAL_MODEL_ATTRIBUTION" : "SEE_OWNER",
      evidence: evidence.map(a => ({ variant: a.variant, repetition: a.repetition,
        originalAttemptSha256: a.originalAttemptSha256, request: a.originalAttempt.request,
        modelOutput: a.model.value, parser: a.applicationParser.offlineReplay })) };
  })]));
}
const escape = v => String(v ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function writeOutputs(out, result) {
  fs.mkdirSync(out, { recursive: false, mode: 0o700 });
  const write = (name, text) => fs.writeFileSync(path.join(out, name), text, { mode: 0o600, flag: "wx" });
  write("evidence-c11.json", JSON.stringify(result, null, 2) + "\n");
  write("ai-server-issues.json", JSON.stringify(result.issues, null, 2) + "\n");
  write("targeted-validation-plan.json", JSON.stringify(result.targetedValidation, null, 2) + "\n");
  const columns = ["service", "variant", "repeat", "model", "adapter", "parser", "boundary",
    "omittedDownstream", "requestedMaxTokens", "declaredMaxOutputTokens", "declaredMaxInputTokens",
    "declarationSource", "diagnostic", "confirmed", "originalAttemptSha256"];
  const records = result.rows.flatMap(r => r.replayAttempts.map(a => [
    r.id, a.variant, a.repetition, a.model.state, a.adapter.offlineReplay.state,
    a.applicationParser.offlineReplay.state, a.applicationParser.offlineReplay.boundary,
    a.applicationParser.offlineReplay.omittedDownstream, a.tokenLimits.requestedMaxTokens,
    a.tokenLimits.declaredMaxOutputTokens, a.tokenLimits.declaredMaxInputTokens,
    a.tokenLimits.declarationSource, a.diagnostic.kind, a.diagnostic.confirmed, a.originalAttemptSha256,
  ]));
  write("offline-parser-replay.csv", "\uFEFF" + [columns, ...records].map(row =>
    row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n"));
  const issueMarkdown = Object.entries(result.issues).map(([category, issues]) =>
    `## ${category}\n\n` + issues.map(i =>
      `- **${i.service}**: ${i.finding}\n  - Vlastník: ${i.owner || "AI server / Gateway content review; upstream pôvod nepotvrdený"}.\n  - Dôkazy: ${i.evidence.map(e => `${e.variant}/${e.repetition}`).join(", ") || "chýbajú"}.\n`).join("\n")).join("\n");
  write("ai-server-issues.md", `# C1.1 — konkrétne problémy pre spoločné preverenie\n\nŽiadne nové AI volania. Pôvodné prompty a max_tokens nezmenené. Výstup je pozorovaný za Gateway, nie preukázaná výlučná chyba lokálneho modelu. Konflikty zdrojových kontraktov patria INDEXUS, nie automaticky AI serveru. Riziká vyžadujúce odbornú kontrolu nie sú vydávané za externe dokázané právne/medicínske chyby.\n\n${issueMarkdown}`);
  const tables = result.rows.map(r => {
    const a = r.replayAttempts;
    const requested = [...new Set(a.map(x => x.tokenLimits.requestedMaxTokens ?? "pôvodne neudané"))].join(", ");
    const declared = [...new Set(a.map(x => x.tokenLimits.declaredMaxOutputTokens ?? "NEZACHYTENÉ"))].join(", ");
    return `<tr><td>${escape(r.id)}</td><td>${escape(r.status)}</td><td>${a.length}</td><td>${escape(JSON.stringify(count(a.map(x => x.applicationParser.offlineReplay.state))))}</td><td>${escape(requested)}</td><td>${escape(declared)}</td><td><details><summary>Oddelené dôkazy model / adaptér / parser</summary><pre>${escape(JSON.stringify(a, null, 2))}</pre></details></td></tr>`;
  }).join("");
  const html = `<!doctype html><html lang="sk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>INDEXUS C1.1 — offline evidencia</title><style>body{font:15px/1.5 system-ui;margin:24px;color:#193049}table{border-collapse:collapse;width:100%}td,th{padding:10px;border:1px solid #ccd5df;text-align:left;vertical-align:top}th{background:#eef3f8}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}details{max-width:700px}.scroll{overflow:auto}</style><h1>C1.1 — offline opravy a parser replay</h1><p><strong>Žiadne nové AI volania. Žiadne produkčné zápisy ani zmena promptov.</strong> Stav produkcie sa offline nepozoruje; pôvodné snapshoty sa zachovávajú.</p><p>Tri vrstvy sú samostatné: nezmenený modelový obsah, pôvodná odpoveď adaptéra a nový offline výsledok pôvodného aplikačného parsera. ACCEPTED nie je schválenie vecnej správnosti.</p><h2>Súhrn</h2><pre>${escape(JSON.stringify(result.summary, null, 2))}</pre><h2>Limity a diagnostika</h2><p>V starých C1 dátach sa číselné deklarované limity neuložili: ostávajú null/NEZACHYTENÉ. Nevykonávame discovery, nemeníme max_tokens a nevymýšľame hodnoty. Nový testovací transport pri neskoršom samostatne povolenom behu zaznamená deklarácie i pôvodné požiadavky. Staré 120-sekundové zlyhania sú iba SUSPECTED, nie spätne potvrdený lokálny abort či HTTP timeout.</p><h2>Hranice replay</h2><ul>${result.limitations.map(x => `<li>${escape(x)}</li>`).join("")}</ul><h2>Všetkých 65 služieb</h2><div class="scroll"><table><thead><tr><th>Služba</th><th>Stav</th><th>Pokusy</th><th>Parser C1.1</th><th>Požadované max_tokens</th><th>Deklarované maximum</th><th>Dôkazy</th></tr></thead><tbody>${tables}</tbody></table></div><h2>Problémy pre spoločné preverenie</h2><pre>${escape(JSON.stringify(result.issues, null, 2))}</pre></html>`;
  if (Buffer.byteLength(html) > 5 * 1024 * 1024) fail("C11_HTML_TOO_LARGE");
  write("evidence-c11.html", html);
}
async function main(args) {
  // Only named explicit local files. No discovery or live mode exists here.
  const [planFile, sourceRoot, out, ...files] = args;
  if (!planFile || !sourceRoot || !out || !files.length) fail("C11_ARGUMENTS_INVALID");
  globalThis.fetch = () => { throw Error("C11_NETWORK_FORBIDDEN"); };
  const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
  const reports = files.map(f => JSON.parse(fs.readFileSync(f, "utf8")));
  const result = await build(plan, path.resolve(sourceRoot), reports);
  result.inputFiles = files.map(f => ({ name: path.basename(f), sha256: hash(fs.readFileSync(f)) }));
  writeOutputs(path.resolve(out), result);
  console.log(JSON.stringify(result.summary, null, 2));
}
module.exports = { build, verifySources, validateEvidence, writeOutputs };
if (require.main === module) main(process.argv.slice(2)).catch(e => {
  console.error(/^C11_[A-Z0-9_]+$/.test(e?.message) ? e.message : "C11_OFFLINE_FAILED");
  process.exitCode = 1;
});
