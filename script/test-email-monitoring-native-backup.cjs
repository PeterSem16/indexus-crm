"use strict";
// Explicit development-only native libpq check. Dumps schema for one table,
// never customer rows, and never runs on CORPCRM01.
const cp = require("node:child_process"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { nativeDumpEnvironment } = require("./deploy-email-monitoring-save.cjs");
if (process.env.NODE_ENV !== "test" || process.env.EMAIL_MONITORING_NATIVE_DEV_TEST !== "1" ||
    os.hostname().split(".")[0].toUpperCase() === "CORPCRM01")
  throw Error("NATIVE_EXPLICIT_DEVELOPMENT_CHECK_REQUIRED");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "indexus-native-dump-test-"));
try {
  const env = nativeDumpEnvironment(process.env.DATABASE_URL);
  env.PGOPTIONS = (env.PGOPTIONS ? env.PGOPTIONS + " " : "") +
    "-c default_transaction_read_only=on -c statement_timeout=8000";
  function run(binary, args) {
    const result = cp.spawnSync(binary, args, { env, encoding: "utf8", timeout: 30000 });
    if (result.error || result.status !== 0) throw Error("NATIVE_" + binary.toUpperCase() + "_CHECK_FAILED");
    return result.stdout;
  }
  const answer = run("psql", ["-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c",
    "SELECT current_setting('transaction_read_only') = 'on' AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='email_metadata')"]);
  if (answer.trim() !== "t") throw Error("NATIVE_READ_ONLY_TARGET_CHECK_FAILED");
  const file = path.join(dir, "metadata-schema-only.dump");
  run("pg_dump", ["--format=custom", "--schema-only", "--no-owner", "--no-privileges",
    "--table=public.email_metadata", "--file", file]);
  const listing = run("pg_restore", ["--list", file]);
  if (!/TABLE public email_metadata\s/.test(listing) || /TABLE DATA public email_metadata\s/.test(listing))
    throw Error("NATIVE_SCHEMA_ONLY_ARCHIVE_CHECK_FAILED");
  console.log("PASS: native psql authenticated read-only; real schema-only pg_dump archive validated by pg_restore. No CRM rows or production calls.");
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
