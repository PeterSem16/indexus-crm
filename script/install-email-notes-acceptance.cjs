/* Operator-only installer. Never loads CRM startup, changes its worktree or runs PM2. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createRequire } = require("node:module");
const { execFileSync, spawnSync } = require("node:child_process");

// Same installed runtime used by email.monitoring and the existing AI pilots.
const SHARED_PRELOAD = "/etc/indexus-ai-runtime/preload.cjs";
function gatewayInvocation(destination, env = process.env, args = []) {
  return {
    args: ["--require", SHARED_PRELOAD, destination, ...args],
    options: { stdio: "inherit", env: { ...env, NODE_ENV: "production",
      EMAIL_NOTES_APP_ROOT: "/var/www/indexus-crm" } },
  };
}

const FILES = Object.freeze({
  "script/email-notes-acceptance.ts": "990d7bd232a790e713642452b5c4db706e907ce0",
  "script/email-notes-acceptance-report.ts": "7d0c9ca05be84b9f9efe22e2492e84611a12388d",
  "server/lib/email-note-jobs-client.ts": "176b5aa1fdb7ecb7b9ae991966843566ed3e9867",
  "server/lib/email-note-jobs-service.ts": "f3156f1273d591ccd6de414b4ae0de0e21b5880c",
  "server/lib/email-note-jobs-schema.ts": "fb8365d3da407605937fce4980c284457671410f",
});
function gitBlobId(data) {
  return crypto.createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex");
}
function blocked(code) { const error = Error(code); error.safeCode = code; throw error; }

function install({ appRoot, destination, getBlob, builder } = {}) {
  appRoot = path.resolve(appRoot || "/var/www/indexus-crm");
  destination = path.resolve(destination || "/home/seman/indexus-private/email-notes-acceptance.cjs");
  const git = (...args) => execFileSync("git", ["--no-optional-locks", "-C", appRoot, ...args],
    { encoding: null, timeout: 120000, maxBuffer: 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  if (Number(process.versions.node.split(".")[0]) < 20 || typeof AbortSignal.any !== "function")
    blocked("node20_with_abortsignal_any_required");
  if (!getBlob) {
    // The checksum-verified installer pins every blob directly. Fetching its
    // enclosing commit supplies these objects without requiring a second commit pin.
    getBlob = file => {
      try { return git("cat-file", "blob", FILES[file]); }
      catch { blocked("pinned_source_object_not_fetched"); }
    };
  }
  if (!builder) {
    try { builder = createRequire(path.join(appRoot, "package.json"))("esbuild"); }
    catch { blocked("existing_esbuild_not_available_no_packages_installed"); }
  }
  const dir = path.dirname(destination);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const info = fs.lstatSync(dir);
  if (!info.isDirectory() || info.isSymbolicLink() ||
      info.uid !== process.getuid() || (info.mode & 0o077))
    blocked("private_directory_owner_and_0700_required");
  const realDir = fs.realpathSync(dir), realApp = fs.realpathSync(appRoot);
  if (realDir === realApp || realDir.startsWith(realApp + path.sep))
    blocked("destination_must_be_outside_application");
  const temp = fs.mkdtempSync(path.join(dir, "email-notes-build-"));
  try {
    // Verify EVERY immutable input BEFORE invoking the compiler.
    for (const [file, expected] of Object.entries(FILES)) {
      const data = Buffer.from(getBlob(file));
      if (gitBlobId(data) !== expected) blocked("source_integrity_failed");
      const target = path.join(temp, file);
      fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
      fs.writeFileSync(target, data, { mode: 0o600 });
    }
    const output = builder.buildSync({
      absWorkingDir: temp, entryPoints: ["script/email-notes-acceptance.ts"],
      bundle: true, platform: "node", format: "cjs", target: "node20",
      outfile: "generated-artifacts/email-notes-acceptance.cjs",
      write: false, logLevel: "silent",
    });
    if (output.outputFiles?.length !== 1 || !output.outputFiles[0].contents?.length)
      blocked("compiler_output_invalid");
    const data = Buffer.from(output.outputFiles[0].contents);
    const staged = path.join(temp, "verified.cjs");
    fs.writeFileSync(staged, data, { mode: 0o600 });
    // Compiler output is checked locally; it is NOT compared across compiler versions.
    execFileSync(process.execPath, ["--check", staged], { timeout: 10000, stdio: "pipe" });
    const help = execFileSync(process.execPath, [staged, "--help"],
      { timeout: 10000, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (!help.includes("No production DB connection") || help.includes('"results"'))
      blocked("compiler_launch_check_failed");
    fs.renameSync(staged, destination);
    return { destination, sourceBlobs: FILES, compiler: builder.version || "unknown",
      sha256: crypto.createHash("sha256").update(data).digest("hex") };
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

function main(args = process.argv.slice(2)) {
  try {
    const result = install();
    console.log("PASS: verified immutable sources; standalone script installed.");
    console.log(JSON.stringify(result));
    if (args.includes("--install-only") || !args.includes("--run-controlled")) {
      console.log("No POST sent. Use --run-controlled to authorize one new synthetic test.");
      return 0;
    }
    // No service-specific token file and no PM2 /proc credential scraping.
    // The existing loader enforces its existing ownership/permissions/config policy.
    const runArgs = ["--run-controlled"];
    const configIndex = args.indexOf("--config");
    if (configIndex >= 0 && args[configIndex + 1]) runArgs.push("--config", args[configIndex + 1]);
    const invocation = gatewayInvocation(result.destination, process.env, runArgs);
    const resultChild = spawnSync(process.execPath, invocation.args, invocation.options);
    return resultChild.status ?? 1;
  } catch (error) {
    console.error("BLOCKED: " + (error.safeCode || "installer_failed_no_test_started"));
    return 2;
  }
}
module.exports = { FILES, SHARED_PRELOAD, gatewayInvocation, gitBlobId, install, main };
if (require.main === module) process.exitCode = main();
