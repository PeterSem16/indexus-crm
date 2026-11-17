/** Explicitly authorized synthetic model test. No CRM imports, DB or mailbox polling. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createGatewayPilot, hash, PilotError } from "./gateway-client";
import { regressionCases } from "./regression-corpus";
import { evaluateRegression, summarizeRegression } from "./regression-evaluator";

declare const SENTIMENT_ONE_SHOT_ENTRY: boolean;
export const EXPECTED_REVISION = "e46620d62f883e325d5ecc58fc98beaece67aa4436ea903588ab87b65c0fec45";
export const RUN_FLAG = "--run-18-synthetic-once";
export const TARGETED_RUN_FLAG = "--run-k01-k02-k03-once";
export const RISK_FLAG = "--acknowledge-unverified-production-impact";
type Pilot = ReturnType<typeof createGatewayPilot>;

export async function runOneShot(options: {
  client: Pilot; authorized: boolean; acknowledgeUnverifiedImpact: boolean;
  signal?: AbortSignal; write: (value: unknown) => void;
  wait?: (ms: number) => Promise<void>;
  scope?: "full" | "k01-k03";
  adapterSourceSha256?: string;
}) {
  if (!options.authorized || !options.acknowledgeUnverifiedImpact)
    throw new PilotError("explicit_one_shot_and_unverified_impact_acknowledgement_required");
  if (options.adapterSourceSha256 !== undefined && !/^[a-f0-9]{64}$/i.test(options.adapterSourceSha256))
    throw new PilotError("invalid_operator_reported_adapter_sha256");
  const { client } = options;
  const scope = options.scope ?? "full";
  if (scope !== "full" && scope !== "k01-k03") throw new PilotError("invalid_synthetic_test_scope");
  const selected = scope === "k01-k03" ? regressionCases.slice(0, 3) : regressionCases;
  const selectedIds = selected.map(row => row.id);
  const postponed = regressionCases.filter(row => !selectedIds.includes(row.id)).map(row => row.id);
  const durationLimit = scope === "k01-k03" ? 180_000 : 600_000;
  const controller = new AbortController(), abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const deadline = Date.now() + durationLimit;
  const timer = setTimeout(abort, durationLimit);
  const results: ReturnType<typeof evaluateRegression>[] = [];
  let stopped: string | null = null;
  const startedAt = new Date().toISOString();
  const write = (value: unknown) => options.write(JSON.parse(client.stringifySafe(value)));
  const wait = options.wait ?? (ms => new Promise<void>(resolve => {
    const timeout = setTimeout(done, ms);
    function done() { clearTimeout(timeout); controller.signal.removeEventListener("abort", done); resolve(); }
    controller.signal.addEventListener("abort", done, { once: true });
    if (controller.signal.aborted) done();
  }));
  try {
    write({ kind: "start", startedAt, baseURL: client.baseURL, model: "indexus-email-sentiment:4b",
      corpusSha256: hash(JSON.stringify(regressionCases)), analyzerSha256: client.analyzerSha256,
      scope, authorizedCaseIds: selectedIds, postponedNotAuthorized: postponed,
      selectedCorpusSha256: hash(JSON.stringify(selected)),
      ...(scope === "k01-k03" ? {
        operatorReportedAdapterSourceSha256: options.adapterSourceSha256?.toLowerCase() ?? null,
        adapterSourceVerifiedByRunner: false,
      } : {}),
      expectedCases: selected.length, concurrency: 1, retries: 0, fallback: false, syntheticOnly: true,
      telemetry: "NOT_VERIFIED", productionImpact: "NOT_VERIFIED",
      executionAuthorization: "EXPLICIT_OPERATOR_ONE_SHOT", businessEffects: 0,
      analyzerScope: "ISOLATED_CANDIDATE_NOT_INSTALLED_CRM",
      productionActivationAllowed: false });
    if (options.signal?.aborted) abort();
    if (controller.signal.aborted) throw new PilotError("operator_stop");
    // Required adapter admission, not a new standalone connectivity test.
    const discovery = await client.inspect();
    const model = discovery.models.find(row => row.id === "indexus-email-sentiment:4b");
    if (model?.revision !== EXPECTED_REVISION) throw new PilotError("model_revision_changed");
    if (controller.signal.aborted) throw new PilotError("operator_stop");
    client.arm(deadline);
    for (const row of selected) {
      if (controller.signal.aborted || Date.now() >= deadline) { stopped = "deadline_or_operator_stop"; break; }
      const first = client.observations.length, start = new Date().toISOString(), t0 = performance.now();
      const caseController = new AbortController(), stopCase = () => caseController.abort();
      controller.signal.addEventListener("abort", stopCase, { once: true });
      if (controller.signal.aborted) stopCase();
      let analysis: Awaited<ReturnType<Pilot["analyze"]>>;
      try { analysis = await client.analyze(row.content, row.subject, caseController.signal); }
      finally { controller.signal.removeEventListener("abort", stopCase); }
      const evaluation = evaluateRegression(row.id, analysis);
      results.push(evaluation);
      write({ kind: "case", id: row.id, startedAt: start, endedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - t0), http: client.observations.slice(first),
        analysis, evaluation, noteLanguageReview: "PENDING_HUMAN_REVIEW", businessEffects: 0 });
      if (!analysis || analysis.status === "failed") { stopped = "technical_failure_no_retry"; break; }
      if (controller.signal.aborted) { stopped = "deadline_or_operator_stop"; break; }
      if (evaluation.mismatches.some(key => ["wantsConsent", "wantsToCancel"].includes(key))) {
        stopped = "critical_reference_mismatch"; break;
      }
      if (results.length < selected.length) await wait(1000);
    }
  } catch (error) {
    stopped = error instanceof PilotError ? error.message : "run_failed_no_retry";
  } finally {
    client.disarm(); clearTimeout(timer); options.signal?.removeEventListener("abort", abort);
  }
  const summary = { kind: "summary", startedAt, endedAt: new Date().toISOString(),
    ...summarizeRegression(results),
    scope, expectedCases: selected.length,
    missing: selectedIds.filter(id => !results.some(row => row.id === id)),
    postponedNotAuthorized: postponed,
    referenceChecksAccepted: results.length === selected.length &&
      results.every(row => row.status === "PASS" || row.status === "SAFE_REJECTION"),
    completeAndAccepted: false, stopped, inferenceAttempts: client.attempts(),
    outcome: "REQUIRES_HUMAN_REVIEW", manualNoteReviewRequired: true,
    telemetry: "NOT_VERIFIED", productionImpact: "NOT_VERIFIED", businessEffects: 0,
    productionActivationAllowed: false };
  write(summary);
  return summary;
}

export async function main(argv = process.argv.slice(2)) {
  if (![3, 5].includes(argv.length) || ![RUN_FLAG, TARGETED_RUN_FLAG].includes(argv[0]) ||
    argv[1] !== RISK_FLAG || !path.isAbsolute(argv[2]))
    throw new PilotError("explicit_flags_and_absolute_private_output_directory_required");
  if (argv.length === 5 && (argv[3] !== "--adapter-source-sha256" || !/^[a-f0-9]{64}$/i.test(argv[4])))
    throw new PilotError("invalid_operator_reported_adapter_sha256");
  if (process.platform !== "linux" || os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" ||
    process.getuid?.() !== 1001 || process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0")
    throw new PilotError("verified_CORPCRM01_runtime_required");
  const directory = fs.lstatSync(argv[2]);
  if (!directory.isDirectory() || directory.isSymbolicLink() ||
    directory.uid !== process.getuid?.() || (directory.mode & 0o077))
    throw new PilotError("private_operator_directory_required");
  const client = createGatewayPilot();
  const fd = fs.openSync(path.join(argv[2], "results.jsonl"), "wx", 0o600);
  const controller = new AbortController(), abort = () => controller.abort();
  process.once("SIGINT", abort); process.once("SIGTERM", abort);
  try {
    return await runOneShot({ client, authorized: true, acknowledgeUnverifiedImpact: true,
      scope: argv[0] === TARGETED_RUN_FLAG ? "k01-k03" : "full",
      adapterSourceSha256: argv.length === 5 ? argv[4] : undefined,
      signal: controller.signal, write(value) {
        const text = client.stringifySafe(value);
        fs.writeSync(fd, text + "\n"); fs.fsyncSync(fd);
        console.log(text);
      } });
  } finally {
    client.disarm(); fs.closeSync(fd);
    process.removeListener("SIGINT", abort); process.removeListener("SIGTERM", abort);
  }
}
if (typeof SENTIMENT_ONE_SHOT_ENTRY !== "undefined" && SENTIMENT_ONE_SHOT_ENTRY) {
  main().then(value => { if (value.evaluatedCases !== value.expectedCases || value.failures || value.stopped) process.exitCode = 2; })
    .catch(error => {
      console.log(JSON.stringify({ outcome: "BLOCKED", executionStatus: "CHECK_PRIVATE_REPORT",
        code: error instanceof PilotError ? error.message : "local_preparation_failed" }));
      process.exitCode = 2;
    });
}
