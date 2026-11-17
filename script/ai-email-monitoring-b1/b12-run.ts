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
import { executeB13, B13_CORPUS_SHA256, renderB13 } from "./b13-pilot";
import { B14_CORPUS_SHA256 } from "./b14-corpus";
import { executeB14, renderB14, validateB14Baseline } from "./b14-pilot";
import { executeB15, renderB15 } from "./b15-pilot";
import { findB14Baseline } from "./b15-baseline-files";
import { executeB16, renderB16, findB15Baseline } from "./b16-pilot";
import { executeB17, renderB17, findB16Baseline, validateB17Approval, failuresB17 } from "./b17-pilot";
import { B17_CORPUS_SHA256, B17_POLICY_SHA256 } from "./b17-corpus";
import { executeB18, renderB18, failuresB18, findB17Baseline, B18_CORPUS_SHA256, B18_EXECUTION_PROFILE } from "./b18-pilot";
declare const B1_PREPARED_SOURCE: ReturnType<typeof analyzeSource>;
declare const B1_PILOT_PHASE: "B12" | "B13" | "B14" | "B15" | "B16" | "B17" | "B18";
const APP = "/var/www/indexus-crm";
const fail = (code: string): never => { throw Error(code); };
async function main() {
  if (process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN || process.platform !== "linux" ||
    os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" || process.getuid?.() !== 1001)
    fail("B12_CORPCRM01_AS_SEMAN_REQUIRED");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") fail("B12_TLS_VERIFICATION_REQUIRED");
  assertRuntime(process.env);
  const b13 = B1_PILOT_PHASE === "B13";
  const b14 = B1_PILOT_PHASE === "B14";
  const b15 = B1_PILOT_PHASE === "B15";
  const b16 = B1_PILOT_PHASE === "B16";
  const b18 = B1_PILOT_PHASE === "B18";
  const b17 = B1_PILOT_PHASE === "B17", automatic = b16 || b17 || b18;
  const modern = b14 || b15 || automatic, batch = b13 || modern;
  const prefix = b18 ? "B18" : b17 ? "B17" : b16 ? "B16" : b15 ? "B15" : b14 ? "B14" : b13 ? "B13" : "B12";
  if (process.argv.length !== (automatic ? 3 : 4) || process.argv[2] !== "--run-" + prefix.toLowerCase()) fail("B12_ARGUMENTS_INVALID");
  const live = analyzeSource(path.join(APP, "server/lib/email-monitoring-service.ts"));
  if (live.requestSha256 !== B1_PREPARED_SOURCE.requestSha256) fail("B12_ORIGINAL_REQUEST_CHANGED");
  const home = path.join(os.homedir(), modern ? "INDEXUS-Email-Monitoring" : ".indexus-email-monitoring-b1");
  if (modern && !fs.existsSync(home)) fs.mkdirSync(home, { mode: 0o700 });
  const directory = fs.lstatSync(home);
  if (!directory.isDirectory() || directory.isSymbolicLink() || directory.uid !== process.getuid?.() ||
    (directory.mode & 0o077)) fail("B12_PRIVATE_DIRECTORY_REQUIRED");
  let baseline: any, b14Baseline: ReturnType<typeof validateB14Baseline> | null = null;
  if (b17 || b18) validateB17Approval(B1_PREPARED_SOURCE);
  if (!automatic) {
    const baselinePath = fs.realpathSync(process.argv[3]);
    if (!baselinePath.startsWith((modern ? os.homedir() : home) + path.sep) || path.basename(baselinePath) !== "evidence.json")
      fail("B12_ORIGINAL_REPORT_REQUIRED");
    const baselineStat = fs.lstatSync(baselinePath);
    if (!baselineStat.isFile() || baselineStat.uid !== process.getuid?.() || (baselineStat.mode & 0o077) ||
      baselineStat.size > 2 * 1024 * 1024) fail("B12_ORIGINAL_REPORT_UNSAFE");
    baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    b14Baseline = b14 || b15 ? validateB14Baseline(baseline, B1_PREPARED_SOURCE) : null;
  }
  const previous = b15 ? findB14Baseline(home, process.getuid!(), baseline, B1_PREPARED_SOURCE) : null;
  const latest = b16 ? findB15Baseline(home, process.getuid!(), B1_PREPARED_SOURCE) : null;
  const b16Evidence = b17 || b18 ? findB16Baseline(home, process.getuid!(), B1_PREPARED_SOURCE) : null;
  const b17Evidence = b18 ? findB17Baseline(home, process.getuid!(), B1_PREPARED_SOURCE, b16Evidence!.report) : null;
  const reference = b18 ? b17Evidence!.validated.reference : b17 ? b16Evidence!.validated.reference : b16 ? latest!.validated.reference :
    b15 ? previous!.validated.reference : b14 ? b14Baseline!.reference : originalReference(baseline);
  if (previous) console.log("B15_B14_BASELINE " + previous.file);
  if (latest) console.log("B16_B15_BASELINE " + latest.file);
  if (b16Evidence) console.log(prefix + "_B16_BASELINE " + b16Evidence.file);
  if (b17Evidence) console.log("B18_B17_BASELINE " + b17Evidence.file);
  const env = parse(fs.readFileSync(path.join(APP, ".env")));
  if (process.env.DATABASE_URL && env.DATABASE_URL && process.env.DATABASE_URL !== env.DATABASE_URL)
    fail("B12_DATABASE_ENV_CONFLICT");
  const connectionString = process.env.DATABASE_URL || env.DATABASE_URL;
  if (!connectionString) fail("B12_DATABASE_CONFIGURATION_REQUIRED");
  const token: string = process.env.INDEXUS_AI_GATEWAY_TOKEN || fail("B12_EXISTING_RUNTIME_REQUIRED");
  const catalog = catalogFromSource(fs.readFileSync(path.join(APP, "server/lib/ai/service-catalog.ts"), "utf8"));
  const identity = crypto.createHash("sha256").update(JSON.stringify({
    approval: b18 ? { phase: "B1.8", configuration: B12, corpusSha256: B18_CORPUS_SHA256,
      executionProfile: B18_EXECUTION_PROFILE,
      b17BaselineSha256: b17Evidence!.validated.sha256, b16BaselineSha256: b16Evidence!.validated.sha256 } :
      b17 ? { phase: "B1.7", configuration: B12, corpusSha256: B17_CORPUS_SHA256,
      policySha256: B17_POLICY_SHA256, referenceApproval: validateB17Approval(B1_PREPARED_SOURCE),
      b16BaselineSha256: b16Evidence!.validated.sha256 } :
      b16 ? { phase: "B1.6", configuration: B12, corpusSha256: B14_CORPUS_SHA256,
      b15BaselineSha256: latest!.validated.sha256, requiredCases: 35, requiredFields: 280 } :
      b15 ? { phase: "B1.5", configuration: B12, corpusSha256: B14_CORPUS_SHA256,
      b13BaselineSha256: b14Baseline!.sha256, b14BaselineSha256: previous!.validated.previous.sha256 } :
      b14 ? { phase: "B1.4", configuration: B12, corpusSha256: B14_CORPUS_SHA256,
      baselineSha256: b14Baseline!.sha256 } :
      b13 ? { phase: "B1.3", configuration: B12, corpusSha256: B13_CORPUS_SHA256 } : B12,
    originalRequest: B1_PREPARED_SOURCE.requestSha256,
  })).digest("hex");
  const out = fs.mkdtempSync(path.join(home, b18 ? "B18-run-" : b17 ? "B17-run-" : b16 ? "B16-run-" : b15 ? "B15-run-" : b14 ? "B14-run-" : b13 ? "b13-run-" : "b12-run-"));
  const marker = path.join(home, (b18 ? "B18-batch-" : b17 ? "B17-batch-" : b16 ? "B16-batch-" : b15 ? "B15-batch-" : b14 ? "B14-batch-" : b13 ? "b13-batch-" : "b12-single-") + identity + ".started");
  const file = path.join(out, b18 ? "B18_evidence.json" : b17 ? "B17_evidence.json" : "evidence.json");
  const markdownFile = path.join(out, b18 ? "B18_report.md" : b17 ? "B17_report.md" : "report.md");
  const persist = (value: any) => {
    const text = JSON.stringify(value, null, 2);
    if (text.includes(token)) fail("B12_SECRET_ECHO");
    fs.writeFileSync(file + ".tmp", text + "\n", { mode: 0o600 });
    fs.renameSync(file + ".tmp", file);
    if (batch) {
      const md = b18 ? renderB18(value) : b17 ? renderB17(value) : b16 ? renderB16(value) : b15 ? renderB15(value) : b14 ? renderB14(value) : renderB13(value);
      if (md.includes(token)) fail("B12_SECRET_ECHO");
      fs.writeFileSync(markdownFile + ".tmp", md, { mode: 0o600 });
      fs.renameSync(markdownFile + ".tmp", markdownFile);
      if (b17 || b18) {
        const failureFile = path.join(out, b18 ? "B18_failures.json" : "B17_failures.json");
        const failures = JSON.stringify(b18 ? failuresB18(value) : failuresB17(value), null, 2);
        if (failures.includes(token)) fail("B12_SECRET_ECHO");
        fs.writeFileSync(failureFile + ".tmp", failures + "\n", { mode: 0o600 });
        fs.renameSync(failureFile + ".tmp", failureFile);
      }
    }
  };
  if (modern) console.log(prefix + "_PROGRESS " + file);
  const controller = new AbortController();
  const interrupt = () => controller.abort("SIGINT"), terminate = () => controller.abort("SIGTERM");
  process.on("SIGINT", interrupt); process.on("SIGTERM", terminate);
  let report;
  try {
    const options = { token, source: B1_PREPARED_SOURCE, reference, fetch,
      signal: controller.signal,
      readSnapshot: () => readProductionSnapshot({ Client, connectionString, catalog }),
      claimOnce() {
        try { fs.writeFileSync(marker, new Date().toISOString(), { mode: 0o600, flag: "wx" }); }
        catch (error: any) { fail(error.code === "EEXIST" ? "B12_RUN_ALREADY_STARTED" : "B12_MARKER_WRITE_FAILED"); }
      },
    };
    report = b18 ? await executeB18({ ...options, b17: b17Evidence!.report, b16: b16Evidence!.report, persist,
      progress(row: any, i: number) { console.log(`B18_CASE ${i + 1}/135 ${row.id} ${row.verdict} HTTP=${row.httpStatus ?? "NONE"}`); },
    }) : b17 ? await executeB17({ ...options, previous: b16Evidence!.report, persist,
      progress(row: any, i: number) { console.log(`B17_CASE ${i + 1}/100 ${row.id} ${row.verdict} HTTP=${row.httpStatus ?? "NONE"}`); },
    }) : b16 ? await executeB16({ ...options, previous: latest!.report, persist,
      progress(row: any, i: number) { console.log(`B16_CASE ${i + 1}/35 ${row.id} ${row.verdict} HTTP=${row.httpStatus ?? "NONE"}`); },
    }) : b15 ? await executeB15({ ...options, baseline, previous: previous!.report, persist,
      progress(row: any, i: number) { console.log(`B15_CASE ${i + 1}/35 ${row.id} ${row.verdict} HTTP=${row.httpStatus ?? "NONE"}`); },
    }) : b14 ? await executeB14({ ...options, baseline, persist,
      progress(row: any, i: number) { console.log(`B14_CASE ${i + 1}/35 ${row.id} ${row.verdict} HTTP=${row.httpStatus ?? "NONE"}`); },
    }) : b13 ? await executeB13({ ...options, persist,
      progress(row: any, i: number) { console.log(`B13_CASE ${i + 1}/30 ${row.id} ${row.verdict} HTTP=${row.httpStatus ?? "NONE"}`); },
    }) : await executeB12(options);
  } finally {
    process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", terminate);
  }
  persist(report);
  console.log(prefix + "_RESULTS " + file);
  if (batch) {
    console.log(prefix + "_REPORT " + markdownFile);
    console.log(JSON.stringify({ phase: report.phase, complete: report.complete, error: report.error,
      summary: report.summary, production: report.production,
      ...(modern ? { comparison: report.comparison } : {}) }, null, 2));
  } else console.log(JSON.stringify(report, null, 2));
  process.exitCode = (batch ? report.summary.verdict : report.verdict) === "PASS" ? 0 : 2;
}
main().catch((error: any) => {
  console.error(/^B(?:1|11|12|13|14|15|16|17|18|4)_[A-Z0-9_]+$/.test(error?.message || "") ? error.message : "B12_LOCAL_SETUP_FAILED");
  process.exitCode = 1;
});
