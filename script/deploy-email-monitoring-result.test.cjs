"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), cp = require("node:child_process");
const path = require("node:path"), fs = require("node:fs");
const deploy = require("./deploy-email-monitoring-result.cjs");
const routing = () => ({ state: { version: 6, value: { routes: {}, gateway: {
  enabled: true, baseURL: "https://ai.cordbloodcenter.com/gateway/", timeoutMs: 30000,
  maxRetries: 0, temperature: null, maxTokens: null,
} } }, auditCount: 8 });
test("operator release holds all 65 OpenAI routes and the exact shared Gateway settings", () => {
  deploy.assertRouting(routing());
  const changed = routing(); changed.state.value.routes["email.monitoring"] = { provider: "internal" };
  assert.throws(() => deploy.assertRouting(changed), /HOLD_CHANGED/);
  for (const key of Object.keys(routing().state.value.gateway)) {
    const row = routing(); row.state.value.gateway[key] = "changed";
    assert.throws(() => deploy.assertRouting(row), /HOLD_CHANGED/);
  }
});
test("exact selective release excludes unrelated source, schema and package changes", () => {
  deploy.releasePaths(deploy.FILES);
  assert.equal(deploy.FILES.length, 11);
  for (const extra of ["server/index.ts", "shared/schema.ts", "package.json", "server/lib/automation-analysis.ts"])
    assert.throws(() => deploy.releasePaths([...deploy.FILES, extra]), /UNREVIEWED_RELEASE_PATHS/);
});
test("profile pins the actually reported running build and does not claim unobserved runtime model calls", () => {
  const profile = deploy.profile();
  assert.equal(profile.frontend, true);
  assert.equal(profile.OLD_BACKEND, "e9bbc844e91d63a2b0a97e791ddc314343f6f00c57eea0fcb2e9ff0c7923020f");
  assert.equal(profile.OLD_INDEX, "75f64fb6b81cb7f58150f5ca19953348d527775b472613edfd1f1f11a17c7c4d");
  assert.equal(profile.resultOverrides.productionModelCalls, null);
  assert.equal(profile.resultOverrides.installerModelCalls, 0);
  assert.equal(profile.resultOverrides.productionActivation, "NOT_PERFORMED");
});
test("real file entry rejects the wrong host before any operation", () => {
  const result = cp.spawnSync(process.execPath, [path.join(__dirname, "deploy-email-monitoring-result.cjs"),
    "--apply", deploy.TARGET, "--allow-restart"], { encoding: "utf8" });
  assert.notEqual(result.status, 0); assert.equal(result.stdout, "");
  assert.match(result.stderr, /B112_RESULT_DEPLOY_REFUSED_NO_OPERATION/);
});
test("wrapper cannot trigger an inference, route write, dependency install or database restore", () => {
  const source = fs.readFileSync(path.join(__dirname, "deploy-email-monitoring-result.cjs"), "utf8");
  assert.doesNotMatch(source, /fetch\(|\.query\(|pg_restore|db:push|--update-env|execSync\(/);
});
