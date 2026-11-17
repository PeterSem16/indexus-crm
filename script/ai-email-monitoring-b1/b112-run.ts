/** Operator entry: existing CRM code/credentials; no mailbox polling or live writes. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
import { parse } from "dotenv";
import { executeB112 } from "./b112-pilot";
import { analyzeSource } from "./source.cjs";
import { assertRuntime } from "./runtime.cjs";
import { readProductionSnapshot, productionComparison, catalogFromSource } from "./b11-check.cjs";
import { createInternalAIAdapter } from "../../server/lib/ai/internal-adapter";
declare const B112_SOURCE: ReturnType<typeof analyzeSource>;
declare const B112_FILES: Record<string, string>;
const APP = "/var/www/indexus-crm";
const hash = (value: string | Buffer) => crypto.createHash("sha256").update(value).digest("hex");
const fail = (code: string): never => { throw Error(code); };
async function main() {
  if (os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" || process.getuid?.() !== 1001 ||
    process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN) fail("B112_CORPCRM01_AS_SEMAN_REQUIRED");
  if (process.argv.length !== 3 || process.argv[2] !== "--run-seven") fail("B112_ARGUMENT_REQUIRED");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") fail("B112_TLS_REQUIRED");
  assertRuntime(process.env);
  const liveSource = analyzeSource(path.join(APP, "server/lib/email-monitoring-service.ts"));
  if (liveSource.sourceSha256 !== B112_SOURCE.sourceSha256) fail("B112_LIVE_ANALYZER_CHANGED");
  const deployment = Object.fromEntries(Object.entries(B112_FILES).map(([file, sha]) =>
    [file, { candidateSha256: sha, liveSha256: hash(fs.readFileSync(path.join(APP, file))) }]));
  const candidateDeployed = Object.values(deployment).every(row => row.candidateSha256 === row.liveSha256);
  const env = parse(fs.readFileSync(path.join(APP, ".env")));
  if (process.env.DATABASE_URL && env.DATABASE_URL && process.env.DATABASE_URL !== env.DATABASE_URL)
    fail("B112_DATABASE_ENV_CONFLICT");
  const connectionString = process.env.DATABASE_URL || env.DATABASE_URL;
  if (!connectionString) fail("B112_DATABASE_CONFIGURATION_REQUIRED");
  const token = process.env.INDEXUS_AI_GATEWAY_TOKEN!;
  const home = path.join(os.homedir(), "INDEXUS-Email-Monitoring");
  if (!fs.existsSync(home)) fs.mkdirSync(home, { mode: 0o700 });
  const st = fs.lstatSync(home);
  if (!st.isDirectory() || st.isSymbolicLink() || st.uid !== process.getuid!() || (st.mode & 0o077))
    fail("B112_PRIVATE_DIRECTORY_REQUIRED");
  // One-shot approval, not automatic retry or resume after an uncertain request.
  const marker = path.join(home, "B112-seven.started");
  const out = fs.mkdtempSync(path.join(home, "B112-run-"));
  const file = path.join(out, "B112_evidence.json");
  const catalog = catalogFromSource(fs.readFileSync(path.join(APP, "server/lib/ai/service-catalog.ts"), "utf8"));
  const snapshot = () => readProductionSnapshot({ Client, connectionString, catalog });
  const before = await snapshot();
  productionComparison(before, before, before); // Requires disabled Gateway and 65 OpenAI routes.
  const client = createInternalAIAdapter({
    readConfiguration: () => ({ production: true, replit: false, enabled: true,
      baseURL: "https://ai.cordbloodcenter.com/gateway/", token }),
    readSettings: () => ({ timeoutMs: 30_000 } as any),
  }).createClient({}, { service: "email.monitoring" });
  if (client.timeout !== 120_000) fail("B112_SERVICE_TIMEOUT_NOT_120000");
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  const db = new Client({ connectionString, connectionTimeoutMillis: 8000,
    application_name: "indexus-b112-synthetic-temp-only", options: "-c statement_timeout=8000" });
  let finalReport: any;
  const save = (report: any) => {
    finalReport = { ...report, before, deployment, candidateDeployed,
      runtimePolicy: { candidateEmailMonitoringTimeoutMs: client.timeout,
        otherServiceManagedTimeoutMs: 30_000, productionRestartVerified: false },
      analyzerSha256: liveSource.sourceSha256, originalRequestSha256: liveSource.requestSha256,
      candidateFiles: B112_FILES, operatorStatedVersion: "B1.12",
      effectiveServerRules: "REQUIRES_CURRENT_OPERATOR_ATTESTATION" };
    const text = JSON.stringify(finalReport, null, 2) + "\n";
    if (text.includes(token)) fail("B112_SECRET_ECHO_REFUSED");
    fs.writeFileSync(file + ".tmp", text, { mode: 0o600 });
    fs.renameSync(file + ".tmp", file);
  };
  console.log("B112_RESULTS " + file);
  try {
    await db.connect();
    await executeB112({ token, source: liveSource, reference: before, readSnapshot: snapshot,
      database: db, save, signal: controller.signal, fetch,
      claimOnce() { fs.writeFileSync(marker, JSON.stringify({ out, at: new Date().toISOString() }),
        { flag: "wx", mode: 0o600 }); },
    });
  } finally {
    await db.end();
    if (finalReport) {
      try {
        finalReport.after = await snapshot();
        finalReport.production = productionComparison(before, before, finalReport.after);
        if (!finalReport.production.unchangedDuringCheck) {
          finalReport.error = "B112_PRODUCTION_CHANGED";
          finalReport.verdict = "NOT_READY";
        }
      } catch { finalReport.error = "B112_FINAL_CONFIGURATION_UNVERIFIED"; finalReport.verdict = "NOT_READY"; }
      save(finalReport);
    }
  }
  console.log(JSON.stringify({ verdict: finalReport?.verdict ?? "NOT_READY",
    complete: finalReport?.complete ?? false, attempts: finalReport?.inferenceAttempts ?? 0,
    candidateDeployed, emailMonitoringTimeoutMs: client.timeout, error: finalReport?.error ?? null,
    productionActivation: "NOT_PERFORMED", results: file }, null, 2));
  process.exitCode = finalReport?.error ? 2 : 0;
}
main().catch(() => { console.error("B112_STOPPED_NO_AUTOMATIC_RETRY"); process.exitCode = 1; });
