/**
 * Standalone operator tool. Bundle with esbuild; NEVER imports CRM startup/db.
 * Production is inspected through files and /proc only. No production SQL.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { createEmailNoteJobsClient } from "../server/lib/email-note-jobs-client";
import { createEmailNoteService } from "../server/lib/email-note-jobs-service";

const BASE = "1e80ffa816ece4465c39b42a31ab7a7515dad59f";
const ORIGIN = "https://ai.cordbloodcenter.com/gateway/";
const TEXT = "Predmet: Syntetický integračný test – nejde o zákazníka\n\n" +
  "Dobrý deň, toto je výhradne vymyslený testovací e-mail. Prosím o vysvetlenie " +
  "postupu doručenia informačných materiálov. Neobsahuje osobné ani zákaznícke údaje.";
type Row = { test: string; status: "PASS" | "FAIL" | "BLOCKED"; detail: string };
type JobHttpEvent = {
  method: "POST" | "GET"; started_at: string; http_status?: number;
  request_id?: string; transport_error?: string;
};
const inspectableKeys = ["INDEXUS_AI_EMAIL_NOTES_ENABLED",
  "EMAIL_NOTES_TEST_DATABASE_URL"] as const;

/** Observe safe response metadata before the unchanged client validates it. */
export function createObservedGatewayTransport(transport: typeof fetch = fetch, token = () => "") {
  const events: JobHttpEvent[] = [];
  const observed: typeof fetch = async (url, init) => {
    if (init?.method !== "POST" && init?.method !== "GET") throw Error("unsupported_job_method");
    const event: JobHttpEvent = { method: init.method, started_at: new Date().toISOString() };
    events.push(event); // A started request must never be reported as "not executed".
    try {
      const response = await transport(url, init);
      event.http_status = response.status;
      const id = response.headers.get("x-request-id");
      const secret = token();
      if (id && /^[A-Za-z0-9_.:-]{1,96}$/.test(id) && !(secret && id.includes(secret)))
        event.request_id = id;
      return response; // Do not read/clone/log request or response bodies.
    } catch (error: any) {
      const code = error?.cause?.code;
      const allowed = ["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT",
        "UND_ERR_CONNECT_TIMEOUT", "CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"];
      event.transport_error = init.signal?.aborted ? "aborted" :
        allowed.includes(code) ? code : "transport_failed";
      throw error; // The existing client converts this into its safe error code.
    }
  };
  return { fetch: observed, events };
}

export function appendMissingGatewayResults(rows: Row[], events: JobHttpEvent[]) {
  for (const method of ["POST", "GET"] as const) {
    const test = method === "POST" ? "gateway_post" : "gateway_get";
    if (rows.some(row => row.test === test)) continue;
    const attempts = events.filter(event => event.method === method);
    rows.push({ test, status: attempts.length ? "FAIL" : "BLOCKED",
      detail: attempts.length ?
        `Attempted ${attempts.length} time(s); successful result not confirmed. See gateway_http metadata; do not blindly repeat POST.` :
        "Not attempted; prerequisite unavailable." });
  }
}

export function parseConfig(text: string) {
  const result: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^(?:export\s+)?([A-Z_]+)=(.*)$/);
    if (!match || !(inspectableKeys as readonly string[]).includes(match[1])) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    result[match[1]] = value;
  }
  return result;
}

export function readPrivateConfig(file: string) {
  const flags = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW;
  const fd = fs.openSync(file, flags);
  try {
    const info = fs.fstatSync(fd);
    if (!info.isFile() || info.size > 65536 || (info.mode & 0o077) !== 0 ||
      ![0, process.getuid?.()].includes(info.uid)) throw Error("unsafe_secret_file");
    return parseConfig(fs.readFileSync(fd, "utf8"));
  } finally { fs.closeSync(fd); }
}

export function validateTestDatabase(url: string) {
  const parsed = new URL(url);
  const name = decodeURIComponent(parsed.pathname.slice(1));
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !/^indexus_email_notes_test_[a-z0-9_]+$/.test(name))
    throw Error("separate_test_database_required");
  return name;
}

