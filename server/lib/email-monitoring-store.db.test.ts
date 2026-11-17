// Development only. Real concurrent transactions use an isolated, synthetic
// schema, removed in finally. Never run against CORPCRM01.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import os from "node:os";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { createRequire } from "node:module";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, Client } from "pg";
import { sql } from "drizzle-orm";
import { emailMetadata, emailMonitoringOwnerResults } from "../../shared/schema";
import * as record from "./email-monitoring-record";
if (process.env.NODE_ENV !== "test" || process.env.EMAIL_MONITORING_TEMP_DB_TEST !== "1" ||
    os.hostname().split(".")[0].toUpperCase() === "CORPCRM01")
  throw Error("EXPLICIT_DEVELOPMENT_TEMP_TABLE_TEST_REQUIRED");
const schema = "email_monitor_owner_test_" + randomUUID().replace(/-/g, "");
const control = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 });
const require = createRequire(import.meta.url);
const scope: record.EmailMonitoringScope = { externalId: "SYNTHETIC-UNLINKED", mailbox: "agent@example.test",
  kind: "personal", ownerUserId: "SYNTHETIC-OWNER" };
const other = { ...scope, ownerUserId: "OTHER-OWNER" };
const analysis = { sentiment: "neutral" as const, hasInappropriateContent: false, hasAngryTone: false,
  hasRudeExpressions: false, wantsToCancel: false, wantsConsent: false, doesNotAcceptContract: true,
  alertLevel: "none" as const, note: "Zákazník odmieta ponuku, existujúcu službu ponecháva." };
