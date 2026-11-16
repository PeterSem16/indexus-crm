/** Operator-only entry. No application startup, mailbox reads or production writes. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";
import { parse } from "dotenv";
import { analyzeSource } from "./source.cjs";
import { assertRuntime } from "./runtime.cjs";
import { originalReference, readProductionSnapshot, catalogFromSource } from "./b11-check.cjs";
import { B12, executeB12 } from "./b12-test";
declare const B1_PREPARED_SOURCE: ReturnType<typeof analyzeSource>;
const APP = "/var/www/indexus-crm";
const fail = (code: string): never => { throw Error(code); };
async function main() {
  if (process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN || process.platform !== "linux" ||
    os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" || process.getuid?.() !== 1001)
    fail("B12_CORPCRM01_AS_SEMAN_REQUIRED");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") fail("B12_TLS_VERIFICATION_REQUIRED");
  assertRuntime(process.env);
  if (process.argv.length !== 4 || process.argv[2] !== "--run-b12") fail("B12_ARGUMENTS_INVALID");
  const live = analyzeSource(path.join(APP, "server/lib/email-monitoring-service.ts"));
  if (live.requestSha256 !== B1_PREPARED_SOURCE.requestSha256) fail("B12_ORIGINAL_REQUEST_CHANGED");
  const home = path.join(os.homedir(), ".indexus-email-monitoring-b1");
  const directory = fs.lstatSync(home);
  if (!directory.isDirectory() || directory.isSymbolicLink() || directory.uid !== process.getuid?.() ||
    (directory.mode & 0o077)) fail("B12_PRIVATE_DIRECTORY_REQUIRED");
  const baselinePath = fs.realpathSync(process.argv[3]);
  if (!baselinePath.startsWith(home + path.sep) || path.basename(baselinePath) !== "evidence.json")
    fail("B12_ORIGINAL_REPORT_REQUIRED");
  const baselineStat = fs.lstatSync(baselinePath);
  if (!baselineStat.isFile() || baselineStat.uid !== process.getuid?.() || (baselineStat.mode & 0o077) ||
    baselineStat.size > 2 * 1024 * 1024) fail("B12_ORIGINAL_REPORT_UNSAFE");
  const reference = originalReference(JSON.parse(fs.readFileSync(baselinePath, "utf8")));
  const env = parse(fs.readFileSync(path.join(APP, ".env")));
  if (process.env.DATABASE_URL && env.DATABASE_URL && process.env.DATABASE_URL !== env.DATABASE_URL)
    fail("B12_DATABASE_ENV_CONFLICT");
  const connectionString = process.env.DATABASE_URL || env.DATABASE_URL;
  if (!connectionString) fail("B12_DATABASE_CONFIGURATION_REQUIRED");
  const token: string = process.env.INDEXUS_AI_GATEWAY_TOKEN || fail("B12_EXISTING_RUNTIME_REQUIRED");
  const catalog = catalogFromSource(fs.readFileSync(path.join(APP, "server/lib/ai/service-catalog.ts"), "utf8"));
  const identity = crypto.createHash("sha256").update(JSON.stringify({
    approval: B12, originalRequest: B1_PREPARED_SOURCE.requestSha256,
  })).digest("hex");
  const out = fs.mkdtempSync(path.join(home, "b12-run-"));
  const marker = path.join(home, "b12-single-" + identity + ".started");
  const controller = new AbortController(), abort = () => controller.abort();
  process.on("SIGINT", abort); process.on("SIGTERM", abort);
  let report;
  try {
    report = await executeB12({ token, source: B1_PREPARED_SOURCE, reference, fetch,
      signal: controller.signal,
      readSnapshot: () => readProductionSnapshot({ Client, connectionString, catalog }),
      claimOnce() {
        try { fs.writeFileSync(marker, new Date().toISOString(), { mode: 0o600, flag: "wx" }); }
        catch (error: any) { fail(error.code === "EEXIST" ? "B12_RUN_ALREADY_STARTED" : "B12_MARKER_WRITE_FAILED"); }
      },
    });
  } finally {
    process.removeListener("SIGINT", abort); process.removeListener("SIGTERM", abort);
  }
  const text = JSON.stringify(report, null, 2);
  if (text.includes(token)) fail("B12_SECRET_ECHO");
  const file = path.join(out, "evidence.json");
  fs.writeFileSync(file + ".tmp", text + "\n", { mode: 0o600, flag: "wx" });
  fs.renameSync(file + ".tmp", file);
  console.log("B12_RESULTS " + file);
  console.log(text);
  process.exitCode = report.verdict === "PASS" ? 0 : 2;
}
main().catch((error: any) => {
  console.error(/^B(?:1|11|12|4)_[A-Z0-9_]+$/.test(error?.message || "") ? error.message : "B12_LOCAL_SETUP_FAILED");
  process.exitCode = 1;
});
