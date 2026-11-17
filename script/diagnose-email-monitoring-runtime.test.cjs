"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), cp = require("node:child_process");
const { summarizeLogs } = require("./diagnose-email-monitoring-runtime.cjs");
test("only allowlisted monitoring telemetry leaves the diagnostic, never raw messages, secrets or other services", () => {
  const log = '[AI Router] ' + JSON.stringify({ event: "ai.request", service: "email.monitoring",
    provider: "internal", outcome: "error", model: "indexus-email-monitoring:v1", durationMs: 120010,
    httpStatus: 504, body: "SYNTHETIC_PRIVATE_BODY", token: "SYNTHETIC_SECRET" });
  const out = summarizeLogs(log + '\n[EmailMonitor] Personal monitoring result unavailable\n' +
    '[AI Router] {"event":"ai.request","service":"other","provider":"internal","outcome":"ok"}\nSYNTHETIC_PRIVATE_BODY');
  assert.deepEqual(out.requests, [{ provider: "internal", outcome: "error",
    model: "indexus-email-monitoring:v1", durationMs: 120010, httpStatus: 504 }]);
  assert.equal(out.counts.personalUnavailable, 1);
  assert.doesNotMatch(JSON.stringify(out), /SYNTHETIC|token|body/);
});
test("malformed lines are discarded, numeric fields are validated, history is bounded", () => {
  const row = '[AI Router] {"event":"ai.request","service":"email.monitoring","provider":"openai","outcome":"ok","model":"SYNTHETIC_SECRET","httpStatus":"SECRET","durationMs":"SECRET"}';
  const out = summarizeLogs("[AI Router] MALFORMED\n" + Array(25).fill(row).join("\n"));
  assert.equal(out.requests.length, 20);
  assert.deepEqual(out.requests[0], { provider: "openai", outcome: "ok", model: "other", durationMs: null, httpStatus: null });
});
test("actual operator entry refuses another host before reading app configuration", () => {
  const out = cp.spawnSync(process.execPath, ["script/diagnose-email-monitoring-runtime.cjs", "--read-only"], { encoding: "utf8" });
  assert.notEqual(out.status, 0); assert.equal(out.stdout, "");
  assert.equal(JSON.parse(out.stderr).configurationChanged, false);
});
test("operator uses read-only SQL, bounded logs and no inference, shell or PM2 commands", () => {
  const source = require("node:fs").readFileSync("script/diagnose-email-monitoring-runtime.cjs", "utf8");
  assert.match(source, /default_transaction_read_only=on/);
  assert.match(source, /statement_timeout=8000/);
  assert.match(source, /256 \* 1024/);
  assert.doesNotMatch(source, /execFileSync|spawnSync|fetch\(|writeFile|appendFile|\.query\("(?:UPDATE|INSERT|DELETE|ALTER|CREATE)/);
});
