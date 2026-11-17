import test from "node:test";
import assert from "node:assert/strict";
import { createGatewayPilot } from "./gateway-client";
import { regressionCases } from "./regression-corpus";
import { runOneShot, main, RUN_FLAG, RISK_FLAG, EXPECTED_REVISION } from "./one-shot";
import { GATEWAY_URL } from "../../server/lib/ai/settings-policy";
import { EMAIL_MONITORING_PROFILE } from "../../server/lib/ai/email-monitoring-profile";
import { AI_ROUTING_OVERRIDES } from "../../server/config/ai-routing";

const token = "SYNTHETIC_ONE_SHOT_NOT_A_CREDENTIAL";
function fixture(options: { failure?: number; revision?: string; mismatch?: boolean; stall?: boolean } = {}) {
  const calls: { url: string; method: string }[] = [];
  let active = 0, peak = 0;
  const client = createGatewayPilot({
    readConfiguration: () => ({ enabled: true, production: true, replit: false, baseURL: GATEWAY_URL, token }),
    fetch: async (input, init) => {
      const url = String(input);
      assert.ok(url.startsWith(GATEWAY_URL));
      assert.equal(init?.redirect, "error");
      assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${token}`);
      calls.push({ url, method: init?.method ?? "GET" });
      if (url.endsWith("/health/ready")) return new Response(null, { status: 200 });
      if (url.endsWith("/v1/models")) return Response.json({ object: "list",
        data: [{ id: "indexus-email-sentiment:4b" }] });
      if (url.endsWith("/indexus/v1/capabilities")) return Response.json({ apiVersion: "1", models: [{
        id: "indexus-email-sentiment:4b", revision: options.revision ?? EXPECTED_REVISION,
        operations: ["chat.completions"], inputModalities: ["text"], outputFormats: ["json_object"],
        streaming: false,
      }] });
      assert.ok(url.endsWith("/v1/chat/completions"));
      assert.equal(init?.method, "POST");
      active++; peak = Math.max(peak, active);
      try {
        if (options.stall) await new Promise((_resolve, reject) => {
          const stop = () => reject(new Error(token));
          if (init?.signal?.aborted) stop(); else init?.signal?.addEventListener("abort", stop, { once: true });
        });
        if (options.failure) return Response.json({ request_id: "synthetic-gateway-42",
          error: { message: token } }, { status: options.failure });
        const body = JSON.parse(String(init?.body));
        const row = regressionCases.find(x => body.messages.at(-1).content.endsWith(`Content: ${x.content}`));
        assert.ok(row);
        if (row.id === "K12") return Response.json({
          error: { code: "review_required", type: "review_required" },
        }, { status: 422 });
        return Response.json({ id: "synthetic", object: "chat.completion", model: "indexus-email-sentiment:4b",
          choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant",
            content: JSON.stringify({ sentiment: "neutral", hasInappropriateContent: false,
              hasAngryTone: false, hasRudeExpressions: false, wantsToCancel: false,
              wantsConsent: false, doesNotAcceptContract: false, alertLevel: "none",
              note: "Syntetická slovenská poznámka. ".repeat(5), ...row.expected,
              ...(options.mismatch ? { wantsConsent: true } : {}) }),
          } }] });
      } finally { active--; }
    },
  });
  return { client, calls, peak: () => peak };
}
const base = () => ({ authorized: true, acknowledgeUnverifiedImpact: true,
  wait: async (_ms: number) => {} });

test("operator CLI cannot run from Replit or without both explicit acknowledgements", async () => {
  await assert.rejects(main([]), /explicit_flags/);
  await assert.rejects(main([RUN_FLAG, RISK_FLAG, "/tmp"]), /verified_CORPCRM01_runtime_required/);
});
test("no acknowledgement means zero network calls", async () => {
  for (const key of ["authorized", "acknowledgeUnverifiedImpact"] as const) {
    const f = fixture();
    await assert.rejects(runOneShot({ ...base(), [key]: false, client: f.client, write() {} }), /acknowledgement/);
    assert.equal(f.calls.length, 0);
  }
});
test("one-shot uses all original 18 inputs sequentially; manual review and production impact stay explicit", async () => {
  const f = fixture(), rows: any[] = [];
  const before = JSON.stringify({ EMAIL_MONITORING_PROFILE, AI_ROUTING_OVERRIDES });
  const summary = await runOneShot({ ...base(), client: f.client, write: row => rows.push(row) });
  assert.equal(summary.evaluatedCases, 18);
  assert.equal(summary.inferenceAttempts, 18);
  assert.equal(summary.failures, 0);
  assert.equal(summary.safeRejections, 1);
  assert.equal(summary.completeAndAccepted, false);
  assert.equal(summary.telemetry, "NOT_VERIFIED");
  assert.equal(summary.productionImpact, "NOT_VERIFIED");
  assert.equal(summary.productionActivationAllowed, false);
  assert.equal(summary.businessEffects, 0);
  assert.equal(f.peak(), 1);
  const cases = rows.filter(x => x.kind === "case");
  assert.deepEqual(cases.map(x => x.id), regressionCases.map(x => x.id));
  assert.ok(cases.every(x => x.noteLanguageReview === "PENDING_HUMAN_REVIEW"));
  assert.ok(cases[0].analysis.note.length > 100);
  assert.ok(!JSON.stringify(rows).includes(token));
  assert.equal(JSON.stringify({ EMAIL_MONITORING_PROFILE, AI_ROUTING_OVERRIDES }), before);
  await assert.rejects(f.client.analyze("synthetic", "synthetic"), /inference_not_authorized/);
});
for (const status of [503, 504]) test(`HTTP ${status} stops after one attempt and preserves request ID`, async () => {
  const f = fixture({ failure: status }), rows: any[] = [];
  const summary = await runOneShot({ ...base(), client: f.client, write: row => rows.push(row) });
  assert.equal(summary.inferenceAttempts, 1);
  assert.equal(summary.missing.length, 17);
  assert.equal(summary.stopped, "technical_failure_no_retry");
  assert.deepEqual(rows.find(x => x.kind === "case").analysis, {
    status: "failed", code: "email_sentiment_unavailable",
    httpStatus: status, request_id: "synthetic-gateway-42",
  });
  assert.ok(!JSON.stringify(rows).includes(token));
});
test("model revision drift stops before inference", async () => {
  const f = fixture({ revision: "other-synthetic-revision" });
  const result = await runOneShot({ ...base(), client: f.client, write() {} });
  assert.equal(result.inferenceAttempts, 0);
  assert.equal(result.stopped, "model_revision_changed");
});
test("critical consent mismatch stops without retry or the next case", async () => {
  const f = fixture({ mismatch: true });
  const result = await runOneShot({ ...base(), client: f.client, write() {} });
  assert.equal(result.stopped, "critical_reference_mismatch");
  assert.equal(result.inferenceAttempts, 1);
});
test("Ctrl+C aborts an in-flight request and never starts the next input", async () => {
  const f = fixture({ stall: true }), controller = new AbortController();
  const timer = setInterval(() => {
    if (f.client.attempts()) controller.abort();
  }, 10);
  try {
    const result = await runOneShot({ ...base(), client: f.client, signal: controller.signal, write() {} });
    assert.equal(result.inferenceAttempts, 1);
    assert.equal(result.missing.length, 17);
  } finally { clearInterval(timer); }
});
