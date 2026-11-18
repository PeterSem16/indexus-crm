"use strict";
// Same isolated console/preload launch pattern as email.monitoring.
// No checkout, install, PM2 restart, credential edit or production route write.
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const cp = require("node:child_process");
const INPUTS = ["package.json", "tsconfig.json", "server/lib/ai",
  "server/config/ai-routing.ts", "shared/ai-settings.ts", "script/ai-three-services",
  "script/ai-email-monitoring-b1/runtime.cjs"];
function prepareRecovery({ app, home, archive, originalReport, execute, env = process.env,
    mode = "--recover-before-first-case" }) {
  if (!["--recover-before-first-case", "--smoke-three", "--checklist-sk-retest",
      "--checklist-sk-content-retest", "--checklist-sk-fidelity-retest"].includes(mode))
    throw Error("THREE_CONSOLE_MODE_INVALID");
  const work = fs.mkdtempSync(path.join(home, "INDEXUS-AI-Three-Services-Recovery-"));
  fs.chmodSync(work, 0o700);
  const source = path.join(work, "source");
  fs.mkdirSync(source, { mode: 0o700 });
  const unpack = cp.spawnSync("tar", ["-x", "-C", source], { input: archive, timeout: 30000 });
  if (unpack.status !== 0) throw Error("THREE_RECOVERY_EXTRACTION_FAILED");
  fs.symlinkSync(path.join(app, "node_modules"), path.join(source, "node_modules"));
  const runner = path.join(source, "script/ai-three-services/run.ts");
  for (const file of [runner, path.join(source, "script/ai-three-services/run-safety.ts")])
    if (!fs.statSync(file).isFile()) throw Error("THREE_RECOVERY_RUNNER_MISSING");
  const checklist = ["--checklist-sk-retest", "--checklist-sk-content-retest",
    "--checklist-sk-fidelity-retest"].includes(mode);
  const report = mode === "--checklist-sk-fidelity-retest" ? path.join(work, "task-checklist-sk-fidelity-retest.json")
    : mode === "--checklist-sk-content-retest" ? path.join(work, "task-checklist-sk-content-retest.json")
    : mode === "--checklist-sk-retest" ? path.join(work, "task-checklist-sk-retest.json")
    : mode === "--smoke-three" ? path.join(work, "three-services-smoke.json") : originalReport;
  console.log(checklist
    ? "Opakujem iba povodny slovensky test task.checklist: limit 15 sekund, bez retries."
    : mode === "--smoke-three"
    ? "Spustam presne 3 synteticke AI poziadavky cez povodny CRM router a parser."
    : "Spustam overene pokracovanie pred prvou AI poziadavkou.");
  console.log("Povodne markery a reporty zostavaju zachovane. Report: " + report);
  return execute(process.execPath, ["--require", "/etc/indexus-ai-runtime/preload.cjs",
    "--import", "tsx", runner, mode, report], {
    cwd: source, stdio: "inherit", env: { ...env, NODE_ENV: "production" },
  });
}
function main() {
  const pin = process.argv[2], originalReport = process.argv[3];
  const selectedTest = ["--smoke-three", "--checklist-sk-retest",
    "--checklist-sk-content-retest", "--checklist-sk-fidelity-retest"].includes(originalReport);
  if (process.argv.length !== 4 || !/^[a-f0-9]{40}$/.test(pin || "") ||
      !originalReport || (!selectedTest && !path.isAbsolute(originalReport)))
    throw Error("THREE_RECOVERY_PIN_AND_ORIGINAL_REPORT_REQUIRED");
  if (os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01" ||
      process.getuid?.() !== 1001 || process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN)
    throw Error("THREE_RECOVERY_CORPCRM01_AS_SEMAN_REQUIRED");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw Error("THREE_TLS_REQUIRED");
  const app = "/var/www/indexus-crm";
  fs.accessSync("/etc/indexus-ai-runtime/preload.cjs", fs.constants.R_OK);
  const archive = cp.execFileSync("git", ["archive", pin, ...INPUTS], {
    cwd: app, timeout: 30000, maxBuffer: 32 * 1024 * 1024,
  });
  const run = prepareRecovery({ app, home: os.homedir(), archive, originalReport,
    ...(selectedTest ? { mode: originalReport } : {}),
    execute: (...args) => cp.spawnSync(...args) });
  if (run.error) throw run.error;
  process.exitCode = run.status ?? 1;
}
module.exports = { prepareRecovery, INPUTS };
if (require.main === module) {
  try { main(); } catch (error) {
    const code = /^THREE_[A-Z0-9_]+$/.test(error?.message) ? error.message :
      ["ENOENT", "EACCES", "EEXIST"].includes(error?.code) ? error.code : "THREE_RECOVERY_LAUNCH_FAILED";
    console.error(code); process.exitCode = 1;
  }
}