const second = { ...analysis, note: "Odlišná súkromná analýza druhého používateľa." };
let created = false, pool: Pool | undefined;
try {
  await control.connect();
  await control.query(`CREATE SCHEMA "${schema}"`); created = true;
  await control.query(`SET search_path TO "${schema}",public`);
  await control.query("CREATE TABLE users(id varchar PRIMARY KEY)");
  await control.query("INSERT INTO users(id) VALUES('SYNTHETIC-OWNER'),('OTHER-OWNER'),('THIRD-OWNER')");
  await control.query("CREATE TABLE email_metadata (LIKE public.email_metadata INCLUDING DEFAULTS)");
  await control.query("ALTER TABLE email_metadata ADD COLUMN IF NOT EXISTS email_monitoring_result jsonb");
  // Execute the exact production startup DDL (including the real FK/unique key).
  const indexSource = fs.readFileSync("server/index.ts", "utf8");
  const ddl = indexSource.match(/await pool\.query\(`(CREATE TABLE IF NOT EXISTS email_monitoring_owner_results[\s\S]*?)`\);/)?.[1];
  assert.ok(ddl); await control.query(ddl);
  pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 8000,
    options: `-c search_path=${schema},public -c statement_timeout=8000` });
  const db = drizzle(pool), module = { exports: {} as any };
  vm.runInNewContext(ts.transpile(fs.readFileSync("server/lib/email-monitoring-store.ts", "utf8"),
    { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }),
  { exports: module.exports, module, require: (name: string) => {
    if (name === "../db") return { db };
    if (name === "../../shared/schema") return { emailMetadata, emailMonitoringOwnerResults };
    if (name === "./email-monitoring-record") return record;
    return require(name);
  } });
  const repository = module.exports;
  await db.insert(emailMetadata).values({ messageId: scope.externalId, mailboxEmail: scope.mailbox,
    customerId: null, aiAnalysisNote: "SYNTHETIC LEGACY SENTIMENT", tags: ["SYNTHETIC-TAG"] });
  assert.equal(await repository.loadStoredEmailMonitoring(scope), null);
  assert.equal((await repository.saveStoredEmailMonitoring(scope, analysis)).created, true);
  assert.equal((await repository.loadStoredEmailMonitoring(scope)).analysis.note, analysis.note);
  assert.equal((await repository.saveStoredEmailMonitoring(scope, second)).created, false);
  const [legacy] = await db.select().from(emailMetadata);
  assert.equal(legacy.customerId, null); assert.equal(legacy.emailMonitoringResult, null);
  assert.equal(legacy.aiAnalysisNote, "SYNTHETIC LEGACY SENTIMENT");
  assert.deepEqual(legacy.tags, ["SYNTHETIC-TAG"]);

  assert.equal(await repository.loadStoredEmailMonitoring(other), null);
  assert.equal((await repository.saveStoredEmailMonitoring(other, second)).created, true);
  assert.equal((await repository.loadStoredEmailMonitoring(other)).analysis.note, second.note);
  assert.equal((await repository.loadStoredEmailMonitoring(scope)).analysis.note, analysis.note);
  const system = { ...scope, kind: "system", ownerUserId: null };
  assert.equal(await repository.loadStoredEmailMonitoring(system), null);
  await repository.saveStoredEmailMonitoring(system, { ...analysis, note: "Samostatný systémový výsledok." });
  assert.equal((await repository.loadStoredEmailMonitoring(scope)).analysis.note, analysis.note);

  const historical = { ...scope, externalId: "SYNTHETIC-HISTORICAL" };
  const originalSnapshot = record.monitoringSnapshot(historical, analysis);
  await db.insert(emailMetadata).values({ messageId: historical.externalId, mailboxEmail: scope.mailbox,
    emailMonitoringResult: originalSnapshot, aiAnalysisNote: "SYNTHETIC LEGACY NOTE" });
  assert.equal((await repository.saveStoredEmailMonitoring(historical, second)).created, false);
  await repository.saveStoredEmailMonitoring({ ...historical, ownerUserId: other.ownerUserId }, second);
  const after = (await control.query("SELECT email_monitoring_result,ai_analysis_note FROM email_metadata WHERE message_id=$1",
    [historical.externalId])).rows[0];
  assert.deepEqual(after.email_monitoring_result, originalSnapshot);
  assert.equal(after.ai_analysis_note, "SYNTHETIC LEGACY NOTE");
  assert.equal((await repository.loadStoredEmailMonitoring(historical)).analysis.note, analysis.note);

  const concurrent = { ...scope, externalId: "SYNTHETIC-CONCURRENT" };
  await Promise.all([repository.saveStoredEmailMonitoring(concurrent, analysis),
    repository.saveStoredEmailMonitoring({ ...concurrent, ownerUserId: other.ownerUserId }, second)]);
  assert.equal((await repository.loadStoredEmailMonitoring(concurrent)).analysis.note, analysis.note);
  assert.equal((await repository.loadStoredEmailMonitoring({ ...concurrent, ownerUserId: other.ownerUserId })).analysis.note, second.note);
  const same = { ...scope, externalId: "SYNTHETIC-SAME-OWNER" };
  const raced = await Promise.all(Array.from({ length: 4 }, () => repository.saveStoredEmailMonitoring(same, analysis)));
  assert.equal(raced.filter(r => r.created).length, 1);
  const anotherMailbox = { ...concurrent, mailbox: "another@example.test" };
  assert.equal(await repository.loadStoredEmailMonitoring(anotherMailbox), null);
  await repository.saveStoredEmailMonitoring(anotherMailbox, second);
  assert.equal((await repository.loadStoredEmailMonitoring(concurrent)).analysis.note, analysis.note);

  const corrupt = { ...scope, externalId: "SYNTHETIC-CORRUPT-SCOPE" };
  await db.insert(emailMonitoringOwnerResults).values({ messageId: corrupt.externalId, mailboxEmail: corrupt.mailbox,
    ownerKey: record.monitoringOwnerKey(corrupt), ownerUserId: scope.ownerUserId,
    result: record.monitoringSnapshot({ ...corrupt, ownerUserId: other.ownerUserId }, second) });
  await assert.rejects(repository.loadStoredEmailMonitoring(corrupt), /scope_mismatch/);
  await db.insert(emailMetadata).values([{ messageId: "SYNTHETIC-DUP", mailboxEmail: scope.mailbox },
    { messageId: "SYNTHETIC-DUP", mailboxEmail: scope.mailbox }]);
  await assert.rejects(repository.loadStoredEmailMonitoring({ ...scope, externalId: "SYNTHETIC-DUP" }), /ambiguous/);
  await control.query("DELETE FROM users WHERE id='OTHER-OWNER'");
  assert.equal((await control.query("SELECT count(*)::int AS n FROM email_monitoring_owner_results WHERE owner_user_id='OTHER-OWNER'")).rows[0].n, 0);
  console.log("PASS: real PostgreSQL two-owner isolation, unchanged legacy results, system/mailbox separation, concurrent inserts, same-owner idempotence, scope rejection, duplicate rejection and user-deletion cascade.");
} finally {
  await pool?.end();
  if (created) await control.query(`DROP SCHEMA "${schema}" CASCADE`);
  await control.end();
}
