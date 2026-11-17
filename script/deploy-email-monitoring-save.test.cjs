"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), cp = require("node:child_process");
const deploy = require("./deploy-email-monitoring-save.cjs");
const syntheticConnection = "postgresql://synthetic_owner:synthetic_password@db.example.test:6432/synthetic_database";
test("private DB backup precedes promotion and never passes credentials as arguments", async () => {
  const calls = [];
  await deploy.beforePromotion({ privateRoot: "/private/stage", connectionString: syntheticConnection, backupSafety: async () => {},
    run: (bin, args, options) => { calls.push({ bin, args, options }); return "1; TABLE DATA public email_metadata owner"; } });
  assert.deepEqual(calls.map(c => c.bin), ["pg_dump", "pg_restore"]);
  assert.equal(calls[0].options.env.PGDATABASE, "synthetic_database");
  assert.equal(calls[0].options.env.PGUSER, "synthetic_owner");
  assert.equal(calls[0].options.env.PGHOST, "db.example.test");
  assert.equal(calls[0].options.env.PGPORT, "6432");
  assert.equal(calls[0].options.env.PGPASSWORD, "synthetic_password");
  assert.equal(JSON.stringify(calls.map(c => c.args)).includes("synthetic_password"), false);
  assert.equal(calls[1].args[0], "--list");
});
test("failed dump or invalid archive blocks promotion rather than skipping the backup", async () => {
  await assert.rejects(deploy.beforePromotion({ privateRoot: "/private", connectionString: syntheticConnection, backupSafety: async () => {},
    run: () => { throw Error("SYNTHETIC_DUMP_FAILURE"); } }), /DUMP_FAILURE/);
  await assert.rejects(deploy.beforePromotion({ privateRoot: "/private", connectionString: syntheticConnection, backupSafety: async () => {},
    run: () => "" }), /BACKUP_NOT_VALIDATED/);
});
test("insufficient backup space stops before invoking dump or promotion", async () => {
  let calls = 0;
  await assert.rejects(deploy.beforePromotion({ privateRoot: "/private", connectionString: syntheticConnection,
    backupSafety: async () => { throw Error("B112_DATABASE_BACKUP_DISK_LOW"); },
    run: () => { calls++; } }), /BACKUP_DISK_LOW/);
  assert.equal(calls, 0);
});
test("native child receives an explicit DB role and plain database name, never OS-user defaults or an unexpanded URI", () => {
  const env = deploy.nativeDumpEnvironment(syntheticConnection);
  const result = cp.spawnSync(process.execPath, ["-e",
    'console.log(JSON.stringify({host:process.env.PGHOST,user:process.env.PGUSER,port:process.env.PGPORT,database:process.env.PGDATABASE}))'],
    { env, encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { host: "db.example.test", user: "synthetic_owner",
    port: "6432", database: "synthetic_database" });
});
test("encoded credentials, IPv6 and explicit TLS connection settings are preserved", () => {
  const env = deploy.nativeDumpEnvironment(
    "postgresql://agent%40test:p%40ss%3A%2F%25%20word@[::1]:5433/db%20name?sslmode=verify-full&sslrootcert=%2Fprivate%2Fca.pem&options=-c%20search_path%3Dpublic");
  assert.equal(env.PGHOST, "::1"); assert.equal(env.PGPORT, "5433");
  assert.equal(env.PGUSER, "agent@test"); assert.equal(env.PGPASSWORD, "p@ss:/% word");
  assert.equal(env.PGDATABASE, "db name"); assert.equal(env.PGSSLMODE, "verify-full");
  assert.equal(env.PGSSLROOTCERT, "/private/ca.pem");
  assert.equal(env.PGOPTIONS, "-c search_path=public");
  assert.equal(deploy.nativeDumpEnvironment("postgresql:///db?host=%2Fvar%2Frun%2Fpostgresql&user=agent").PGHOST,
    "/var/run/postgresql");
});
test("missing identity, ambiguous options and unsupported connection forms fail before any dump without leaking the URI", async () => {
  for (const uri of ["postgresql://localhost/db", "postgresql://owner@localhost",
    "postgresql://owner@localhost/db?sslmode=invalid", "postgresql://owner@localhost/db?host=a&host=b",
    "postgresql://owner@localhost/db?ssl=invalid", "postgresql://owner@localhost/db?user=another",
    "postgresql://owner:SYNTHETIC_SECRET@localhost/db?unknown=1", "not a connection"]) {
    assert.throws(() => deploy.nativeDumpEnvironment(uri), error =>
      error.message === "B112_NATIVE_DATABASE_CONFIGURATION_INVALID");
  }
  let calls = 0;
  await assert.rejects(deploy.beforePromotion({ privateRoot: "/private", connectionString: "invalid",
    backupSafety: async () => { calls++; }, run: () => { calls++; } }), /CONFIGURATION_INVALID/);
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
