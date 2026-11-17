"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), cp = require("node:child_process");
const deploy = require("./deploy-email-monitoring-save.cjs");
test("private DB backup precedes promotion and never passes credentials as arguments", async () => {
  const calls = [];
  await deploy.beforePromotion({ privateRoot: "/private/stage", connectionString: "SYNTHETIC_DB_URL", backupSafety: async () => {},
    run: (bin, args, options) => { calls.push({ bin, args, options }); return "1; TABLE DATA public email_metadata owner"; } });
  assert.deepEqual(calls.map(c => c.bin), ["pg_dump", "pg_restore"]);
  assert.equal(calls[0].options.env.PGDATABASE, "SYNTHETIC_DB_URL");
  assert.equal(JSON.stringify(calls.map(c => c.args)).includes("SYNTHETIC_DB_URL"), false);
  assert.equal(calls[1].args[0], "--list");
});
test("failed dump or invalid archive blocks promotion rather than skipping the backup", async () => {
  await assert.rejects(deploy.beforePromotion({ privateRoot: "/private", connectionString: "SYNTHETIC", backupSafety: async () => {},
    run: () => { throw Error("SYNTHETIC_DUMP_FAILURE"); } }), /DUMP_FAILURE/);
  await assert.rejects(deploy.beforePromotion({ privateRoot: "/private", connectionString: "SYNTHETIC", backupSafety: async () => {},
    run: () => "" }), /BACKUP_NOT_VALIDATED/);
});
test("insufficient backup space stops before invoking dump or promotion", async () => {
  let calls = 0;
  await assert.rejects(deploy.beforePromotion({ privateRoot: "/private", connectionString: "SYNTHETIC",
    backupSafety: async () => { throw Error("B112_DATABASE_BACKUP_DISK_LOW"); },
    run: () => { calls++; } }), /BACKUP_DISK_LOW/);
  assert.equal(calls, 0);
});
test("save release keeps all providers on OpenAI and pins the actually reported live build", () => {
  const p = deploy.profile();
  assert.equal(p.OLD_BACKEND, "cf3a3676a1306f6f524ddff8841d39416ec5edee8673339c7b58a6eb35310e22");
  assert.equal(p.resultOverrides.internalServices, 0);
  assert.equal(p.resultOverrides.historicalNotesRecovered, false);
  deploy.releasePaths(deploy.FILES);
  assert.throws(() => deploy.releasePaths([...deploy.FILES, "package.json"]), /UNREVIEWED/);
  assert.throws(() => deploy.assertRouting({ state: { version: 6, value: { routes: { "email.monitoring": {} } } } }), /HOLD_CHANGED/);
});
test("actual operator entry refuses to operate outside CORPCRM01", () => {
  const result = cp.spawnSync(process.execPath, ["script/deploy-email-monitoring-save.cjs", "--apply",
    deploy.TARGET, "--allow-restart"], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /B112_SAVE_DEPLOY_REFUSED_NO_OPERATION/);
});
