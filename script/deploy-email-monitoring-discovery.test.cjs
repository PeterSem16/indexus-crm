"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), cp = require("node:child_process");
const deploy = require("./deploy-email-monitoring-discovery.cjs");
function routing() {
  return { state: { version: 6, value: { gateway: {
    enabled: true, baseURL: "https://ai.cordbloodcenter.com/gateway/", timeoutMs: 30000,
    maxRetries: 0, temperature: null, maxTokens: null,
  }, routes: {} } }, auditCount: 12 };
}
test("deployment holds enabled Gateway, 65 default routes and every shared parameter unchanged", () => {
  deploy.assertRouting(routing());
  for (const key of ["enabled", "baseURL", "timeoutMs", "maxRetries", "temperature", "maxTokens"]) {
    const snapshot = routing(); snapshot.state.value.gateway[key] = "changed";
    assert.throws(() => deploy.assertRouting(snapshot), /ROUTING_HOLD_CHANGED/);
  }
  const snapshot = routing();
  snapshot.state.value.routes["email.monitoring"] = { provider: "internal" };
  assert.throws(() => deploy.assertRouting(snapshot), /ROUTING_HOLD_CHANGED/);
});
test("the selective release allows only the two backend sources, their test and the shared deployment helper", () => {
  deploy.releasePaths([...deploy.FILES].reverse());
  assert.equal(deploy.FILES.length, 4);
  for (const extra of ["client/src/pages/email-client.tsx", "server/routes.ts", ".env", "package.json"])
    assert.throws(() => deploy.releasePaths([...deploy.FILES, extra]), /UNREVIEWED_RELEASE_PATHS/);
  assert.throws(() => deploy.releasePaths(deploy.FILES.slice(1)), /UNREVIEWED_RELEASE_PATHS/);
});
test("the new profile captures current runtime bytes and never falsely reports Gateway off", () => {
  const seen = [];
  const profile = deploy.profile(file => { seen.push(file); return { hash: file.endsWith(".cjs") ? "a".repeat(64) : "b".repeat(64) }; });
  assert.equal(profile.BASE, deploy.BASE);
  assert.equal(profile.TARGET, deploy.TARGET);
  assert.equal(profile.OLD_BACKEND, "a".repeat(64));
  assert.equal(profile.OLD_INDEX, "b".repeat(64));
  assert.equal(seen.length, 2);
  assert.equal(profile.resultOverrides.gatewayEnabled, true);
  assert.equal(profile.resultOverrides.productionActivation, "NOT_PERFORMED");
  assert.equal(profile.resultOverrides.emailModelInferenceCalls, 0);
});
test("real operator entry rejects the wrong host/user before reading production files", () => {
  const result = cp.spawnSync(process.execPath, [path.join(__dirname, "deploy-email-monitoring-discovery.cjs"),
    "--apply", deploy.TARGET, "--allow-restart"], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /B112_DISCOVERY_DEPLOY_REFUSED_NO_OPERATION/);
});
test("wrapper has no inference, package installation, environment mutation or DB rewrite", () => {
  const source = fs.readFileSync(path.join(__dirname, "deploy-email-monitoring-discovery.cjs"), "utf8");
  assert.doesNotMatch(source, /fetch\(|\.query\(|pg_restore|db:push|--update-env|execSync\(/);
});
