// Explicit development-only PostgreSQL test. Every row is in a temporary clone
// dropped with this transaction; never invoke this against CORPCRM01.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { emailMetadata } from "../../shared/schema";
import * as record from "./email-monitoring-record";
if (process.env.NODE_ENV !== "test" || process.env.EMAIL_MONITORING_TEMP_DB_TEST !== "1")
  throw Error("EXPLICIT_DEVELOPMENT_TEMP_TABLE_TEST_REQUIRED");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 8000 });
const require = createRequire(import.meta.url);
const scope: record.EmailMonitoringScope = { externalId: "SYNTHETIC-UNLINKED", mailbox: "agent@example.test",
  kind: "personal", ownerUserId: "SYNTHETIC-OWNER" };
const analysis = { sentiment: "neutral" as const, hasInappropriateContent: false, hasAngryTone: false,
  hasRudeExpressions: false, wantsToCancel: false, wantsConsent: false, doesNotAcceptContract: true,
  alertLevel: "none" as const, note: "Zákazník odmieta ponuku, existujúcu službu ponecháva." };
try {
  await drizzle(pool).transaction(async tx => {
    await tx.execute(sql`SET LOCAL statement_timeout = '8000'`);
    await tx.execute(sql`CREATE TEMP TABLE email_metadata (LIKE public.email_metadata INCLUDING DEFAULTS) ON COMMIT DROP`);
    await tx.execute(sql`ALTER TABLE pg_temp.email_metadata ADD COLUMN IF NOT EXISTS email_monitoring_result jsonb`);
    const module = { exports: {} as any };
    vm.runInNewContext(ts.transpile(fs.readFileSync("server/lib/email-monitoring-store.ts", "utf8"),
      { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }),
    { exports: module.exports, module, require: (name: string) => {
      if (name === "../db") return { db: tx };
      if (name === "../../shared/schema") return { emailMetadata };
      if (name === "./email-monitoring-record") return record;
      return require(name);
    } });
    const repository = module.exports;
    await tx.insert(emailMetadata).values({ messageId: scope.externalId, mailboxEmail: scope.mailbox,
      customerId: null, aiAnalysisNote: "SYNTHETIC LEGACY SENTIMENT", tags: ["SYNTHETIC-TAG"] });
    assert.equal(await repository.loadStoredEmailMonitoring(scope), null);
    const first = await repository.saveStoredEmailMonitoring(scope, analysis);
    assert.equal(first.created, true);
    assert.equal((await repository.loadStoredEmailMonitoring(scope)).analysis.note, analysis.note);
    const [legacy] = await tx.select().from(emailMetadata);
    assert.equal(legacy.customerId, null);
    assert.equal(legacy.aiAnalysisNote, "SYNTHETIC LEGACY SENTIMENT");
    assert.deepEqual(legacy.tags, ["SYNTHETIC-TAG"]);
    assert.equal((await repository.saveStoredEmailMonitoring(scope, { ...analysis, note: "Must not replace." })).created, false);
    assert.equal((await repository.loadStoredEmailMonitoring(scope)).analysis.note, analysis.note);
    const foreign = { ...scope, ownerUserId: "OTHER-OWNER" };
    assert.equal(await repository.loadStoredEmailMonitoring(foreign), null);
    await assert.rejects(repository.saveStoredEmailMonitoring(foreign, analysis), /owner_conflict/);
    const fresh = { ...scope, externalId: "SYNTHETIC-NEW" };
    assert.equal((await repository.saveStoredEmailMonitoring(fresh, analysis)).created, true);
    assert.equal((await repository.loadStoredEmailMonitoring(fresh)).analysis.note, analysis.note);
    await tx.insert(emailMetadata).values({ messageId: fresh.externalId, mailboxEmail: fresh.mailbox });
    await assert.rejects(repository.loadStoredEmailMonitoring(fresh), /ambiguous/);
    console.log("PASS: real PostgreSQL unlinked insert/update, exact note, no overwrite, mailbox owner guard and duplicate rejection.");
  });
} finally { await pool.end(); }
