#!/usr/bin/env node
"use strict";
// Read pinned Git objects and build private tools. No checkout, pull, app
// build, configuration edit, PM2 restart or credential-file modification.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const APP = "/var/www/indexus-crm";
const PRELOAD = "/etc/indexus-ai-runtime/preload.cjs";
const INPUTS = [
  "server/lib/ai", "server/lib/email-monitoring-service.ts", "shared/ai-settings.ts",
  "script/ai-email-monitoring-b1", "script/ai-gateway-b4-pilot.cjs",
  "script/ai-gateway-c1/diagnostics.cjs",
];
const fail = code => { throw Error(code); };
function privateParent(home, uid) {
  const directory = path.join(home, "INDEXUS-Email-Monitoring-Tools");
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { mode: 0o700 });
  const st = fs.lstatSync(directory);
  if (!st.isDirectory() || st.isSymbolicLink() || st.uid !== uid || (st.mode & 0o077))
    fail("B1_PREPARATION_DIRECTORY_UNSAFE");
  return directory;
}
function prepareArtifacts({ app, home, uid, archive, build, runnerName = "run-b1.cjs" }) {
  if (!["run-b1.cjs", "run-b12.cjs", "run-b13.cjs", "run-b14.cjs", "run-b15.cjs", "run-b16.cjs"].includes(runnerName)) fail("B1_RUNNER_NAME_INVALID");
  const parent = privateParent(home, uid);
  const work = fs.mkdtempSync(path.join(parent, "prepared-"));
  const source = path.join(work, "source"), output = path.join(work, "bundle");
  fs.mkdirSync(source, { mode: 0o700 });
  const extracted = cp.spawnSync("tar", ["-x", "-C", source], {
    input: archive, timeout: 30000, maxBuffer: 1024 * 1024,
  });
  if (extracted.status !== 0) fail("B1_TOOL_EXTRACTION_FAILED");
  fs.symlinkSync(path.join(app, "node_modules"), path.join(source, "node_modules"));
  build(source, output);
  const runner = path.join(output, runnerName);
  const manifest = JSON.parse(fs.readFileSync(path.join(output, "manifest.json"), "utf8"));
  if (fs.lstatSync(runner).isSymbolicLink() ||
      crypto.createHash("sha256").update(fs.readFileSync(runner)).digest("hex") !== manifest.files?.[runnerName])
    fail("B1_PREPARED_BUNDLE_HASH_MISMATCH");
  fs.chmodSync(runner, 0o600);
  return { source, runner };
}
function launchArguments(runtimeFile, runner, originalB12Report, phase = "b12") {
  if (!["b12", "b13", "b14", "b15", "b16"].includes(phase)) fail("B1_PILOT_PHASE_INVALID");
  const check = `try { require(${JSON.stringify(runtimeFile)}).assertRuntime(process.env); console.log("B1_RUNTIME_READY"); } catch { console.error("B1_EXISTING_RUNTIME_PRELOAD_REQUIRED"); process.exitCode=1; }`;
  return {
    preflight: ["--require", PRELOAD, "-e", check],
    run: ["--require", PRELOAD, runner, ...(phase === "b16" ? ["--run-b16"] :
      originalB12Report ? ["--run-" + phase, originalB12Report] : ["--run-b1"])],
  };
}
const processEnvironment = env => ({ ...env, NODE_ENV: "production" });
function main() {
  const pin = process.argv[2];
  const b16 = process.argv[3] === "--run-b16" && process.argv.length === 4;
  const pilot = b16 || ["--run-b12", "--run-b13", "--run-b14", "--run-b15"].includes(process.argv[3]) && process.argv.length === 5 && path.isAbsolute(process.argv[4]);
  const phase = pilot ? process.argv[3].slice("--run-".length) : "b1";
  if (!pilot && process.argv.length !== 3) fail("B1_PREPARATION_ARGUMENTS_INVALID");
  if (!/^[0-9a-f]{40}$/.test(pin || "")) fail("B1_PIN_REQUIRED");
  if (process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN || process.platform !== "linux" ||
      os.hostname().split(".")[0].toUpperCase() !== "CORPCRM01") fail("B1_CORPCRM01_ONLY");
  if (process.getuid?.() !== 1001) fail("B1_RUN_AS_SEMAN");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") fail("B1_TLS_VERIFICATION_REQUIRED");
  let archive;
  try {
    if (cp.execFileSync("git", ["cat-file", "-t", pin], { cwd: APP, encoding: "utf8" }).trim() !== "commit")
      fail("B1_PIN_REQUIRED");
    archive = cp.execFileSync("git", ["archive", pin, ...INPUTS], {
      cwd: APP, maxBuffer: 25 * 1024 * 1024, timeout: 30000,
    });
  } catch { fail("B1_PINNED_TOOLS_UNAVAILABLE"); }
  const prepared = prepareArtifacts({
    app: APP, home: os.homedir(), uid: process.getuid(), archive,
    runnerName: "run-" + phase + ".cjs",
    build(source, output) {
      const result = cp.spawnSync(process.execPath, ["script/ai-email-monitoring-b1/package.cjs", output, ...(pilot ? ["--" + phase] : [])], {
        cwd: source, stdio: "inherit",
      });
      if (result.status !== 0) fail("B1_PRIVATE_BUNDLE_BUILD_FAILED");
    },
  });
  const args = launchArguments(path.join(prepared.source, "script/ai-email-monitoring-b1/runtime.cjs"), prepared.runner, pilot ? process.argv[4] : undefined, pilot ? phase : "b12");
  const options = { cwd: APP, stdio: "inherit", env: processEnvironment(process.env) };
  // Check loader first; a blocked loader must never fall through to .env token.
  const preflight = cp.spawnSync(process.execPath, args.preflight, options);
  if (preflight.status !== 0) fail("B1_RUNTIME_PREFLIGHT_FAILED");
  console.log(phase.toUpperCase() + "_PREPARED_RUNNER " + prepared.runner);
  const run = cp.spawnSync(process.execPath, args.run, options);
  process.exitCode = run.status ?? 1;
}
module.exports = { prepareArtifacts, launchArguments, processEnvironment };
if (require.main === module) {
  try { main(); } catch (error) {
    console.error(/^B1_[A-Z0-9_]+$/.test(error?.message) ? error.message : "B1_TOOL_PREPARATION_FAILED");
    process.exitCode = 1;
  }
}
