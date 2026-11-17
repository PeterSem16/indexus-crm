import { createGatewayPilot, hash, PilotError } from "./gateway-client";
import { corpusSha256, telemetryState, type Preflight } from "./live-preflight";
import { regressionCases } from "./regression-corpus";
import { evaluateRegression } from "./regression-evaluator";

/** No application startup, DB writers, mailbox polling or fallback are reachable here. */
export async function runSequentialRegression(options: {
  client: ReturnType<typeof createGatewayPilot>; preflight: Preflight; approved: boolean;
  monitor: () => Promise<unknown>; readRoutingSnapshot: () => Promise<unknown>;
  onCase: (result: unknown) => Promise<void>; signal?: AbortSignal;
  wait?: (ms: number) => Promise<void>;
}) {
  const { client, preflight } = options;
  if (!options.approved || preflight.outcome !== "READY_FOR_ISOLATED_SEQUENCE" ||
    preflight.baseURL !== client.baseURL || preflight.corpusSha256 !== corpusSha256() ||
    !preflight.windowEndsAt || !Number.isFinite(Date.parse(preflight.windowEndsAt)))
    throw new PilotError("approved_healthy_isolated_sequence_required");
  const baseline = hash(JSON.stringify(await options.readRoutingSnapshot()));
  const started = performance.now(), expires = Date.parse(preflight.windowEndsAt);
  const wait = options.wait ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const results: any[] = [];
  let stopped: string | null = null;
  client.arm(Math.min(expires, Date.now() + 600_000));
  try {
    for (const row of regressionCases) {
      if (options.signal?.aborted || performance.now() - started >= 600_000 || Date.now() >= expires) {
        stopped = "time_window_or_operator_stop"; break;
      }
      if (!telemetryState(await options.monitor()).safe) { stopped = "telemetry_not_safe_or_not_verified"; break; }
      if (hash(JSON.stringify(await options.readRoutingSnapshot())) !== baseline) {
        stopped = "production_configuration_changed"; break;
      }
      const controller = new AbortController();
      const abort = () => controller.abort();
      options.signal?.addEventListener("abort", abort, { once: true });
      const deadline = setTimeout(abort,
        Math.max(0, Math.min(expires - Date.now(), 600_000 - (performance.now() - started))));
      let unsafe = false, poll: Promise<void> | undefined;
      const timer = setInterval(() => {
        if (poll) return;
        poll = (async () => {
          try {
            if (Date.now() >= expires || !telemetryState(await options.monitor()).safe) {
              unsafe = true; controller.abort();
            }
          } catch { unsafe = true; controller.abort(); }
          finally { poll = undefined; }
        })();
      }, 1000);
      const first = client.observations.length, t0 = performance.now(), start = new Date().toISOString();
      let analysis: any;
      try { analysis = await client.analyze(row.content, row.subject, controller.signal); }
      catch { analysis = { status: "failed", code: "isolated_analysis_failed" }; }
      finally {
        clearInterval(timer); clearTimeout(deadline); await poll; options.signal?.removeEventListener("abort", abort);
        try { if (!telemetryState(await options.monitor()).safe) unsafe = true; }
        catch { unsafe = true; }
      }
      const evaluation = evaluateRegression(row.id, analysis);
      const result = { id: row.id, inputSha256: hash(JSON.stringify({ subject: row.subject, content: row.content })),
        startedAt: start, endedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - t0),
        http: client.observations.slice(first), analysis, evaluation, businessEffects: 0,
        noteLanguageReview: "NOT_REVIEWED" };
      results.push(result); await options.onCase(result);
      if (hash(JSON.stringify(await options.readRoutingSnapshot())) !== baseline) {
        stopped = "production_configuration_changed"; break;
      }
      if (unsafe || options.signal?.aborted || analysis?.status === "failed" || !analysis) {
        stopped = unsafe ? "telemetry_stop" : "technical_failure_upstream_completion_not_confirmed"; break;
      }
      if (evaluation.mismatches.some(key => ["wantsConsent", "wantsToCancel"].includes(key))) {
        stopped = "critical_reference_mismatch"; break;
      }
      if (results.length < regressionCases.length) await wait(1000);
    }
    return { outcome: "REVIEW_REQUIRED", completedCases: results.length, expectedCases: 18,
      notExecuted: regressionCases.slice(results.length).map(row => row.id), stopped,
      inferenceAttempts: client.attempts(), businessEffects: 0, phaseBAllowed: false,
      productionActivationAllowed: false, productionImpact: "REQUIRES_TELEMETRY_AND_OPERATOR_REVIEW" };
  } finally { client.disarm(); }
}
