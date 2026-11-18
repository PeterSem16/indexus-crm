import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { configurationSnapshot, readCurrentSnapshot, hash,
  reserveKnownPreInferenceRecovery, safeFailureCode } from "./run-safety";
import { DEFAULT_AI_SETTINGS } from "../../server/lib/ai/settings-policy";
import { EMAIL_MONITORING_MODEL } from "../../shared/ai-settings";
import { EMAIL_SENTIMENT_PROFILE } from "../../server/lib/ai/email-sentiment-profile";
import { createInternalAIAdapter } from "../../server/lib/ai/internal-adapter";
import { runAcceptance } from "./run";

const row = () => ({ version: 7, value: {
  gateway: { ...DEFAULT_AI_SETTINGS.gateway, enabled: true },
  routes: {
    "email.monitoring": { provider: "internal", enabled: true, model: EMAIL_MONITORING_MODEL },
    "email.sentiment": { provider: "internal", enabled: true, model: EMAIL_SENTIMENT_PROFILE.model },
  },
} });
test("active monitoring and sentiment remain internal; the three targets remain OpenAI", () => {
  const before = row(), bytes = JSON.stringify(before);
  const snapshot = configurationSnapshot(before);
  assert.equal(snapshot.gatewayEnabled, true);
  assert.equal(snapshot.internal, 2);
  assert.equal(snapshot.openai, snapshot.total - 2);
  assert.equal(JSON.stringify(before), bytes);
  assert.equal(JSON.stringify(snapshot).includes(EMAIL_MONITORING_MODEL), false);
  assert.equal(configurationSnapshot(row()).fullConfigurationSha256, snapshot.fullConfigurationSha256);
});
test("snapshot hashes sparse representation and every other route without rewriting configuration", () => {
  const before = configurationSnapshot(row()), after = row();
  after.value.routes["email.monitoring"].enabled = false;
  assert.notEqual(configurationSnapshot(after).fullConfigurationSha256, before.fullConfigurationSha256);
  const disabled = row(); disabled.value.gateway.enabled = false;
  assert.equal(configurationSnapshot(disabled).gatewayEnabled, false);
  assert.notEqual(configurationSnapshot(disabled).fullConfigurationSha256, before.fullConfigurationSha256);
  const bad: any = row();
  bad.value.routes["task.checklist"] = { provider: "internal", enabled: true, model: "indexus-task-checklist:v1" };
  assert.throws(() => configurationSnapshot(bad), /THREE_TARGET_MUST_REMAIN_OPENAI/);
});
test("real snapshot reader only opens read-only transactions and accepts active monitoring", async () => {
  const statements: string[] = [];
  let config: any, ended = false;
  class FakeClient {
    constructor(options: any) { config = options; }
    async connect() {}
    async query(sql: string) {
      statements.push(sql);
      if (sql.startsWith("SHOW")) return { rows: [{ transaction_read_only: "on" }] };
      return { rows: sql.startsWith("SELECT") ? [row()] : [] };
    }
    async end() { ended = true; }
  }
  const snapshot = await readCurrentSnapshot("SYNTHETIC_NOT_A_REAL_CONNECTION", FakeClient as any);
  assert.equal(snapshot.internal, 2);
  assert.ok(config.options.includes("default_transaction_read_only=on"));
  assert.deepEqual(statements, ["BEGIN READ ONLY", "SHOW transaction_read_only",
    "SELECT version,value FROM ai_router_configuration WHERE singleton=true", "ROLLBACK"]);
  assert.equal(ended, true);
});
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "three-recovery-test-"));
  const app = path.join(dir, "app"), work = path.join(dir, "private-work");
  fs.mkdirSync(path.join(app, "data"), { recursive: true });
  fs.mkdirSync(path.join(work, "source/script/ai-three-services"), { recursive: true, mode: 0o700 });
  const output = path.join(work, "three-services-evidence.json");
  const marker = path.join(app, "data/internal-ai-three-services-81.started");
  fs.writeFileSync(output, "", { mode: 0o600 });
  const markerBytes = JSON.stringify({ startedAt: "2026-11-18T10:00:00Z", output });
  fs.writeFileSync(marker, markerBytes, { mode: 0o600 });
  const original = path.join(work, "source/script/ai-three-services/run.ts");
  fs.writeFileSync(original, "SYNTHETIC_ORIGINAL_RUNNER");
  const expected = { "run.ts": hash("SYNTHETIC_ORIGINAL_RUNNER") };
  return { dir, app, output, marker, markerBytes, original, expected,
    recover: () => reserveKnownPreInferenceRecovery(app, output, process.getuid!(), expected),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
test("proven zero-byte recovery preserves original marker/evidence and is atomically single-use", () => {
  const f = fixture();
  try {
    const receipt = f.recover();
    assert.equal(receipt.priorInferenceAttempts, 0);
    assert.equal(fs.readFileSync(f.marker, "utf8"), f.markerBytes);
    assert.equal(fs.statSync(f.output + ".empty-before-recovery").size, 0);
    assert.equal(fs.statSync(f.output).size, 0);
    assert.throws(() => f.recover(), (e: any) => e.code === "EEXIST");
    assert.equal(fs.readFileSync(f.marker, "utf8"), f.markerBytes);
  } finally { f.cleanup(); }
});
for (const scenario of ["nonempty", "pending", "wrong_output", "changed_source", "symlink", "public_file", "unknown_original"] as const)
  test(`recovery rejects ${scenario} without deleting the original marker`, () => {
    const f = fixture();
    try {
      if (scenario === "nonempty") fs.writeFileSync(f.output, '{"results":[{"attempted":true}]}');
      if (scenario === "pending") fs.writeFileSync(f.output + ".pending", "uncertain");
      if (scenario === "wrong_output") fs.writeFileSync(f.marker,
        JSON.stringify({ startedAt: "x", output: "/different/report.json" }));
      if (scenario === "changed_source") fs.appendFileSync(f.original, "changed");
      if (scenario === "symlink") {
        fs.renameSync(f.output, f.output + ".real"); fs.symlinkSync(f.output + ".real", f.output);
      }
      if (scenario === "public_file") fs.chmodSync(f.output, 0o644);
      const marker = fs.readFileSync(f.marker);
      assert.throws(() => scenario === "unknown_original"
        ? reserveKnownPreInferenceRecovery(f.app, f.output, process.getuid!()) : f.recover());
      assert.deepEqual(fs.readFileSync(f.marker), marker);
      assert.equal(fs.existsSync(f.marker + ".recovery-started"), false);
    } finally { f.cleanup(); }
  });
test("a failed initial snapshot is recorded before any model request, with a specific safe code", async () => {
  let requests = 0, last: any;
  const report = await runAcceptance({
    root: process.cwd(),
    adapter: createInternalAIAdapter({ fetch: (async () => { requests++; throw Error("NEVER"); }) as typeof fetch }),
    readSnapshot: async () => { throw Error("THREE_CONFIGURATION_UNAVAILABLE"); },
    save: value => { last = structuredClone(value); },
  });
  assert.equal(requests, 0);
  assert.equal(report.results.length, 0);
  assert.equal(last.blocker, "THREE_CONFIGURATION_UNAVAILABLE");
  assert.equal(last.verdict, "NOT_READY");
  assert.equal(last.productionUnchanged, false);
});
test("safe diagnostics expose known SQL/filesystem codes but never arbitrary messages or credential text", () => {
  assert.equal(safeFailureCode(Error("B4_GATEWAY_MUST_BE_OFF")), "B4_GATEWAY_MUST_BE_OFF");
  assert.equal(safeFailureCode({ code: "28P01", message: "SYNTHETIC_SECRET" }), "28P01");
  assert.equal(safeFailureCode({ message: "postgres://SYNTHETIC_SECRET", code: "SYNTHETIC_SECRET" }),
    "THREE_UNCLASSIFIED_STARTUP_FAILURE");
});
