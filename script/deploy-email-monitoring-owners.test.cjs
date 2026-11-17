"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), cp = require("node:child_process");
const owner = require("./deploy-email-monitoring-owners.cjs");
const originalBackup = require("./deploy-email-monitoring-save.cjs");
const held = () => ({ state: { version: 8, value: {
  gateway: { enabled: true, baseURL: "https://ai.cordbloodcenter.com/gateway/", timeoutMs: 30000,
    maxRetries: 0, temperature: null, maxTokens: null },
  routes: { "email.monitoring": { provider: "internal", model: "indexus-email-monitoring:v1", enabled: true } },
} }, auditCount: 10 });
test("owner release pins the observed live code and leaves the single internal route intact", () => {
  owner.assertRouting(held());
  for (const alter of [
    x => { x.state.value.routes = {}; },
    x => { x.state.value.routes["email.monitoring"].provider = "openai"; },
    x => { x.state.value.routes["email.summary"] = { provider: "internal", enabled: true }; },
    x => { x.state.value.gateway.timeoutMs = 120000; },
  ]) { const state = held(); alter(state); assert.throws(() => owner.assertRouting(state), /ROUTING_CHANGED/); }
  const p = owner.profile();
  assert.equal(p.beforePromotion, originalBackup.beforePromotion);
  assert.equal(p.frontend, false);
  assert.equal(p.OLD_BACKEND, "b688de5bca6586ad4f365a8b73badbb1851d2562f392a64c2c8fcdafe8694288");
  assert.equal(p.resultOverrides.internalServices, 1); assert.equal(p.resultOverrides.openaiServices, 64);
  owner.releasePaths(owner.FILES);
  assert.throws(() => owner.releasePaths([...owner.FILES, "server/routes.ts"]), /UNREVIEWED/);
});
test("post-restart readiness reads the actual owner table and both protection constraints", async () => {
  const calls = [];
  class Client {
    constructor(config) { assert.match(config.options, /default_transaction_read_only=on/); }
    async connect() {}
    async query(sql) {
      calls.push(sql); assert.match(sql, /^SELECT /);
      return { rows: [
        { contype: "u", definition: "UNIQUE (mailbox_email, message_id, owner_key)" },
        { contype: "f", definition: "FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE" },
      ] };
    }
    async end() {}
  }
  await owner.verifyDeployment({ connectionString: "SYNTHETIC" }, Client);
  assert.equal(calls.length, 2);
  class Missing extends Client { async query() { return { rows: [] }; } }
  await assert.rejects(owner.verifyDeployment({ connectionString: "SYNTHETIC" }, Missing), /OWNER_TABLE_NOT_READY/);
});
test("real owner operator entry refuses the wrong host before any operation", () => {
  const out = cp.spawnSync(process.execPath, ["script/deploy-email-monitoring-owners.cjs", "--apply", owner.TARGET, "--allow-restart"], { encoding: "utf8" });
  assert.notEqual(out.status, 0); assert.equal(out.stdout, "");
  assert.match(out.stderr, /B112_OWNER_DEPLOY_REFUSED_NO_OPERATION/);
});