/** Transport reachability only; the root path is not part of the jobs API contract. */
export async function probeGatewayHttps(signal: AbortSignal, transport: typeof fetch = fetch) {
  const response = await transport(ORIGIN, { redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
  await response.body?.cancel();
  return response.status;
}

function liveProcess(root: string) {
  const pids = "/home/seman/.pm2/pids";
  const candidates = fs.readdirSync(pids).filter(name => /^indexus-crm-\d+\.pid$/.test(name));
  const matches: { pid: number; env: Record<string, string> }[] = [];
  for (const file of candidates) {
    try {
      const pid = Number(fs.readFileSync(path.join(pids, file), "utf8").trim());
      if (!Number.isSafeInteger(pid) || pid < 2) continue;
      const proc = `/proc/${pid}`;
      if (fs.realpathSync(`${proc}/cwd`) !== fs.realpathSync(root)) continue;
      if (!fs.readFileSync(`${proc}/cmdline`, "utf8").includes("dist/index.cjs")) continue;
      const env: Record<string, string> = {};
      for (const part of fs.readFileSync(`${proc}/environ`, "utf8").split("\0")) {
        const i = part.indexOf("=");
        if (i > 0 && part.slice(0, i) === "INDEXUS_AI_EMAIL_NOTES_ENABLED")
          env[part.slice(0, i)] = part.slice(i + 1);
      }
      matches.push({ pid, env });
    } catch { /* Missing permission/process exit must not reveal raw errors. */ }
  }
  if (matches.length !== 1) throw Error("runtime_identity_unverified");
  return matches[0];
}

function snapshot(root: string) {
  const files = ["dist/index.cjs", ".env", "server/lib/ai-router.ts",
    "server/lib/email-monitoring-service.ts", "server/lib/ai/internal-adapter.ts",
    "server/lib/ai/email-monitoring-contract.ts", "server/lib/ai/email-sentiment-contract.ts"];
  return files.map(file => {
    try { return [file, crypto.createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex")]; }
    catch { return [file, "unavailable"]; }
  });
}

export async function run(args = process.argv.slice(2)) {
  if (args.includes("--help")) {
    console.log("NODE_ENV=production node --require /etc/indexus-ai-runtime/preload.cjs email-notes-acceptance.cjs\n" +
      "Optional --config /private/test-database.env supplies only isolated test database settings.\n" +
      "Read-only production inspection; one synthetic Gateway job. Optional separate test DB;\n" +
      "approval requires interactive SCHVALUJEM. No production DB connection or PM2 commands.");
    return 0;
  }
  const rows: Row[] = [];
  const add = (test: string, status: Row["status"], detail: string) => rows.push({ test, status, detail });
  const root = path.resolve(process.env.EMAIL_NOTES_APP_ROOT || "/var/www/indexus-crm");
  const configIndex = args.indexOf("--config");
  let token = "";
  let db: any;
  let schema = "";
  let baseline: ReturnType<typeof snapshot> | undefined;
  let originalPid: number | undefined;
  const stop = new AbortController();
  const observed = createObservedGatewayTransport((url, init) =>
    fetch(url, { ...init, signal: AbortSignal.any([stop.signal, init!.signal!]) }), () => token);
  const interrupt = () => stop.abort();
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  const safeCodes = new Set(["gateway_not_configured", "gateway_authentication_failed",
    "gateway_unavailable", "gateway_timeout", "invalid_gateway_response", "invalid_gateway_note",
    "unsafe_secret_file", "separate_test_database_required", "runtime_identity_unverified",
    "job_timeout", "generation_failed", "submission_uncertain", "approval_conflict"]);
  const code = (error: any) => safeCodes.has(error?.code) ? error.code :
    safeCodes.has(error?.message) ? error.message : "operator_step_failed";
  try {
    if (Number(process.versions.node.split(".")[0]) < 20) {
      add("node_runtime", "BLOCKED", "Node.js 20 or newer is required; production was not inspected.");
      return 2;
    }
    if (!fs.existsSync(path.join(root, "dist/index.cjs"))) {
      add("production_version", "BLOCKED", "Application runtime file not found; nothing executed.");
      return 2;
    }
    baseline = snapshot(root);
    const git = (...a: string[]) => execFileSync("git", ["--no-optional-locks", "-C", root, ...a],
      { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] }).trim();
    try {
      const head = git("rev-parse", "HEAD");
      add("source_version", "PASS", /^[0-9a-f]{40}$/.test(head) ? head : "unknown");
      try { git("merge-base", "--is-ancestor", BASE, "HEAD");
        add("integration_ancestry", "PASS", "Integration commit is an ancestor of source HEAD.");
      } catch { add("integration_ancestry", "BLOCKED", "Commit absent, history shallow, or selective copy; not proof of runtime absence."); }
    } catch { add("source_version", "BLOCKED", "Source Git revision unavailable."); }
    const bundle = fs.readFileSync(path.join(root, "dist/index.cjs"), "utf8");
    add("built_integration_markers", bundle.includes("INDEXUS_AI_EMAIL_NOTES_ENABLED") &&
      bundle.includes("email_note_job_audit") ? "PASS" : "BLOCKED",
    "Static bundle markers only; running build-to-source parity is not proven.");
    const config = configIndex >= 0 ? readPrivateConfig(args[configIndex + 1] || "") : {};
    let runtime: ReturnType<typeof liveProcess> | undefined;
    try {
      runtime = liveProcess(root); originalPid = runtime.pid;
      // /proc exposes initial environment, not later dotenv mutations. Check both.
      const envFile = path.join(root, ".env");
      const dotenv = fs.existsSync(envFile) ? parseConfig(fs.readFileSync(envFile, "utf8")) : {};
      const active = runtime.env.INDEXUS_AI_EMAIL_NOTES_ENABLED === "true" ||
        dotenv.INDEXUS_AI_EMAIL_NOTES_ENABLED === "true";
      add("production_flag", active ? "FAIL" : "PASS",
        active ? "Enabled in initial environment or .env; test stopped, no changes made." :
          "Off or absent in verified process initial environment and .env; unchanged.");
      if (active) return 1;
    } catch { add("production_flag", "BLOCKED", "Cannot verify live process; no PM2 daemon was started."); return 2; }
    // Identical credential source to email.monitoring: the existing shared Node
    // preload supplies process.env. Never introduce a separate notes credential.
    token = process.env.INDEXUS_AI_GATEWAY_TOKEN || "";
    add("gateway_runtime_configuration", token ? "PASS" : "BLOCKED",
      token ? "Gateway token supplied by this Node runtime; value hidden. This does not prove production build deployment." :
        "Shared Gateway runtime did not supply a token. Launch through /etc/indexus-ai-runtime/preload.cjs as for email.monitoring; no separate token file is needed.");
    try {
      const status = await probeGatewayHttps(stop.signal);
      add("https_unauthenticated", "PASS",
        `HTTP ${status}; HTTPS response received with default TLS verification, no redirects. Root status is informational; jobs API/authentication are tested separately.`);
    } catch { add("https_unauthenticated", "FAIL", "DNS/TLS/transport failure; no authenticated POST sent."); return 1; }
    if (!token || token !== token.trim() || /\s/.test(token)) {
      add("gateway_token", "BLOCKED", "INDEXUS_AI_GATEWAY_TOKEN missing or malformed; no POST sent.");
      return 2;
    }
    add("gateway_token", "PASS", "Token available for standalone test; value hidden.");
    const testUrl = config.EMAIL_NOTES_TEST_DATABASE_URL || process.env.EMAIL_NOTES_TEST_DATABASE_URL;
    if (testUrl) {
      const expected = validateTestDatabase(testUrl);
      const requireApp = createRequire(path.join(root, "package.json"));
      const { Client } = requireApp("pg");
      db = new Client({ connectionString: testUrl, connectionTimeoutMillis: 5000,
        statement_timeout: 10000, options: "-c default_transaction_read_only=on -c search_path=pg_catalog" });
      await db.connect();
      const actual = (await db.query("SELECT current_database() AS name")).rows[0]?.name;
      if (actual !== expected || !/^indexus_email_notes_test_[a-z0-9_]+$/.test(actual))
        throw Error("separate_test_database_required");
      await db.query("SET default_transaction_read_only=off");
      schema = "acceptance_" + crypto.randomUUID().replaceAll("-", "");
      await db.query(`CREATE SCHEMA "${schema}"`);
      await db.query(`SET search_path TO "${schema}",pg_catalog`);
      await db.query("CREATE TABLE users(id varchar PRIMARY KEY)");
      await db.query("INSERT INTO users VALUES('synthetic-operator')");
      add("test_database", "PASS", "Separate allowlisted test database; random private schema, no public fallback.");
    } else add("test_database", "BLOCKED", "EMAIL_NOTES_TEST_DATABASE_URL absent; production database will NOT be used.");
    const gateway = createEmailNoteJobsClient({ token: () => token, fetch: observed.fetch });
    const scope = { userId: "synthetic-operator", mailbox: "synthetic@example.test",
      messageId: "SYNTHETIC-" + crypto.randomUUID() };
    const service = db ? createEmailNoteService(db, { enabled: () => true, client: gateway }) : null;
    if (service) await service.ensureSchema();
    const record = service ? await service.submit(scope, TEXT) : null;
    if (record?.status === "failed") throw { code: record.error_code };
    // Exactly one upstream POST. Never resubmit an ambiguous failure.
    const jobId = record ? record.job_id : (await gateway.submit(TEXT)).job_id;
    add("gateway_post", "PASS", `HTTP 202; synthetic job ${jobId}`);
    const deadline = Date.now() + 540000;
    let note = "";
    while (Date.now() < deadline) {
      await sleep(10000, undefined, { signal: stop.signal });
      if (service) {
        await service.tick();
        const current = await service.get(scope);
        if (current.status === "failed") throw { code: current.error_code };
        if (current.status === "review_required") { note = current.note; break; }
      } else {
        const current = await gateway.poll(jobId);
        if (current.status === "failed") throw { code: "generation_failed" };
        if (["completed", "review_required"].includes(current.status)) { note = current.note!; break; }
      }
    }
    if (!note) throw { code: "job_timeout" };
    add("gateway_get", "PASS", "HTTP 200; completed note passed the existing CRM client contract.");
    if (service) {
      // A fresh service reads committed state, not an in-memory result.
      const fresh = createEmailNoteService(db, { enabled: () => true, client: gateway });
      const saved = await fresh.get(scope);
      const other = await fresh.get({ ...scope, messageId: scope.messageId + "-OTHER" });
      if (saved?.job_id !== jobId || saved.note !== note || other !== null) throw Error("persistence_assertion");
      add("postgres_email_binding", "PASS", "Committed result matches synthetic mailbox/message identity in separate test DB.");
      const count = (await db.query("SELECT count(*)::int n FROM email_note_job_audit")).rows[0].n;
      if (saved.status !== "review_required" || saved.approved_at || saved.approved_by || count !== 0)
        throw Error("review_assertion");
      add("unapproved_draft", "PASS", "review_required; no approver, approval time or audit before human action.");
      if (process.stdin.isTTY && process.stdout.isTTY) {
        console.log("SYNTHETIC NOTE (not a CRM mailbox message): " +
          JSON.stringify(note.split(token).join("[REDACTED]")));
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        let answer = "";
        try { answer = await rl.question("Skontrolujte slovenčinu a obsah. Pre schválenie LEN V TESTOVACEJ DB napíšte SCHVALUJEM: ", { signal: stop.signal }); }
        finally { rl.close(); }
        if (answer === "SCHVALUJEM") {
          await fresh.approve(scope, note, saved.version);
          const approved = await fresh.get(scope);
          const audit = (await db.query("SELECT * FROM email_note_job_audit WHERE note_id=$1", [saved.id])).rows;
          if (approved.status !== "approved" || approved.approved_by !== scope.userId || !approved.approved_at ||
            approved.note !== note || approved.approved_note !== note || audit.length !== 1 ||
            audit[0].actor_user_id !== scope.userId || audit[0].action !== "approved" ||
            audit[0].previous_note !== note || audit[0].approved_note !== note || !audit[0].created_at)
            throw Error("audit_assertion");
          add("manual_approval_and_audit", "PASS", "Human-confirmed through original backend service; separate test DB only.");
        } else add("manual_approval_and_audit", "BLOCKED", "Operator did not approve; no automatic approval.");
      } else add("manual_approval_and_audit", "BLOCKED", "Interactive terminal required; no automatic approval.");
    }
    add("signed_in_crm_ui", "BLOCKED", "Not tested: production remains disabled. No real Graph email or login bypass.");
  } catch (error) { add("execution", "FAIL", code(error)); }
  finally {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
    if (db) {
      try {
        if (schema) {
          await db.query(`DROP SCHEMA "${schema}" CASCADE`);
          add("test_cleanup", "PASS", "Only the temporary test schema was removed.");
        }
      }
      catch { add("test_cleanup", "FAIL", `Remove only test schema ${schema} from the separate test database.`); }
      try { await db.end(); } catch { /* Never print a raw database error. */ }
    }
    appendMissingGatewayResults(rows, observed.events);
    for (const test of ["postgres_email_binding", "unapproved_draft",
      "manual_approval_and_audit", "signed_in_crm_ui"])
      if (!rows.some(row => row.test === test)) add(test, "BLOCKED", "Prerequisite unavailable; not executed.");
    if (baseline) {
      const same = JSON.stringify(baseline) === JSON.stringify(snapshot(root));
      add("production_files", same ? "PASS" : "FAIL", same ? "Inspected files unchanged." : "Concurrent file change detected; tool made no production writes.");
    }
    if (originalPid) {
      try { add("production_process", liveProcess(root).pid === originalPid ? "PASS" : "FAIL", "PID compared; no PM2 commands or signals sent."); }
      catch { add("production_process", "BLOCKED", "Final process identity unavailable."); }
    }
    add("scope", "PASS", "No production SQL, deployment, restart, flag change, AI router change or customer data.");
    console.log(JSON.stringify({ host: os.hostname(), integration_base: BASE, results: rows,
      gateway_http: observed.events,
      overall: rows.some(r => r.status === "FAIL") ? "FAIL" : rows.some(r => r.status === "BLOCKED") ? "BLOCKED" : "PASS" }, null, 2));
    token = "";
  }
  return rows.some(row => row.status === "FAIL") ? 1 : rows.some(row => row.status === "BLOCKED") ? 2 : 0;
}

if (require.main === module) {
  run().then(status => { process.exitCode = status; }).catch(() => {
    console.error('{"overall":"FAIL","error":"operator_unexpected_failure"}'); process.exitCode = 1;
  });
}
