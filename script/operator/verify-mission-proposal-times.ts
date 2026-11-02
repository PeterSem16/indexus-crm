#!/usr/bin/env node
// Execute only locally on CORPCRM01 after separate mailbox-read approval.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { decryptTokenSafe } from "../../server/lib/token-crypto";
const require = createRequire(import.meta.url);
// Operator copies may live in a private directory, outside the application.
// Resolve installed dependencies from the application without installing any.
const appRequire = createRequire(path.join(process.cwd(), "package.json"));
const core = require("./verify-mission-proposal-times.cjs");
const { inspectMailboxes } = require("./inspect-mission-proposal-mailboxes.cjs");
function stop(code: string): never {
  throw Object.assign(new Error(code), { safeCode: code });
}
function privateFile(filename: string) {
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) ||
      stat.uid !== process.getuid?.() || stat.size > 1024 * 1024) stop("PRIVATE_INPUT_REQUIRED");
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}
function writePrivate(filename: string, value: unknown) {
  // Dedicated operator-owned directory outside application public/static mounts.
  const parent = fs.realpathSync(path.dirname(filename));
  const stat = fs.statSync(parent);
  const relative = path.relative(fs.realpathSync(process.cwd()), parent);
  if ((stat.mode & 0o077) || stat.uid !== process.getuid?.() ||
      parent === path.parse(parent).root ||
      (!relative.startsWith(".." + path.sep) && relative !== ".."))
    stop("PRIVATE_OUTPUT_DIRECTORY_REQUIRED");
  fs.writeFileSync(path.join(parent, path.basename(filename)), JSON.stringify(value, null, 2) + "\n",
    { flag: "wx", mode: 0o600 });
}
export async function main(args: string[]) {
  const scopeCheck = args.length === 1 && args[0] === "--scope-check";
  const unassignedSnapshot = args.length === 2 && args[0] === "--snapshot-unassigned";
  const inspectUnassigned = args.length === 3 && args[0] === "--inspect-unassigned" &&
    args[1] === "--read-only-approved";
  if (!scopeCheck && !unassignedSnapshot && !inspectUnassigned &&
      (args.length !== 3 || !["--snapshot", "--verify"].includes(args[0])))
    stop("USE_SNAPSHOT_OR_VERIFY_PRIVATE_INPUT_PRIVATE_OUTPUT");
  const input = scopeCheck || unassignedSnapshot || inspectUnassigned ? null : privateFile(args[1]);
  if (args[0] === "--verify") core.validateApproval(input);
  const ids = scopeCheck || unassignedSnapshot || inspectUnassigned ? null : args[0] === "--snapshot"
    ? input.messageIds : input.entries.map((entry: any) => entry.messageId);
  // No source(), PM2 inspection, token output, refresh or OAuth writes.
  const { Pool } = appRequire("pg");
  const { parse } = appRequire("dotenv");
  const local = parse(fs.readFileSync(".env", "utf8"));
  const connectionString = process.env.DATABASE_URL || local.DATABASE_URL;
  if (!connectionString) stop("APPLICATION_DATABASE_NOT_CONFIGURED");
  if (!process.env.SESSION_SECRET && local.SESSION_SECRET) process.env.SESSION_SECRET = local.SESSION_SECRET;
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 10000, max: 1 });
  let client: any;
  try {
    client = await pool.connect();
    if (scopeCheck) {
      console.log(JSON.stringify(await core.inspectScope(client)));
      return;
    }
    const batch = unassignedSnapshot || inspectUnassigned || input?.sourceMode === "unassigned_batch"
      ? await core.loadUnassignedBatch(client) : null;
    const rows = batch?.rows ?? await core.loadSources(client, ids);
    if (args[0] === "--snapshot" || unassignedSnapshot) {
      writePrivate(unassignedSnapshot ? args[1] : args[2], { version: 1,
        ...(batch ? { sourceMode: "unassigned_batch",
          originalBatchFingerprint: batch.originalBatchFingerprint } : {}),
        records: rows.map((row: any) => ({
        messageId: row.id, sourceFingerprint: core.sourceFingerprint(row),
        // Deliberately no bodies/addresses. Review them inside the authorized CRM/mailbox.
      })) });
      console.log(JSON.stringify({ mode: "snapshot_read_only", records: rows.length, updates: 0 }));
      return;
    }
    const readers = new Map();
    const readerFor = async (row: any, entry: any) => {
      const key = `${row.user_id}:${core.address(entry.mailbox)}`;
      if (readers.has(key)) return readers.get(key);
      // Standalone connection reads also use an enforced read-only transaction.
      await client.query("BEGIN READ ONLY");
      let connection: any;
      try {
        const result = await client.query(`SELECT c.access_token,c.token_expires_at,c.email,
          EXISTS(SELECT 1 FROM user_ms365_shared_mailboxes s WHERE s.connection_id=c.id
            AND s.user_id=c.user_id AND s.is_active=true AND lower(s.email)=lower($2)) AS shared_allowed
          FROM user_ms365_connections c WHERE c.user_id=$1 AND c.is_connected=true`,
        [row.user_id, entry.mailbox]);
        if (result.rows.length !== 1) stop("SENDER_CONNECTION_MISSING");
        connection = result.rows[0];
      } finally { await client.query("ROLLBACK"); }
      if (core.address(connection.email) !== core.address(entry.mailbox) && !connection.shared_allowed)
        stop("MAILBOX_NOT_AUTHORIZED_FOR_SENDER");
      // Even a still-valid JWT must not be refreshed by this read-only tool.
      const expiresAt = new Date(connection.token_expires_at).getTime();
      if (!connection.token_expires_at || !Number.isFinite(expiresAt) ||
          expiresAt <= Date.now() + 60000)
        stop("RECONNECT_THROUGH_EXISTING_APP_THEN_RETRY");
      let token: string;
      try { token = decryptTokenSafe(connection.access_token); }
      catch { stop("MAILBOX_TOKEN_DECRYPTION_FAILED"); }
      const reader = { ...core.graphReader(token!, entry.mailbox), mailbox: entry.mailbox,
        allowedSenders: [entry.mailbox, connection.email] };
      readers.set(key, reader);
      return reader;
    };
    if (inspectUnassigned) {
      const inspected = await inspectMailboxes(batch, readerFor);
      writePrivate(args[2], inspected.report);
      console.log(JSON.stringify(inspected.summary));
      return;
    }
    const plan = await core.reconcile(rows, input, readerFor, batch?.originalBatchFingerprint);
    writePrivate(args[2], plan);
    console.log(JSON.stringify({ mode: plan.mode, records: plan.results.length,
      verified: plan.results.filter((row: any) => row.status === "verified").length,
      unknown: plan.results.filter((row: any) => row.status === "unknown").length,
      evidenceFingerprint: plan.evidenceFingerprint, updates: 0 }));
  } finally { client?.release(); await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => {
    // Never print SQL params, raw Graph/crypto errors, recipients, content or tokens.
    const code = /^[A-Z_]+$/.test(error?.safeCode || "") ? error.safeCode : "READ_ONLY_CHECK_FAILED";
    console.error(`STOP: ${code}`);
    process.exitCode = 1;
  });
}
